/**
 * Service for managing thumbnail caching in Chrome local storage.
 */
export class CacheService {
  private static CACHE_KEY_PREFIX = 'thumbnail_cache_';
  private static CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Retrieves cached thumbnails for a given array of item IDs.
   * @param {number[]} itemIds - An array of item IDs.
   * @returns {Promise<Record<number, string>>} A promise that resolves to an object where keys are item IDs and values are their image URLs.
   */
  static async getCachedThumbnails(itemIds: number[]): Promise<Record<number, string>> {
    const cachedData = await chrome.storage.local.get(itemIds.map(id => CacheService.CACHE_KEY_PREFIX + id));
    const now = Date.now();
    const validCache: Record<number, string> = {};
    for (const id of itemIds) {
      const key = CacheService.CACHE_KEY_PREFIX + id;
      if (cachedData[key] && (now - cachedData[key].timestamp < CacheService.CACHE_EXPIRATION_MS)) {
        validCache[id] = cachedData[key].imageUrl;
      }
    }
    console.log("[CacheService] Retrieved cached thumbnails:", Object.keys(validCache).length);
    return validCache;
  }

  /**
   * Stores thumbnails in the cache.
   * @param {Record<number, string>} thumbnails - An object where keys are item IDs and values are their image URLs.
   * @returns {Promise<void>} A promise that resolves when the thumbnails are stored.
   */
  static async setCachedThumbnails(thumbnails: Record<number, string>): Promise<void> {
    const dataToStore: Record<string, { imageUrl: string; timestamp: number }> = {};
    const now = Date.now();
    for (const id in thumbnails) {
      dataToStore[CacheService.CACHE_KEY_PREFIX + id] = {
        imageUrl: thumbnails[id],
        timestamp: now
      };
    }
    await chrome.storage.local.set(dataToStore);
    console.log("[CacheService] Stored new thumbnails in cache:", Object.keys(thumbnails).length);
  }
}