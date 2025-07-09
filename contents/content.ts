import type { PlasmoCSConfig } from "plasmo";

export const config: PlasmoCSConfig = {
  matches: ["https://www.roblox.com/*", "https://www.rolimons.com/*"],
  run_at: "document_idle"
};

console.log("[content.ts] Content script loaded.");