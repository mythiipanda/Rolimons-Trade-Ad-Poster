import React, { useState, useEffect, useCallback } from "react";
import { sendToBackground } from "@plasmohq/messaging";
import type { MessageRequest, MessageResponse, RobloxItem, RolimonsItem, TradeConfig } from "~types/messages";

import "./style.css";

function IndexPopup() {
  const [robloxUserId, setRobloxUserId] = useState<number | null>(null);
  const [rolimonsVerificationToken, setRolimonsVerificationToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("Loading...");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>("");
  const [userInventory, setUserInventory] = useState<RobloxItem[]>([]);
  const [tradeInterval, setTradeInterval] = useState<number>(15);

  const [allRolimonsItems, setAllRolimonsItems] = useState<RolimonsItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<RolimonsItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5; // Reduced for better UX

  const [selectedOfferItemIds, setSelectedOfferItemIds] = useState<number[]>([]);
  const [selectedRequestItemIds, setSelectedRequestItemIds] = useState<number[]>([]);
  const [tradeTags, setTradeTags] = useState<string[]>(["any"]);

  // Multiple configs state
  const [savedConfigs, setSavedConfigs] = useState<Array<{
    id: string;
    name: string;
    offerItemIds: number[];
    requestItemIds: number[];
    tradeTags: string[];
    createdAt: number;
  }>>([]);
  const [currentConfigId, setCurrentConfigId] = useState<string | null>(null);
  const [autoCycleEnabled, setAutoCycleEnabled] = useState<boolean>(false);

  // Plug detection state
  const [plugDetectionEnabled, setPlugDetectionEnabled] = useState<boolean>(false);
  const [plugSettings, setPlugSettings] = useState<any>({
    maxTradeAds: 100,
    fetchInterval: 30,
    tempIgnoreDays: 7,
    minValue: 10000,
    enabled: false
  });
  const [plugStats, setPlugStats] = useState<any>({ permanent: 0, temporary: 0 });
  const [foundPlugs, setFoundPlugs] = useState<any[]>([]);

  // Available trade tags
  const availableTags = ["adds", "upgrade", "downgrade", "any", "wishlist", "demand", "rares", "rap", "robux", "projecteds"];


  // Active tab state
  const [activeTab, setActiveTab] = useState<string>("control");

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [inventoryLoading, setInventoryLoading] = useState<boolean>(false);

  // Utility function to send message to background script with retry logic
  const sendMessageToBackground = useCallback(async (message: Omit<MessageRequest, 'name'>, retries = 3, delay = 500): Promise<MessageResponse | undefined> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await sendToBackground({ name: "popupMessage", ...message });
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
        return response;
      } catch (error: any) {
        console.warn(`[popup.tsx] Message failed, retrying (${i + 1}/${retries}):`, error.message);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }, []);

  // Load and display saved credentials
  const loadAndDisplayCredentials = useCallback(async () => {
    const storedCredentials = await chrome.storage.local.get(['robloxUserId', 'rolimonsVerificationToken']);
    setRobloxUserId(storedCredentials.robloxUserId || null);
    setRolimonsVerificationToken(storedCredentials.rolimonsVerificationToken || null);
  }, []);

  // Display user avatar and username
  const displayUserAvatar = useCallback(async (userId: number | null) => {
    if (!userId) {
      setUserAvatarUrl("");
      setUserName("User ID not available");
      return;
    }

    try {
      const response = await sendMessageToBackground({ action: "fetchUserAvatar", userId: userId });
      if (response && response.status === "success") {
        setUserAvatarUrl(response.imageUrl || "");
        setUserName(response.userName || "Username not found");
      } else {
        setUserAvatarUrl("");
        setUserName(`Error: ${response?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      setUserAvatarUrl("");
      setUserName('Error loading profile');
    }
  }, [sendMessageToBackground]);

  // Display user inventory
  const displayUserInventory = useCallback(async (userId: number | null) => {
    if (!userId) {
      setUserInventory([]);
      return;
    }

    setInventoryLoading(true);
    try {
      const response = await sendMessageToBackground({ action: "fetchUserInventory", userId: userId });
      if (response && response.status === "success" && response.inventory) {
        setUserInventory(response.inventory);
      } else {
        setUserInventory([]);
      }
    } catch (error: any) {
      setUserInventory([]);
    } finally {
      setInventoryLoading(false);
    }
  }, [sendMessageToBackground]);

  // Load all Rolimons items
  const loadRolimonsItems = useCallback(async (): Promise<RolimonsItem[]> => {
    try {
      const response = await sendMessageToBackground({ action: "getAllRolimonsItems" });
      if (response && response.status === "success" && response.allItems) {
        const itemsWithThumbnails = response.allItems;
        const allItemIds = itemsWithThumbnails.map(item => item.id);
        const thumbnailResponse = await sendMessageToBackground({ action: "fetchRolimonsItemThumbnails", itemIds: allItemIds });

        if (thumbnailResponse && thumbnailResponse.status === "success" && thumbnailResponse.thumbnails) {
          const thumbnailsMap = thumbnailResponse.thumbnails;
          itemsWithThumbnails.forEach(item => {
            if (thumbnailsMap[item.id]) {
              item.thumbnailUrl = thumbnailsMap[item.id];
            }
          });
        }
        setAllRolimonsItems(itemsWithThumbnails);
        setFilteredItems(itemsWithThumbnails);
        return itemsWithThumbnails;
      } else {
        return [];
      }
    } catch (error: any) {
      return [];
    }
  }, [sendMessageToBackground]);


  // Load saved configs and settings
  const loadConfigsAndSettings = useCallback(async () => {
    const stored = await chrome.storage.local.get(['savedConfigs', 'currentConfigId', 'autoCycleEnabled']);
    
    const configs = stored.savedConfigs || [];
    setSavedConfigs(configs);
    setCurrentConfigId(stored.currentConfigId || null);
    setAutoCycleEnabled(stored.autoCycleEnabled || false);
    
    // If there's a current config, load it; otherwise load legacy format
    if (stored.currentConfigId && configs.length > 0) {
      const currentConfig = configs.find((c: any) => c.id === stored.currentConfigId);
      if (currentConfig) {
        setSelectedOfferItemIds(currentConfig.offerItemIds || []);
        const validRequestItemIds = (currentConfig.requestItemIds || []).filter((itemId: number) =>
          allRolimonsItems.some(item => item.id === itemId)
        );
        setSelectedRequestItemIds(validRequestItemIds);
        setTradeTags(currentConfig.tradeTags || ["any"]);
        return;
      }
    }
    
    // Fallback to legacy format for backward compatibility
    const legacyData = await chrome.storage.local.get(['selectedOfferItemIds', 'selectedSearchItemIds', 'tradeTags']);
    setSelectedOfferItemIds(legacyData.selectedOfferItemIds || []);
    const validSelectedRequestItemIds = (legacyData.selectedSearchItemIds || []).filter((itemId: number) =>
      allRolimonsItems.some(item => item.id === itemId)
    );
    setSelectedRequestItemIds(validSelectedRequestItemIds);
    setTradeTags(legacyData.tradeTags || ["any"]);
  }, [allRolimonsItems]);

  // Save current config
  const saveCurrentConfig = useCallback(async (name: string) => {
    const newConfig = {
      id: Date.now().toString(),
      name: name,
      offerItemIds: selectedOfferItemIds,
      requestItemIds: selectedRequestItemIds,
      tradeTags: tradeTags,
      createdAt: Date.now()
    };
    
    const updatedConfigs = [...savedConfigs, newConfig];
    setSavedConfigs(updatedConfigs);
    setCurrentConfigId(newConfig.id);
    
    await chrome.storage.local.set({
      savedConfigs: updatedConfigs,
      currentConfigId: newConfig.id
    });
    
    return newConfig.id;
  }, [selectedOfferItemIds, selectedRequestItemIds, tradeTags, savedConfigs]);

  // Update existing config
  const updateCurrentConfig = useCallback(async () => {
    if (!currentConfigId) return;
    
    const updatedConfigs = savedConfigs.map(config =>
      config.id === currentConfigId
        ? {
            ...config,
            offerItemIds: selectedOfferItemIds,
            requestItemIds: selectedRequestItemIds,
            tradeTags: tradeTags
          }
        : config
    );
    
    setSavedConfigs(updatedConfigs);
    
    await chrome.storage.local.set({
      savedConfigs: updatedConfigs
    });
  }, [currentConfigId, selectedOfferItemIds, selectedRequestItemIds, tradeTags, savedConfigs]);

  // Load a specific config
  const loadConfig = useCallback(async (configId: string) => {
    const config = savedConfigs.find(c => c.id === configId);
    if (!config) return;
    
    setSelectedOfferItemIds(config.offerItemIds);
    setSelectedRequestItemIds(config.requestItemIds);
    setTradeTags(config.tradeTags);
    setCurrentConfigId(configId);
    
    await chrome.storage.local.set({ currentConfigId: configId });
  }, [savedConfigs]);

  // Delete a config
  const deleteConfig = useCallback(async (configId: string) => {
    const updatedConfigs = savedConfigs.filter(c => c.id !== configId);
    setSavedConfigs(updatedConfigs);
    
    if (currentConfigId === configId) {
      const newCurrentId = updatedConfigs.length > 0 ? updatedConfigs[0].id : null;
      setCurrentConfigId(newCurrentId);
      
      if (newCurrentId) {
        await loadConfig(newCurrentId);
      }
      
      await chrome.storage.local.set({
        savedConfigs: updatedConfigs,
        currentConfigId: newCurrentId
      });
    } else {
      await chrome.storage.local.set({ savedConfigs: updatedConfigs });
    }
  }, [savedConfigs, currentConfigId, loadConfig]);

  // Initial data loading effect
  useEffect(() => {
    const initializeCoreData = async () => {
      loadAndDisplayCredentials();
      await loadRolimonsItems();
    };
    initializeCoreData();
  }, [loadAndDisplayCredentials, loadRolimonsItems]);

  // Effect to display avatar and inventory when robloxUserId changes
  useEffect(() => {
    if (robloxUserId !== null) {
      displayUserAvatar(robloxUserId);
      displayUserInventory(robloxUserId);
    }
  }, [robloxUserId, displayUserAvatar, displayUserInventory]);

  // Effect to load configs and selections
  useEffect(() => {
    if (allRolimonsItems.length > 0 && userInventory.length > 0) {
      loadConfigsAndSettings();
    }
  }, [allRolimonsItems, userInventory, loadConfigsAndSettings]);

  // Load plug detection settings
  const loadPlugSettings = useCallback(async () => {
    try {
      const response = await sendMessageToBackground({ action: "getPlugDetectionSettings" });
      if (response && response.status === "success") {
        setPlugSettings(response.settings || {});
        setPlugStats(response.stats || { permanent: 0, temporary: 0 });
        setPlugDetectionEnabled(response.settings?.enabled || false);
      }
    } catch (error) {
      console.error("[popup.tsx] Error loading plug settings:", error);
    }
  }, [sendMessageToBackground]);

  // Effect to load plug settings
  useEffect(() => {
    loadPlugSettings();
  }, [loadPlugSettings]);

  // Listen for plug detection messages and load persistent plugs
  useEffect(() => {
    // Load persistent plugs on mount
    chrome.storage.local.get(['recentPlugs'], (result) => {
      if (result.recentPlugs) {
        setFoundPlugs(result.recentPlugs);
      }
    });

    const messageListener = (message: any) => {
      if (message.action === 'plugsFound' && message.plugs) {
        setFoundPlugs(prev => {
          // Merge new plugs with previous, keeping unique by userId, most recent first, max 20
          const combined = [...message.plugs, ...prev];
          const unique = [];
          const seen = new Set();
          for (const plug of combined) {
            if (!seen.has(plug.userId)) {
              unique.push(plug);
              seen.add(plug.userId);
            }
            if (unique.length >= 20) break;
          }
          // Also update persistent storage
          chrome.storage.local.set({ recentPlugs: unique });
          return unique;
        });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  // Plug detection functions
  const startPlugDetection = async () => {
    setIsLoading(true);
    try {
      const response = await sendMessageToBackground({ action: "startPlugDetection" });
      if (response && response.status === "success") {
        setPlugDetectionEnabled(true);
        alert('Plug detection started!');
      } else {
        alert(`Failed to start plug detection: ${response?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Failed to start plug detection: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const stopPlugDetection = async () => {
    setIsLoading(true);
    try {
      const response = await sendMessageToBackground({ action: "stopPlugDetection" });
      if (response && response.status === "success") {
        setPlugDetectionEnabled(false);
        alert('Plug detection stopped!');
      } else {
        alert(`Failed to stop plug detection: ${response?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Failed to stop plug detection: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePlugSettings = async (newSettings: any) => {
    setIsLoading(true);
    try {
      const response = await sendMessageToBackground({
        action: "updatePlugDetectionSettings",
        settings: newSettings
      });
      if (response && response.status === "success") {
        setPlugSettings(response.settings);
        alert('Settings updated successfully!');
      } else {
        alert(`Failed to update settings: ${response?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Failed to update settings: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearIgnoreLists = async () => {
    if (!confirm('Are you sure you want to clear all ignore lists? This will allow previously ignored users to be detected again.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await sendMessageToBackground({ action: "clearPlugIgnoreLists" });
      if (response && response.status === "success") {
        setPlugStats({ permanent: 0, temporary: 0 });
        alert('Ignore lists cleared!');
      } else {
        alert(`Failed to clear ignore lists: ${response?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Failed to clear ignore lists: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Format value for display (38000 -> 38K, 1400000 -> 1.4M)
  const formatValue = (value: number | string | undefined): string => {
    if (!value || value === 0) return 'N/A';
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(numValue)) return 'N/A';
    if (numValue >= 1000000) {
      return `${(numValue / 1000000).toFixed(1)}M`;
    } else if (numValue >= 1000) {
      return `${(numValue / 1000).toFixed(0)}K`;
    }
    return numValue.toString();
  };

  // Filter and sort items based on search input
  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = allRolimonsItems.filter(item =>
      item.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      (item.alias && item.alias.toLowerCase().includes(lowerCaseSearchTerm))
    );
    
    // Sort by value (highest to lowest)
    const sorted = filtered.sort((a, b) => {
      const valueA = typeof a.value === 'number' ? a.value : 0;
      const valueB = typeof b.value === 'number' ? b.value : 0;
      return valueB - valueA;
    });
    
    setFilteredItems(sorted);
    setCurrentPage(1);
  }, [searchTerm, allRolimonsItems]);

  // Handle offer item toggle
  const handleOfferItemToggle = (userAssetId: number) => {
    setSelectedOfferItemIds(prevSelected => {
      const index = prevSelected.indexOf(userAssetId);
      let newSelected;
      if (index > -1) {
        newSelected = [...prevSelected];
        newSelected.splice(index, 1);
      } else {
        if (prevSelected.length < 4) {
          newSelected = [...prevSelected, userAssetId];
        } else {
          alert('You can select a maximum of 4 items to offer.');
          return prevSelected;
        }
      }
      chrome.storage.local.set({ selectedOfferItemIds: newSelected });
      return newSelected;
    });
  };

  // Handle request item toggle
  const handleRequestItemToggle = (itemId: number) => {
    setSelectedRequestItemIds(prevSelected => {
      const index = prevSelected.indexOf(itemId);
      let newSelected;
      if (index > -1) {
        newSelected = [...prevSelected];
        newSelected.splice(index, 1);
      } else {
        // Check constraint: total tags + request items <= 4 (any counts as 1)
        const totalRequestItems = prevSelected.length + tradeTags.length;
        if (totalRequestItems < 4) {
          newSelected = [...prevSelected, itemId];
        } else {
          alert('You can select a maximum of 4 items total (including tags).');
          return prevSelected;
        }
      }
      chrome.storage.local.set({ selectedSearchItemIds: newSelected });
      return newSelected;
    });
  };

  // Handle tag toggle
  const handleTagToggle = (tag: string) => {
    setTradeTags(prevTags => {
      const index = prevTags.indexOf(tag);
      let newTags;
      
      if (index > -1) {
        // Remove the tag
        newTags = prevTags.filter(t => t !== tag);
        // Don't default back to "any" - allow empty tag selection
      } else {
        // Add the tag if constraint allows
        const totalRequestItems = selectedRequestItemIds.length + prevTags.length;
        if (totalRequestItems < 4) {
          newTags = [...prevTags, tag];
        } else {
          alert('You can select a maximum of 4 items total (including tags).');
          return prevTags;
        }
      }
      chrome.storage.local.set({ tradeTags: newTags });
      return newTags;
    });
  };

  // Auto trade functions
  const startAutotrade = async () => {
    if (isNaN(tradeInterval) || tradeInterval <= 0) {
      alert('Please enter a valid trade interval (a positive number in minutes).');
      return;
    }

    if (selectedOfferItemIds.length === 0) {
      alert('Please select at least one item to offer.');
      return;
    }

    setIsLoading(true);
    try {
      const offerItemIdsForTrade = selectedOfferItemIds.map(userAssetId => {
        const item = userInventory.find(i => i.userAssetId === userAssetId);
        return item ? item.id : null;
      }).filter(id => id !== null) as number[];

      const tradeConfig: TradeConfig = {
        offerItemIds: offerItemIdsForTrade,
        requestItemIds: selectedRequestItemIds,
        tradeTags: tradeTags
      };

      const response = await sendMessageToBackground({ action: "startAutoTrade", tradeConfig: tradeConfig, interval: tradeInterval });
      if (response && response.status === "started") {
        alert(`Autotrade started with ${tradeInterval} minute interval!`);
      } else {
        alert(`Failed to start autotrade: ${response?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Failed to start autotrade: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const pauseAutotrade = async () => {
    setIsLoading(true);
    try {
      const response = await sendMessageToBackground({ action: "stopAutoTrade" });
      if (response && response.status === "stopped") {
        alert('Autotrade paused!');
      } else {
        alert(`Failed to pause autotrade: ${response?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Failed to pause autotrade: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCredentials = async () => {
    setIsLoading(true);
    try {
      const response = await sendMessageToBackground({ action: "fetchCredentials" });
      if (response && response.status === "success") {
        alert('Credentials fetched and saved successfully!');
        loadAndDisplayCredentials();
      } else {
        alert(`Failed to fetch credentials: ${response?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Failed to fetch credentials: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetConfig = useCallback(async () => {
    // Sort inventory by value (descending) and get top 4 items
    const sortedInventory = [...userInventory].sort((a, b) => {
      const valueA = typeof a.value === 'number' ? a.value : 0;
      const valueB = typeof b.value === 'number' ? b.value : 0;
      return valueB - valueA;
    });
    
    const top4Items = sortedInventory.slice(0, 4).map(item => item.userAssetId);
    
    await chrome.storage.local.set({
      selectedOfferItemIds: top4Items,
      selectedSearchItemIds: [],
      tradeTags: ["any"]
    });
    
    setSelectedOfferItemIds(top4Items);
    setSelectedRequestItemIds([]);
    setTradeTags(["any"]);
    alert(`Trade configuration reset to default with top ${top4Items.length} most valuable items selected.`);
  }, [userInventory]);

  // Render paginated items
  const renderItems = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToRender = filteredItems.slice(startIndex, endIndex);

    if (itemsToRender.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>No items found.</p>
        </div>
      );
    }

    return itemsToRender.map(item => (
      <div
        key={item.id}
        className={`item-card ${selectedRequestItemIds.includes(item.id) ? "selected" : ""}`}
        onClick={() => handleRequestItemToggle(item.id)}
      >
        <img 
          src={item.thumbnailUrl || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='} 
          alt={item.name}
          className="w-12 h-12 rounded-lg object-cover mr-3"
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">{item.name}</h4>
          <p className="text-sm text-gray-500">Value: {formatValue(item.value)}</p>
        </div>
      </div>
    ));
  };

  // Tab navigation
  const tabs = [
    { id: "control", label: "Control", icon: "⚙️" },
    { id: "inventory", label: "Inventory", icon: "🎒" },
    { id: "search", label: "Search", icon: "🔍" },
    { id: "config", label: "Config", icon: "📋" },
    { id: "plugs", label: "Plugs", icon: "🔥" },
    { id: "settings", label: "Settings", icon: "⚙️" }
  ];

  return (
    <div className="w-96 h-[600px] bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          {userAvatarUrl ? (
            <img 
              src={userAvatarUrl} 
              alt="User Avatar" 
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-sm">👤</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">Trade Ad Poster</h1>
            <p className="text-sm text-gray-600 truncate">{userName}</p>
          </div>
          <div className="flex-shrink-0">
            <div className={`w-3 h-3 rounded-full ${robloxUserId && rolimonsVerificationToken ? 'bg-green-400' : 'bg-red-400'}`}></div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <nav className="flex space-x-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex flex-col items-center space-y-1">
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "control" && (
          <div className="space-y-4">
            {/* Config Management */}
            <div className="card p-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-gray-700">Trade Configs</h4>
                <button
                  onClick={async () => {
                    const configName = prompt("Enter config name:");
                    if (configName && configName.trim()) {
                      await saveCurrentConfig(configName.trim());
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Save Current
                </button>
              </div>
              
              {savedConfigs.length > 0 ? (
                <>
                  <select
                    value={currentConfigId || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        loadConfig(e.target.value);
                      }
                    }}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="">Select a config...</option>
                    {savedConfigs.map(config => (
                      <option key={config.id} value={config.id}>
                        {config.name}
                      </option>
                    ))}
                  </select>
                  {currentConfigId && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => deleteConfig(currentConfigId)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Delete Config
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-500">No saved configs. Save your current configuration to get started!</p>
              )}
            </div>

            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Auto Poster</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="tradeInterval" className="block text-sm font-medium text-gray-700 mb-2">
                    Trade Interval (minutes)
                  </label>
                  <input
                    type="number"
                    id="tradeInterval"
                    value={tradeInterval}
                    onChange={(e) => setTradeInterval(parseInt(e.target.value, 10))}
                    min="1"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={startAutotrade}
                    disabled={isLoading}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Starting...' : 'Start Poster'}
                  </button>
                  <button
                    onClick={pauseAutotrade}
                    disabled={isLoading}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Pausing...' : 'Pause Poster'}
                  </button>
                </div>
              </div>
            </div>


            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Configuration</h3>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-1">Offering ({selectedOfferItemIds.length})</h4>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(index => {
                        const userAssetId = selectedOfferItemIds[index];
                        const item = userAssetId ? userInventory.find(i => i.userAssetId === userAssetId) : null;
                        
                        return (
                          <div key={`offer-${index}`} className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                            {item ? (
                              <img
                                src={item.imageUrl || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}
                                alt={item.name}
                                className="w-8 h-8 rounded object-cover"
                              />
                            ) : (
                              <div className="w-4 h-4 bg-gray-300 rounded"></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-1">Requesting ({selectedRequestItemIds.length})</h4>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(index => {
                        const itemId = selectedRequestItemIds[index];
                        const item = itemId ? allRolimonsItems.find(i => i.id === itemId) : null;
                        
                        // If no item for this slot, check if we should show a tag
                        if (!item) {
                          const tagIndex = index - selectedRequestItemIds.length;
                          if (tagIndex >= 0 && tagIndex < tradeTags.length) {
                            return (
                              <div key={`tag-box-${index}`} className="w-10 h-10 bg-blue-50 rounded border border-blue-200 flex items-center justify-center p-0.5">
                                <span className="text-[8px] font-bold text-blue-600 text-center leading-none truncate max-w-full">
                                  {tradeTags[tagIndex]}
                                </span>
                              </div>
                            );
                          }
                          // Empty slot
                          return (
                            <div key={`empty-${index}`} className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                              <div className="w-4 h-4 bg-gray-300 rounded"></div>
                            </div>
                          );
                        }
                        
                        // Show item
                        return (
                          <div key={`req-${index}`} className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                            <img
                              src={item.thumbnailUrl || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}
                              alt={item.name}
                              className="w-8 h-8 rounded object-cover"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Your Inventory</h3>
              <span className="text-sm text-gray-500">{userInventory.length} items</span>
            </div>

            {inventoryLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading inventory...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userInventory.length > 0 ? (
                  userInventory.map(item => (
                    <div
                      key={item.userAssetId}
                      className={`item-card ${selectedOfferItemIds.includes(item.userAssetId) ? "selected" : ""}`}
                      onClick={() => handleOfferItemToggle(item.userAssetId)}
                    >
                      <img 
                        src={item.imageUrl || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='} 
                        alt={item.name}
                        className="w-12 h-12 rounded-lg object-cover mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">{item.name}</h4>
                        <p className="text-sm text-gray-500">Value: {formatValue(item.value)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No inventory items found.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "search" && (
          <div className="space-y-4">
            {/* Selected Items Section */}
            {selectedRequestItemIds.length > 0 && (
              <div className="card p-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Selected Items ({selectedRequestItemIds.length})</h4>
                  <button
                    onClick={() => {
                      setSelectedRequestItemIds([]);
                      chrome.storage.local.set({ selectedSearchItemIds: [] });
                    }}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedRequestItemIds.map(itemId => {
                    const item = allRolimonsItems.find(i => i.id === itemId);
                    return item ? (
                      <div key={item.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                        <img
                          src={item.thumbnailUrl || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}
                          alt={item.name}
                          className="w-6 h-6 rounded object-cover"
                        />
                        <span className="text-xs font-medium text-blue-800 truncate max-w-20">{item.name}</span>
                        <button
                          onClick={() => handleRequestItemToggle(itemId)}
                          className="text-blue-600 hover:text-blue-800 ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="itemSearch" className="block text-sm font-medium text-gray-700 mb-2">
                Search Items (sorted by value)
              </label>
              <input
                type="text"
                id="itemSearch"
                placeholder="Search by name or alias..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              {renderItems()}
            </div>

            {filteredItems.length > itemsPerPage && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {Math.ceil(filteredItems.length / itemsPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredItems.length / itemsPerPage), prev + 1))}
                  disabled={currentPage === Math.ceil(filteredItems.length / itemsPerPage)}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "config" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Config Builder</h3>
              <div className="flex gap-2">
                {currentConfigId ? (
                  // Editing existing config
                  <>
                    <button
                      onClick={updateCurrentConfig}
                      className="btn-secondary text-sm px-3 py-1"
                    >
                      Update
                    </button>
                    <button
                      onClick={async () => {
                        const configName = prompt("Save as new config:");
                        if (configName?.trim()) await saveCurrentConfig(configName.trim());
                      }}
                      className="btn-secondary text-sm px-3 py-1"
                    >
                      Save As
                    </button>
                  </>
                ) : (
                  // Creating new config
                  <button
                    onClick={async () => {
                      const configName = prompt("Save new config as:");
                      if (configName?.trim()) await saveCurrentConfig(configName.trim());
                    }}
                    className="btn-secondary text-sm px-3 py-1"
                  >
                    Save New
                  </button>
                )}
                <button
                  onClick={() => {
                    resetConfig();
                    setCurrentConfigId(null);
                  }}
                  className="btn-secondary text-sm px-3 py-1"
                >
                  New
                </button>
              </div>
            </div>

            {/* Load Config */}
            {savedConfigs.length > 0 && (
              <select
                value={currentConfigId || ""}
                onChange={(e) => e.target.value && loadConfig(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-white"
              >
                <option value="">Load a saved config...</option>
                {savedConfigs.map(config => (
                  <option key={config.id} value={config.id}>{config.name}</option>
                ))}
              </select>
            )}

            {/* Offering Section */}
            <div className="card p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-gray-700">
                  Offering ({selectedOfferItemIds.length}/4)
                </h4>
                <button
                  onClick={() => setActiveTab("inventory")}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add Items
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 min-h-[80px]">
                {selectedOfferItemIds.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedOfferItemIds.map(userAssetId => {
                      const item = userInventory.find(i => i.userAssetId === userAssetId);
                      return item ? (
                        <div key={userAssetId} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-2">
                          <img src={item.imageUrl || ''} alt="" className="w-8 h-8 rounded flex-shrink-0" />
                          <span className="text-xs text-gray-800 truncate flex-1 min-w-0">{item.name}</span>
                          <button
                            onClick={() => handleOfferItemToggle(userAssetId)}
                            className="text-red-500 hover:text-red-700 flex-shrink-0 w-4 h-4 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[60px]">
                    <span className="text-sm text-gray-500 text-center">Click "+ Add Items" to select items from your inventory</span>
                  </div>
                )}
              </div>
            </div>

            {/* Requesting Section */}
            <div className="card p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-gray-700">
                  Requesting ({selectedRequestItemIds.length + tradeTags.length}/4)
                </h4>
                <button
                  onClick={() => setActiveTab("search")}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add Items
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 min-h-[80px]">
                {(selectedRequestItemIds.length > 0 || tradeTags.length > 0) ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedRequestItemIds.map(itemId => {
                      const item = allRolimonsItems.find(i => i.id === itemId);
                      return item ? (
                        <div key={itemId} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-2">
                          <img src={item.thumbnailUrl || ''} alt="" className="w-8 h-8 rounded flex-shrink-0" />
                          <span className="text-xs text-gray-800 truncate flex-1 min-w-0">{item.name}</span>
                          <button
                            onClick={() => handleRequestItemToggle(itemId)}
                            className="text-red-500 hover:text-red-700 flex-shrink-0 w-4 h-4 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
                    {tradeTags.map(tag => (
                      <div key={tag} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-3 py-2">
                        <span className="text-xs text-blue-800 font-medium flex-1 text-center">{tag}</span>
                        <button
                          onClick={() => handleTagToggle(tag)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 ml-2 w-4 h-4 flex items-center justify-center rounded-full transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[60px]">
                    <span className="text-sm text-gray-500 text-center">Click "+ Add Items" to search for items, or use tags below</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags Section */}
            <div className="card p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Trade Tags</h4>
              <div className="grid grid-cols-2 gap-2">
                {availableTags.map(tag => {
                  const isSelected = tradeTags.includes(tag);
                  const canSelect = isSelected || (selectedRequestItemIds.length + tradeTags.length) < 4;
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagToggle(tag)}
                      disabled={!canSelect}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors font-medium ${
                        isSelected
                          ? 'bg-blue-600 text-white border-2 border-blue-600'
                          : canSelect
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-2 border-transparent hover:border-gray-300'
                          : 'bg-gray-50 text-gray-400 border-2 border-transparent cursor-not-allowed'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "plugs" && (
          <div className="space-y-4">
            {/* Plug Detection Control */}
            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Plug Detection</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Status</p>
                    <p className="text-sm text-gray-500">{plugDetectionEnabled ? 'Running' : 'Stopped'}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${plugDetectionEnabled ? 'bg-green-400' : 'bg-red-400'}`}></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={startPlugDetection}
                    disabled={isLoading || plugDetectionEnabled}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Starting...' : 'Start Detection'}
                  </button>
                  <button
                    onClick={stopPlugDetection}
                    disabled={isLoading || !plugDetectionEnabled}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Stopping...' : 'Stop Detection'}
                  </button>
                </div>
              </div>
            </div>

            {/* Detection Settings */}
            <div className="card p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Detection Settings</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Max Trade Ads</label>
                  <input
                    type="number"
                    value={plugSettings.maxTradeAds || 100}
                    onChange={(e) => setPlugSettings(prev => ({ ...prev, maxTradeAds: parseInt(e.target.value) }))}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    min="1"
                    max="1000"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Scan Interval (seconds)</label>
                  <input
                    type="number"
                    value={plugSettings.fetchInterval || 30}
                    onChange={(e) => setPlugSettings(prev => ({ ...prev, fetchInterval: parseInt(e.target.value) }))}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    min="10"
                    max="300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Min Trade Value</label>
                  <input
                    type="number"
                    value={plugSettings.minValue || 10000}
                    onChange={(e) => setPlugSettings(prev => ({ ...prev, minValue: parseInt(e.target.value) }))}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    min="1000"
                    step="1000"
                  />
                </div>

                <button
                  onClick={() => updatePlugSettings(plugSettings)}
                  disabled={isLoading}
                  className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Updating...' : 'Update Settings'}
                </button>
              </div>
            </div>

            {/* Statistics */}
            <div className="card p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Statistics</h4>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{plugStats.permanent || 0}</p>
                  <p className="text-xs text-gray-500">Permanent Ignores</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{plugStats.temporary || 0}</p>
                  <p className="text-xs text-gray-500">Temporary Ignores</p>
                </div>
              </div>

              <button
                onClick={clearIgnoreLists}
                disabled={isLoading}
                className="btn-secondary w-full text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Clearing...' : 'Clear Ignore Lists'}
              </button>
            </div>

            {/* Found Plugs */}
            <div className="card p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Plugs Found ({foundPlugs.length})</h4>
              
              {foundPlugs.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {foundPlugs.map((plug, index) => (
                    <div key={index} className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-medium text-gray-900">{plug.username}</h5>
                        <span className="text-xs text-orange-600 font-medium">{plug.tradeAdCount} ads</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">Value: {plug.totalValue?.toLocaleString() || 'N/A'}</p>
                      <div className="flex gap-2">
                        <a
                          href={`https://www.rolimons.com/player/${plug.userId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Profile
                        </a>
                        <a
                          href={`https://www.roblox.com/users/${plug.userId}/trade`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 hover:text-green-800 underline"
                        >
                          Send Trade
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No plugs found yet.</p>
                  <p className="text-xs">Start detection to find potential trades!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Credentials</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Roblox User ID</p>
                    <p className="text-sm text-gray-500">{robloxUserId !== null ? robloxUserId : 'Not set'}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${robloxUserId ? 'bg-green-400' : 'bg-red-400'}`}></div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Rolimons Token</p>
                    <p className="text-sm text-gray-500">{rolimonsVerificationToken ? 'Set' : 'Not set'}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${rolimonsVerificationToken ? 'bg-green-400' : 'bg-red-400'}`}></div>
                </div>

                <button
                  onClick={fetchCredentials}
                  disabled={isLoading}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Fetching...' : 'Fetch Credentials'}
                </button>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Auto Cycle Configs</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Auto Cycle Through Configs</p>
                    <p className="text-sm text-gray-500">Automatically switch between saved configs when posting</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCycleEnabled}
                      onChange={async (e) => {
                        setAutoCycleEnabled(e.target.checked);
                        await chrome.storage.local.set({ autoCycleEnabled: e.target.checked });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                {autoCycleEnabled && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <div className="text-blue-600 mr-2">ℹ️</div>
                      <div>
                        <p className="text-sm font-medium text-blue-800">Auto Cycle Active</p>
                        <p className="text-sm text-blue-600">
                          Will cycle through {savedConfigs.length} saved configs when posting.
                          {savedConfigs.length === 0 && " Create some configs first!"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">About</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>Trade Ad Poster v1.0</p>
                <p>Automate your Rolimons trading experience with ease.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IndexPopup;
