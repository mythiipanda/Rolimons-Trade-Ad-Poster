export interface TradeConfig {
  offerItemIds: number[];
  requestItemIds: number[];
  tradeTags: string[];
}

export interface RobloxItem {
  id: number;
  userAssetId: number; // Unique ID for each item instance in inventory
  name: string;
  value: string | number;
  imageUrl: string;
}

export interface RolimonsItem {
  id: number;
  name: string;
  alias: string | null;
  value: number;
  thumbnailUrl: string | null;
}

export interface MessageRequest {
  action: "startAutoTrade" | "stopAutoTrade" | "postTradeAd" | "fetchCredentials" | "fetchUserAvatar" | "fetchUserInventory" | "fetchRolimonsItemThumbnails" | "getRolimonsItemDetails" | "getAllRolimonsItems";
  interval?: number;
  tradeConfig?: TradeConfig;
  userId?: number;
  itemIds?: number[];
  componentName?: string; // For shadcn/ui components if needed later
  query?: string; // For shadcn/ui components if needed later
}

export interface MessageResponse {
  status: "success" | "failed" | "started" | "stopped" | "posted";
  message?: string;
  robloxUserId?: number;
  rolimonsVerificationToken?: string;
  imageUrl?: string;
  userName?: string;
  inventory?: RobloxItem[];
  thumbnails?: { [key: number]: string };
  itemDetails?: { [key: number]: RolimonsItem };
  allItems?: RolimonsItem[];
  data?: any; // Generic for other responses
}