/**
 * Service for interacting with Roblox APIs.
 */
export class RobloxAPIService {
  /**
   * Fetches the authenticated Roblox User ID.
   * @returns {Promise<number | null>} The Roblox User ID or null if not found/authenticated.
   */
  static async fetchAuthenticatedUserId(): Promise<number | null> {
    console.log("[RobloxAPIService] Attempting to fetch Roblox User ID from API...");
    try {
      const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
        credentials: 'include' // Important for sending Roblox cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("[RobloxAPIService] Not authenticated on Roblox. User ID cannot be fetched via API.");
          return null;
        }
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      if (data && data.id) {
        console.log("[RobloxAPIService] Successfully fetched Roblox User ID from API:", data.id);
        return data.id;
      } else {
        console.warn("[RobloxAPIService] Roblox User ID not found in API response.");
        return null;
      }
    } catch (error) {
      console.error("[RobloxAPIService] Error fetching Roblox User ID from API:", error);
      return null;
    }
  }

  /**
   * Fetches the user's avatar image URL and username.
   * @param {number} userId - The Roblox User ID.
   * @returns {Promise<{ imageUrl: string | null; userName: string | null }>} Object containing avatar URL and username.
   */
  static async fetchUserAvatarAndUsername(userId: number): Promise<{ imageUrl: string | null; userName: string | null }> {
    console.log(`[RobloxAPIService] Fetching user avatar and username for userId: ${userId}...`);
    try {
      // Fetch avatar thumbnail
      const avatarResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=100x100&format=Png&is=true`, { credentials: 'include' });
      const avatarData = await avatarResponse.json();
      let imageUrl: string | null = null;
      if (avatarData.data && avatarData.data.length > 0) {
        imageUrl = avatarData.data[0].imageUrl;
      }

      // Fetch username
      const userResponse = await fetch(`https://users.roblox.com/v1/users/${userId}`, { credentials: 'include' });
      const userData = await userResponse.json();
      let userName: string | null = null;
      if (userData.name) {
        userName = userData.name;
      }
      console.log(`[RobloxAPIService] Fetched avatar URL: ${imageUrl}, Username: ${userName}`);
      return { imageUrl, userName };
    } catch (error) {
      console.error("[RobloxAPIService] Error fetching user avatar or username:", error);
      return { imageUrl: null, userName: null };
    }
  }

  /**
   * Fetches the user's collectible inventory.
   * @param {number} userId - The Roblox User ID.
   * @returns {Promise<any[]>} An array of inventory items.
   */
  static async fetchUserCollectiblesInventory(userId: number): Promise<any[]> {
    console.log(`[RobloxAPIService] Fetching user collectibles inventory for userId: ${userId}...`);
    let allItems: any[] = [];
    let nextCursor: string | null = null;
    const limit = 100; // Max limit per request

    try {
      do {
        let url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=${limit}`;
        if (nextCursor) {
          url += `&cursor=${nextCursor}`;
        }

        const inventoryResponse = await fetch(url, { credentials: 'include' });

        if (!inventoryResponse.ok) {
          const errorText = await inventoryResponse.text();
          throw new Error(`HTTP error! status: ${inventoryResponse.status}, body: ${errorText}`);
        }

        const inventoryData = await inventoryResponse.json();
        if (inventoryData.data) {
          allItems = allItems.concat(inventoryData.data);
        }
        nextCursor = inventoryData.nextPageCursor || null;
      } while (nextCursor);

      console.log("[RobloxAPIService] Successfully fetched user inventory data.");
      return allItems;
    } catch (error) {
      console.error("[RobloxAPIService] Error fetching user inventory:", error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  /**
   * Fetches thumbnails for a list of asset IDs.
   * @param {number[]} assetIds - An array of Roblox asset IDs.
   * @returns {Promise<Record<number, string>>} An object mapping asset IDs to their thumbnail URLs.
   */
  static async fetchAssetThumbnails(assetIds: number[]): Promise<Record<number, string>> {
    console.log(`[RobloxAPIService] Fetching asset thumbnails for ${assetIds.length} items...`);
    const fetchedImages: Record<number, string> = {};
    const thumbnailChunkSize = 10; // Define a chunk size for Roblox thumbnail API calls

    for (let i = 0; i < assetIds.length; i += thumbnailChunkSize) {
      const chunk = assetIds.slice(i, i + thumbnailChunkSize);
      try {
        const imageUrlsResponse = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(',')}&size=420x420&format=Png&isCircular=false`, { credentials: 'include' });
        const imageUrlsData = await imageUrlsResponse.json();
        if (imageUrlsData.data) {
          imageUrlsData.data.forEach((img: any) => {
            fetchedImages[img.targetId] = img.imageUrl;
          });
        }
      } catch (error) {
        console.error(`[RobloxAPIService] Error fetching thumbnails for chunk ${chunk.join(',')}:`, error);
      }
    }
    console.log("[RobloxAPIService] Completed fetching asset thumbnails.");
    return fetchedImages;
  }
}