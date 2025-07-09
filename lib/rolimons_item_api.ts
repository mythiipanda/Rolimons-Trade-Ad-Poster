import type { RolimonsItem } from "../types/messages";

/**
 * Fetches item details from the Rolimons API for a given array of item IDs.
 * @param {number[]} itemIds - An array of Roblox item IDs.
 * @returns {Promise<Record<number, RolimonsItem>>} A promise that resolves to an object where keys are item IDs and values are their details.
 */
export async function getRolimonsItemDetails(itemIds: number[]): Promise<Record<number, RolimonsItem>> {
  if (!itemIds || itemIds.length === 0) {
    console.warn("[rolimons_item_api.ts] No item IDs provided for fetching details.");
    return {};
  }

  const itemDetails: Record<number, RolimonsItem> = {};
  const chunkSize = 100; // Increased chunk size for efficiency

  for (let i = 0; i < itemIds.length; i += chunkSize) {
    const chunk = itemIds.slice(i, i + chunkSize);
    const url = `https://api.rolimons.com/items/v1/itemdetails?itemids=${chunk.join(',')}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.success && data.items) {
        for (const itemId in data.items) {
          const item = data.items[itemId];
          itemDetails[parseInt(itemId)] = {
            id: parseInt(itemId),
            name: item[0],
            alias: item[1] || null,
            value: item[4],
            thumbnailUrl: null, // Will be fetched separately by background.ts
          };
        }
      } else {
        console.warn(`[rolimons_item_api.ts] Rolimons API returned success: false or no items for chunk: ${chunk.join(',')}`);
      }
    } catch (error) {
      console.error(`[rolimons_item_api.ts] Error fetching Rolimons item details for chunk ${chunk.join(',')}:`, error);
    }
  }
  return itemDetails;
}

/**
 * Fetches all item details from the Rolimons API, including names, aliases, and values.
 * Thumbnails are handled by the background script.
 * @returns {Promise<RolimonsItem[]>} A promise that resolves to an array of item objects.
 */
export async function getAllRolimonsItems(): Promise<RolimonsItem[]> {
  const allItems: RolimonsItem[] = [];
  const url = `https://api.rolimons.com/items/v1/itemdetails`; // No itemids parameter to get all

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    if (data.success && data.items) {
      for (const itemId in data.items) {
        const item = data.items[itemId];
        const parsedItem: RolimonsItem = {
          id: parseInt(itemId),
          name: item[0],
          alias: item[1] || null,
          value: item[4],
          thumbnailUrl: null, // Will be fetched separately by background.ts
        };
        allItems.push(parsedItem);
      }
    } else {
      console.warn(`[rolimons_item_api.ts] Rolimons API returned success: false or no items when trying to get all items.`);
    }
  } catch (error) {
    console.error(`[rolimons_item_api.ts] Error fetching all Rolimons item details:`, error);
  }
  return allItems;
}