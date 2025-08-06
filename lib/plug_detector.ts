/**
 * Plug Detection Service for finding users with low trade ad counts
 * Adapted from Discord bot example for Chrome extension
 */

export interface PlugUser {
  userId: number;
  username: string;
  tradeAdCount: number;
  tradeAd: RecentTradeAd;
  totalValue: number;
  avatarUrl?: string;
  timestamp: number;
  lastChecked?: number; // Timestamp of when this user's trade ad count was last checked
}

export interface RecentTradeAd {
  id: number;
  userId: number;
  username: string;
  offerItems: number[];
  requestItems: number[];
  tags: string[];
  timestamp: number;
}

// Tag number-to-name mapping
const TAG_MAP: Record<string, string> = {
  "1": "Limited",
  "2": "Rare",
  "3": "Event",
  "4": "Demand",
  "5": "Upgrade",
  "6": "Downgrade",
  "7": "Collector",
  "8": "Proof",
  "9": "Quick",
  "10": "Other"
};

export interface PlugDetectionSettings {
  maxTradeAds: number;
  fetchInterval: number; // in seconds
  tempIgnoreDays: number;
  enabled: boolean;
  minValue: number; // minimum trade value to consider
  cacheDurationHours: number; // Duration to cache user trade ad counts in hours
}

export interface IgnoredUser {
  userId: number;
  username: string;
  addedDate: string;
  tradeAdCount: number;
}

export interface CachedUserTradeAdCount {
  userId: number;
  tradeAdCount: number;
  timestamp: number; // Timestamp when the count was fetched
}

export class PlugDetector {
  private settings: PlugDetectionSettings;
  private rolimonsItemDetails: Record<number, any> = {};
  private permanentIgnoreList: Set<number> = new Set();
  private temporaryIgnoreList: Map<number, IgnoredUser> = new Map();
  private userTradeAdCache: Map<number, CachedUserTradeAdCount> = new Map();
  private isRunning: boolean = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(settings: PlugDetectionSettings) {
    this.settings = settings;
    this.loadIgnoreLists();
  }

  async initialize(): Promise<void> {
    console.log("[PlugDetector] Initializing...");
    await this.loadRolimonsItems();
    await this.cleanTemporaryIgnoreList();
    await this.loadUserTradeAdCache();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[PlugDetector] Already running");
      return;
    }

    console.log("[PlugDetector] Starting plug detection...");
    this.isRunning = true;

    // Run immediately
    await this.scanForPlugs();

    // Set up interval
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.scanForPlugs();
      }
    }, this.settings.fetchInterval * 1000);
  }

  stop(): void {
    console.log("[PlugDetector] Stopping plug detection...");
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async loadRolimonsItems(): Promise<void> {
    try {
      const response = await fetch("https://www.rolimons.com/itemapi/itemdetails");
      if (response.ok) {
        const data = await response.json();
        const items = data.items || {};
        
        this.rolimonsItemDetails = {};
        for (const [itemId, details] of Object.entries(items) as [string, any][]) {
          this.rolimonsItemDetails[parseInt(itemId)] = {
            name: details[0],
            acronym: details[1] || "",
            value: details[4] || 0
          };
        }
        
        console.log(`[PlugDetector] Loaded ${Object.keys(this.rolimonsItemDetails).length} items`);
      }
    } catch (error) {
      console.error("[PlugDetector] Failed to load item details:", error);
    }
  }

  private async getRecentTradeAds(): Promise<RecentTradeAd[]> {
    try {
      const response = await fetch("https://api.rolimons.com/tradeads/v1/getrecentads");
      if (response.ok) {
        const data = await response.json();
        const tradeAds = data.trade_ads || [];
        
        return tradeAds.map((ad: any) => {
          // Tags can be in offer or request object
          const offerTags = ad[4]?.tags || [];
          const requestTags = ad[5]?.tags || [];
          const rawTags = Array.from(new Set([...(ad[6] || []), ...offerTags, ...requestTags]));
          // Convert tag numbers to names if possible
          const tags = rawTags.map(tag =>
            TAG_MAP[tag] ? TAG_MAP[tag] : tag
          );
          return {
            id: ad[0],
            userId: ad[2],
            username: ad[3],
            offerItems: ad[4]?.items || [],
            requestItems: ad[5]?.items || [],
            tags,
            timestamp: Date.now()
          };
        });
      }
    } catch (error) {
      console.error("[PlugDetector] Error fetching recent trade ads:", error);
    }
    return [];
  }

  private async getUserTradeAdCount(userId: number): Promise<number | null> {
    const cached = this.userTradeAdCache.get(userId);
    const now = Date.now();
    const cacheDurationMs = this.settings.cacheDurationHours * 60 * 60 * 1000;

    if (cached && (now - cached.timestamp < cacheDurationMs)) {
      // console.log(`[PlugDetector] Using cached trade ad count for user ${userId}`);
      return cached.tradeAdCount;
    }

    try {
      const response = await fetch(`https://www.rolimons.com/player/${userId}`);
      if (response.ok) {
        const html = await response.text();

        let match: RegExpMatchArray | null = null;

        match = html.match(/trade-ads-created-container[\s\S]*?stat-data[^>]*>([\d,]+)/i);
        if (match && match[1]) {
          const count = parseInt(match[1].replace(/,/g, ''));
          this.userTradeAdCache.set(userId, { userId, tradeAdCount: count, timestamp: now });
          this.saveUserTradeAdCache();
          return count;
        }

        match = html.match(/Trade Ads Created<\/h6>\s*<span[^>]*>([\d,]+)/i);
        if (match && match[1]) {
          const count = parseInt(match[1].replace(/,/g, ''));
          this.userTradeAdCache.set(userId, { userId, tradeAdCount: count, timestamp: now });
          this.saveUserTradeAdCache();
          return count;
        }

        match = html.match(/stat-data[^>]*>([\d,]+)/i);
        if (match && match[1]) {
          const count = parseInt(match[1].replace(/,/g, ''));
          this.userTradeAdCache.set(userId, { userId, tradeAdCount: count, timestamp: now });
          this.saveUserTradeAdCache();
          return count;
        }
      }
    } catch (error) {
      console.error(`[PlugDetector] Error checking user ${userId}:`, error);
    }
    return null;
  }

  private calculateTradeValue(items: number[]): number {
    return items.reduce((total, itemId) => {
      const item = this.rolimonsItemDetails[itemId];
      return total + (item?.value || 0);
    }, 0);
  }

  private shouldIgnoreUser(userId: number): boolean {
    return this.permanentIgnoreList.has(userId) || this.temporaryIgnoreList.has(userId);
  }

  private addToPermanentIgnore(userId: number): void {
    this.permanentIgnoreList.add(userId);
    this.saveIgnoreLists();
  }

  private addToTemporaryIgnore(user: IgnoredUser): void {
    this.temporaryIgnoreList.set(user.userId, user);
    this.saveIgnoreLists();
  }

  private async cleanTemporaryIgnoreList(): Promise<void> {
    const currentTime = new Date();
    const toRemove: number[] = [];

    for (const [userId, user] of this.temporaryIgnoreList.entries()) {
      try {
        const addedDate = new Date(user.addedDate);
        const daysDiff = (currentTime.getTime() - addedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff >= this.settings.tempIgnoreDays) {
          toRemove.push(userId);
        }
      } catch (error) {
        toRemove.push(userId);
      }
    }

    for (const userId of toRemove) {
      this.temporaryIgnoreList.delete(userId);
    }

    if (toRemove.length > 0) {
      this.saveIgnoreLists();
      console.log(`[PlugDetector] Cleaned ${toRemove.length} expired temporary ignores`);
    }
  }

  private async loadIgnoreLists(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(['plugDetector_permanentIgnore', 'plugDetector_temporaryIgnore']);
      
      if (stored.plugDetector_permanentIgnore) {
        this.permanentIgnoreList = new Set(stored.plugDetector_permanentIgnore);
      }
      
      if (stored.plugDetector_temporaryIgnore) {
        this.temporaryIgnoreList = new Map(Object.entries(stored.plugDetector_temporaryIgnore).map(([k, v]) => [parseInt(k), v as IgnoredUser]));
      }
    } catch (error) {
      console.error("[PlugDetector] Error loading ignore lists:", error);
    }
  }

  private async saveIgnoreLists(): Promise<void> {
    try {
      const permanentArray = Array.from(this.permanentIgnoreList);
      const temporaryObject = Object.fromEntries(this.temporaryIgnoreList);
      
      await chrome.storage.local.set({
        plugDetector_permanentIgnore: permanentArray,
        plugDetector_temporaryIgnore: temporaryObject
      });
    } catch (error) {
      console.error("[PlugDetector] Error saving ignore lists:", error);
    }
  }

  private async loadUserTradeAdCache(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(['plugDetector_userTradeAdCache']);
      if (stored.plugDetector_userTradeAdCache) {
        this.userTradeAdCache = new Map(Object.entries(stored.plugDetector_userTradeAdCache).map(([k, v]) => [parseInt(k), v as CachedUserTradeAdCount]));
      }
    } catch (error) {
      console.error("[PlugDetector] Error loading user trade ad cache:", error);
    }
  }

  private async saveUserTradeAdCache(): Promise<void> {
    try {
      const cacheObject = Object.fromEntries(this.userTradeAdCache);
      await chrome.storage.local.set({
        plugDetector_userTradeAdCache: cacheObject
      });
    } catch (error) {
      console.error("[PlugDetector] Error saving user trade ad cache:", error);
    }
  }

  private async scanForPlugs(): Promise<PlugUser[]> {
    console.log(`[PlugDetector] ${new Date().toLocaleTimeString()} - Scanning for plugs...`);
    
    const recentAds = await this.getRecentTradeAds();
    if (recentAds.length === 0) {
      console.log("[PlugDetector] No recent trade ads found");
      return [];
    }

    // Load persistent recent plugs list
    let persistentPlugs: PlugUser[] = [];
    try {
      const stored = await chrome.storage.local.get(['recentPlugs']);
      persistentPlugs = stored.recentPlugs || [];
    } catch {}

    const foundPlugsMap = new Map<number, PlugUser>();
    const checkedUsers = new Set<number>();
    
    for (const ad of recentAds) {
      // Skip if already checked this user in this scan
      if (checkedUsers.has(ad.userId)) continue;
      checkedUsers.add(ad.userId);
    
      // Skip if user is in ignore list
      if (this.shouldIgnoreUser(ad.userId)) continue;
    
      // Calculate trade value
      const totalValue = this.calculateTradeValue(ad.offerItems);
      
      // Skip if trade value is below minimum
      if (totalValue < this.settings.minValue) continue;
    
      // Check user's trade ad count
      const tradeAdCount = await this.getUserTradeAdCount(ad.userId);
      
      if (tradeAdCount === null) continue;
    
      if (tradeAdCount <= this.settings.maxTradeAds) {
        // Found a plug!
        const plugUser: PlugUser = {
          userId: ad.userId,
          username: ad.username,
          tradeAdCount,
          tradeAd: ad,
          totalValue,
          timestamp: Date.now()
        };
    
        foundPlugsMap.set(ad.userId, plugUser);
    
        // Add to persistent recent plugs list (keep last 20, dedup by userId)
        persistentPlugs = [plugUser, ...persistentPlugs.filter(p => p.userId !== ad.userId)];
        if (persistentPlugs.length > 20) persistentPlugs = persistentPlugs.slice(0, 20);
        await chrome.storage.local.set({ recentPlugs: persistentPlugs });
    
        console.log(`[PlugDetector] Found plug: ${ad.username} (${tradeAdCount} trade ads, ${totalValue} value)`);
      } else {
        // User has too many trade ads, add to permanent ignore
        this.addToPermanentIgnore(ad.userId);
      }
    
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000)); // Increased delay to 5000ms (5 seconds)
    }
    
    const foundPlugs = Array.from(foundPlugsMap.values());

    if (foundPlugs.length > 0) {
      // Notify about found plugs
      this.notifyPlugsFound(foundPlugs);
    }

    return foundPlugs;
  }

  private notifyPlugsFound(plugs: PlugUser[]): void {
    for (const plug of plugs) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('/icon48.plasmo.aced7582.png'),
        title: `🔥 Plug Found: ${plug.username}`,
        message: `${plug.tradeAdCount} trade ads • ${plug.totalValue.toLocaleString()} value`,
        priority: 2
      });
    }

    // Also send to popup if it's listening
    chrome.runtime.sendMessage({
      action: 'plugsFound',
      plugs: plugs
    }).catch(() => {
      // Popup might not be open, that's fine
    });
  }

  updateSettings(newSettings: Partial<PlugDetectionSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // Restart if interval changed and running
    if (this.isRunning && newSettings.fetchInterval) {
      this.stop();
      this.start();
    }
  }

  getSettings(): PlugDetectionSettings {
    return { ...this.settings };
  }

  getIgnoreListStats(): { permanent: number; temporary: number } {
    return {
      permanent: this.permanentIgnoreList.size,
      temporary: this.temporaryIgnoreList.size
    };
  }

  clearIgnoreLists(): void {
    this.permanentIgnoreList.clear();
    this.temporaryIgnoreList.clear();
    this.saveIgnoreLists();
  }
}

// Default settings
export const DEFAULT_PLUG_SETTINGS: PlugDetectionSettings = {
  maxTradeAds: 100,
  fetchInterval: 30, // 30 seconds
  tempIgnoreDays: 7,
  enabled: false,
  minValue: 10000, // 10K minimum value
  cacheDurationHours: 1 // Cache user trade ad counts for 1 hour
};