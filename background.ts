import { manualPostTradeAd } from "~lib/rolimons_poster";
import { getRolimonsItemDetails, getAllRolimonsItems } from "~lib/rolimons_item_api";
import { RobloxAPIService } from "~lib/roblox_api_service";
import { CacheService } from "~lib/cache_service"; // Import the new CacheService
import { Utils } from "~lib/utils"; // Import the new Utils service
import { PlugDetector, DEFAULT_PLUG_SETTINGS, type PlugDetectionSettings, type PlugUser } from "~lib/plug_detector";
import type { TradeConfig, RobloxItem, MessageRequest, MessageResponse } from "~types/messages";

console.log("[background.ts] Service worker script reloaded.");

// Initialize PlugDetector
let plugDetector: PlugDetector | null = null;

async function initializePlugDetector(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(['plugDetectorSettings']);
    const settings = stored.plugDetectorSettings || DEFAULT_PLUG_SETTINGS;
    
    plugDetector = new PlugDetector(settings);
    await plugDetector.initialize();
    
    if (settings.enabled) {
      await plugDetector.start();
      console.log("[background.ts] Plug detector started automatically");
      chrome.runtime.sendMessage({ action: 'plugDetectionStatusUpdate', isRunning: true }).catch(() => {});
    }
  } catch (error) {
    console.error("[background.ts] Error initializing plug detector:", error);
  }
}

// Initialize plug detector when service worker starts
initializePlugDetector();

// Function to post a trade ad
async function postTradeAdWrapper(tradeConfig: TradeConfig, robloxUserId: number, rolimonsVerificationToken: string): Promise<void> {
  console.log("[background.ts] Attempting to post trade ad...");
  if (!tradeConfig) {
    console.error("[background.ts] No trade configuration found.");
    return;
  }
  if (!robloxUserId || !rolimonsVerificationToken) {
    console.error("[background.ts] Roblox User ID or Rolimons Verification Token not found in storage. Please set them in the popup.");
    return;
  }

  let { offerItemIds, requestItemIds, tradeTags } = tradeConfig;
  const tradeNotes = ""; // Rolimons API expects tradeNotes, but it's not part of tradeConfig from popup.js

  // Apply randomization if more than 4 items are selected
  if (offerItemIds && offerItemIds.length > 4) {
    const shuffledOfferItemIds = Utils.shuffleArray([...offerItemIds]); // Use Utils.shuffleArray
    offerItemIds = shuffledOfferItemIds.slice(0, 4); // Take the first 4 random items
    console.log("[background.ts] More than 4 items selected. Randomly choosing 4 items to offer:", offerItemIds);
  } else if (!offerItemIds || offerItemIds.length === 0) {
    console.warn("[background.ts] No offer items selected. Skipping trade ad post.");
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('/icon48.plasmo.aced7582.png'),
      title: 'Trade Ad Skipped',
      message: 'No offer items selected. Please select items in the popup.',
      priority: 1
    });
    return;
  }

  try {
    const response = await manualPostTradeAd(
      robloxUserId,
      offerItemIds,
      requestItemIds,
      tradeNotes,
      tradeTags,
      rolimonsVerificationToken
    );
    console.log("[background.ts] Trade ad posted successfully:", response);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('/icon48.plasmo.aced7582.png'),
      title: 'Trade Ad Posted!',
      message: 'Your trade ad has been successfully posted on Rolimons.',
      priority: 2
    });
  } catch (error: any) {
    console.error("[background.ts] Error posting trade ad:", error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('/icon48.plasmo.aced7582.png'),
      title: 'Trade Ad Posting Failed',
      message: `Failed to post trade ad: ${error.message || error}`,
      priority: 2
    });
  }
}

// Function to fetch Rolimons Verification Token
async function fetchRolimonsVerificationToken(): Promise<string | null> {
  console.log("[background.ts] Attempting to fetch Rolimons Verification Token from cookies...");
  try {
    const cookie = await chrome.cookies.get({
      url: "https://www.rolimons.com",
      name: "_RoliVerification"
    });

    if (cookie && cookie.value) {
      console.log("[background.ts] Successfully fetched Rolimons Verification Token from cookies.");
      return cookie.value;
    } else {
      console.warn("[background.ts] Rolimons Verification Token cookie not found.");
      return null;
    }
  } catch (error) {
    console.error("[background.ts] Error fetching Rolimons Verification Token from cookies:", error);
    return null;
  }
}

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((request: MessageRequest, sender, sendResponse) => {
  console.log("[background.ts] Message received:", request);
  if (request.action === "startAutoTrade") {
    const { interval, tradeConfig } = request;
    console.log(`[background.ts] Starting auto-trade with interval: ${interval} minutes`);
    console.log("[background.ts] Trade configuration received from popup:", tradeConfig);
    chrome.alarms.create('autoTradeAlarm', { periodInMinutes: interval });
    chrome.storage.local.set({ autoTradeConfig: tradeConfig }, () => {
      console.log("[background.ts] Auto-trade configuration saved.");
    });
    sendResponse({ status: "started" } as MessageResponse);
  } else if (request.action === "stopAutoTrade") {
    console.log("[background.ts] Stopping auto-trade.");
    chrome.alarms.clear('autoTradeAlarm');
    sendResponse({ status: "stopped" } as MessageResponse);
  } else if (request.action === "postTradeAd") {
    (async () => {
      const storedConfig = await chrome.storage.local.get(['autoTradeConfig', 'robloxUserId', 'rolimonsVerificationToken']);
      console.log("[background.ts] Retrieved stored config for manual post:", storedConfig);
      const tradeConfig = storedConfig.autoTradeConfig as TradeConfig;
      const robloxUserId = storedConfig.robloxUserId as number;
      const rolimonsVerificationToken = storedConfig.rolimonsVerificationToken as string;
      await postTradeAdWrapper(tradeConfig, robloxUserId, rolimonsVerificationToken);
      sendResponse({ status: "posted" } as MessageResponse);
    })();
    return true; // Indicate that the response will be sent asynchronously
  } else if (request.action === "fetchCredentials") {
    (async () => {
      console.log("[background.ts] Fetching credentials...");
      const robloxUserId = await RobloxAPIService.fetchAuthenticatedUserId();
      const rolimonsVerificationToken = await fetchRolimonsVerificationToken();

      if (robloxUserId && rolimonsVerificationToken) {
        await chrome.storage.local.set({ robloxUserId, rolimonsVerificationToken });
        console.log("[background.ts] Credentials saved to storage:", { robloxUserId, rolimonsVerificationToken: rolimonsVerificationToken ? 'Set' : 'Not set' });
        sendResponse({ status: "success", robloxUserId, rolimonsVerificationToken } as MessageResponse);
      } else {
        console.warn("[background.ts] Failed to fetch one or both credentials. Not saving to storage.");
        sendResponse({ status: "failed", message: "Could not fetch one or both credentials. Please ensure you are logged into Roblox and Rolimons." } as MessageResponse);
      }
    })();
    return true; // Indicate that the response will be sent asynchronously
  } else if (request.action === "fetchUserAvatar") {
    (async () => {
      console.log("[background.ts] Fetching user avatar and username...");
      const robloxUserId = request.userId;
      if (!robloxUserId) {
        sendResponse({ status: "failed", message: "Roblox User ID not available." } as MessageResponse);
        return;
      }

      try {
        const { imageUrl, userName } = await RobloxAPIService.fetchUserAvatarAndUsername(robloxUserId);
        sendResponse({ status: "success", imageUrl, userName } as MessageResponse);
      } catch (error: any) {
        console.error("[background.ts] Error fetching user avatar or username:", error);
        sendResponse({ status: "failed", message: `Error fetching user profile: ${error.message}` } as MessageResponse);
      }
    })();
    return true; // Indicate that the response will be sent asynchronously
  } else if (request.action === "fetchUserInventory") {
    (async () => {
      console.log("[background.ts] Fetching user inventory...");
      const robloxUserId = request.userId;
      if (!robloxUserId) {
        sendResponse({ status: "failed", message: "Roblox User ID not available." } as MessageResponse);
        return;
      }

      try {
        const inventoryData = await RobloxAPIService.fetchUserCollectiblesInventory(robloxUserId);

        if (!inventoryData || inventoryData.length === 0) {
          sendResponse({ status: "success", inventory: [], message: "Inventory is empty or no collectible assets found." } as MessageResponse);
          return;
        }

        const itemIds = inventoryData.map((item: any) => item.assetId);
        console.log("[background.ts] Fetched Roblox inventory item IDs:", itemIds);

        // Fetch item images from Roblox, utilizing cache
        let itemImages = await CacheService.getCachedThumbnails(itemIds); // Use CacheService
        const uncachedItemIds = itemIds.filter((id: number) => !itemImages[id]);

        if (uncachedItemIds.length > 0) {
          console.log("[background.ts] Fetching uncached thumbnails for item IDs:", uncachedItemIds);
          const fetchedImages = await RobloxAPIService.fetchAssetThumbnails(uncachedItemIds);
          await CacheService.setCachedThumbnails(fetchedImages); // Use CacheService
          itemImages = { ...itemImages, ...fetchedImages }; // Merge with existing cached images
        } else {
          console.log("[background.ts] All thumbnails found in cache.");
        }
        console.log("[background.ts] Final Roblox item image URLs (including cached):", itemImages);

        // Fetch item details from Rolimons
        const rolimonsItemDetails = await getRolimonsItemDetails(itemIds);
        console.log("[background.ts] Fetched Rolimons item details:", rolimonsItemDetails);

        const userInventory: RobloxItem[] = inventoryData.map((item: any) => {
          const details = rolimonsItemDetails[item.assetId];
          return {
            id: item.assetId,
            userAssetId: item.userAssetId, // Correctly assign userAssetId
            name: details?.name || `Unknown Item ${item.assetId}`,
            value: details?.value || 'N/A',
            imageUrl: itemImages[item.assetId] || '' // Add image URL
          };
        });

        console.log("[background.ts] User inventory to be sent to popup:", userInventory);
        sendResponse({ status: "success", inventory: userInventory } as MessageResponse);
      } catch (error: any) {
        console.error("[background.ts] Error fetching user inventory:", error);
        sendResponse({ status: "failed", message: `Error fetching user inventory: ${error.message}` } as MessageResponse);
      }
    })();
    return true; // Indicate that the response will be sent asynchronously
  } else if (request.action === "fetchRolimonsItemThumbnails") {
    (async () => {
      console.log("[background.ts] Fetching Rolimons item thumbnails...");
      const itemIds = request.itemIds;
      if (!itemIds || itemIds.length === 0) {
        sendResponse({ status: "failed", message: "No item IDs provided for thumbnail fetching." } as MessageResponse);
        return;
      }

      try {
        let itemImages = await CacheService.getCachedThumbnails(itemIds); // Use CacheService
        const uncachedItemIds = itemIds.filter((id: number) => !itemImages[id]);

        if (uncachedItemIds.length > 0) {
          console.log("[background.ts] Fetching uncached thumbnails for Rolimons item IDs:", uncachedItemIds);
          const fetchedImages = await RobloxAPIService.fetchAssetThumbnails(uncachedItemIds);
          await CacheService.setCachedThumbnails(fetchedImages); // Use CacheService
          itemImages = { ...itemImages, ...fetchedImages };
        } else {
          console.log("[background.ts] All Rolimons item thumbnails found in cache.");
        }
        sendResponse({ status: "success", thumbnails: itemImages } as MessageResponse);
      } catch (error: any) {
        console.error("[background.ts] Error fetching Rolimons item thumbnails:", error);
        sendResponse({ status: "failed", message: `Error fetching Rolimons item thumbnails: ${error.message}` } as MessageResponse);
      }
    })();
    return true;
  } else if (request.action === "getRolimonsItemDetails") {
    (async () => {
      const itemIds = request.itemIds;
      if (!itemIds || itemIds.length === 0) {
        sendResponse({ status: "failed", message: "No item IDs provided for details." } as MessageResponse);
        return;
      }
      try {
        const details = await getRolimonsItemDetails(itemIds);
        sendResponse({ status: "success", itemDetails: details } as MessageResponse);
      } catch (error: any) {
        console.error("[background.ts] Error fetching specific Rolimons item details:", error);
        sendResponse({ status: "failed", message: `Error fetching item details: ${error.message}` } as MessageResponse);
      }
    })();
    return true;
  } else if (request.action === "getAllRolimonsItems") {
    (async () => {
      try {
        const allItems = await getAllRolimonsItems();
        sendResponse({ status: "success", allItems: allItems } as MessageResponse);
      } catch (error: any) {
        console.error("[background.ts] Error fetching all Rolimons items:", error);
        sendResponse({ status: "failed", message: `Error fetching all items: ${error.message}` } as MessageResponse);
      }
    })();
    return true;
  } else if (request.action === "startPlugDetection") {
    (async () => {
      if (!plugDetector) {
        sendResponse({ status: "failed", message: "Plug detector not initialized" } as MessageResponse);
        return;
      }
      
      try {
        await plugDetector.start();
        const settings = plugDetector.getSettings();
        await chrome.storage.local.set({ plugDetectorSettings: { ...settings, enabled: true } });
        console.log("[background.ts] Plug detection started");
        chrome.runtime.sendMessage({ action: 'plugDetectionStatusUpdate', isRunning: true }).catch(() => {});
        sendResponse({ status: "success", message: "Plug detection started" } as MessageResponse);
      } catch (error: any) {
        console.error("[background.ts] Error starting plug detection:", error);
        sendResponse({ status: "failed", message: `Error starting plug detection: ${error.message}` } as MessageResponse);
      }
    })();
    return true;
  } else if (request.action === "stopPlugDetection") {
    (async () => {
      if (!plugDetector) {
        sendResponse({ status: "failed", message: "Plug detector not initialized" } as MessageResponse);
        return;
      }
      
      try {
        plugDetector.stop();
        const settings = plugDetector.getSettings();
        await chrome.storage.local.set({ plugDetectorSettings: { ...settings, enabled: false } });
        console.log("[background.ts] Plug detection stopped");
        chrome.runtime.sendMessage({ action: 'plugDetectionStatusUpdate', isRunning: false }).catch(() => {});
        sendResponse({ status: "success", message: "Plug detection stopped" } as MessageResponse);
      } catch (error: any) {
        console.error("[background.ts] Error stopping plug detection:", error);
        sendResponse({ status: "failed", message: `Error stopping plug detection: ${error.message}` } as MessageResponse);
      }
    })();
    return true;
  } else if (request.action === "updatePlugDetectionSettings") {
    (async () => {
      if (!plugDetector) {
        sendResponse({ status: "failed", message: "Plug detector not initialized" } as MessageResponse);
        return;
      }
      
      try {
        const newSettings = request.settings as Partial<PlugDetectionSettings>;
        plugDetector.updateSettings(newSettings);
        const updatedSettings = plugDetector.getSettings();
        await chrome.storage.local.set({ plugDetectorSettings: updatedSettings });
        console.log("[background.ts] Plug detection settings updated");
        sendResponse({ status: "success", settings: updatedSettings } as MessageResponse);
      } catch (error: any) {
        console.error("[background.ts] Error updating plug detection settings:", error);
        sendResponse({ status: "failed", message: `Error updating settings: ${error.message}` } as MessageResponse);
      }
    })();
    return true;
  } else if (request.action === "getPlugDetectionSettings") {
    (async () => {
      if (!plugDetector) {
        sendResponse({ status: "failed", message: "Plug detector not initialized" } as MessageResponse);
        return;
      }
      
      try {
        const settings = plugDetector.getSettings();
        const stats = plugDetector.getIgnoreListStats();
        sendResponse({ status: "success", settings: settings, stats: stats } as MessageResponse);
      } catch (error: any) {
        console.error("[background.ts] Error getting plug detection settings:", error);
        sendResponse({ status: "failed", message: `Error getting settings: ${error.message}` } as MessageResponse);
      }
    })();
    return true;
  } else if (request.action === "clearPlugIgnoreLists") {
    (async () => {
      if (!plugDetector) {
        sendResponse({ status: "failed", message: "Plug detector not initialized" } as MessageResponse);
        return;
      }
      
      try {
        plugDetector.clearIgnoreLists();
        console.log("[background.ts] Plug detection ignore lists cleared");
        sendResponse({ status: "success", message: "Ignore lists cleared" } as MessageResponse);
      } catch (error: any) {
        console.error("[background.ts] Error clearing ignore lists:", error);
        sendResponse({ status: "failed", message: `Error clearing ignore lists: ${error.message}` } as MessageResponse);
      }
    })();
    return true;
  }
});

// Listen for the alarm to trigger
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autoTradeAlarm') {
    console.log("[background.ts] Auto-trade alarm triggered.");
    const storedData = await chrome.storage.local.get(['autoTradeConfig', 'robloxUserId', 'rolimonsVerificationToken', 'autoCycleEnabled', 'savedConfigs', 'currentConfigId', 'lastUsedConfigIndex']);
    console.log("[background.ts] Retrieved stored data:", storedData);
    
    let tradeConfig = storedData.autoTradeConfig as TradeConfig;
    const robloxUserId = storedData.robloxUserId as number;
    const rolimonsVerificationToken = storedData.rolimonsVerificationToken as string;

    // Handle auto-cycling through configs if enabled
    if (storedData.autoCycleEnabled && storedData.savedConfigs && storedData.savedConfigs.length > 0) {
      console.log("[background.ts] Autocycle enabled with", storedData.savedConfigs.length, "saved configs.");
      
      const lastIndex = storedData.lastUsedConfigIndex || 0;
      const nextIndex = (lastIndex + 1) % storedData.savedConfigs.length;
      
      console.log("[background.ts] Cycling from config index", lastIndex, "to", nextIndex);
      
      const selectedConfig = storedData.savedConfigs[nextIndex];
      console.log("[background.ts] Using config:", selectedConfig.name);
      
      // Update the last used config index
      await chrome.storage.local.set({ lastUsedConfigIndex: nextIndex });
      
      // Use the selected config
      tradeConfig = {
        offerItemIds: selectedConfig.offerItemIds || [],
        requestItemIds: selectedConfig.requestItemIds || [],
        tradeTags: selectedConfig.tradeTags || []
      };
    }

    console.log("[background.ts] Final tradeConfig to use:", tradeConfig);

    if (tradeConfig && robloxUserId && rolimonsVerificationToken) {
      console.log("[background.ts] Attempting to post trade ad...");
      await postTradeAdWrapper(tradeConfig, robloxUserId, rolimonsVerificationToken);
    } else {
      console.warn("[background.ts] Auto-trade skipped: Missing configuration or credentials.");
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('/icon48.plasmo.aced7582.png'),
        title: 'Auto-Trade Skipped',
        message: 'Auto-trade was skipped due to missing configuration or credentials. Please set them in the popup.',
        priority: 1
      });
    }
  }
});

// Initial setup: Clear any existing alarms when the service worker starts
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.clearAll();
  console.log("[background.ts] Auto-trade alarm cleared on installation.");
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.clearAll();
  console.log("[background.ts] Auto-trade alarm cleared on startup.");
});