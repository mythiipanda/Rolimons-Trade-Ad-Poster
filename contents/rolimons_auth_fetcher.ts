import type { PlasmoCSConfig } from "plasmo";
import { sendToBackground } from "@plasmohq/messaging";

export const config: PlasmoCSConfig = {
  matches: ["https://www.rolimons.com/*"],
  run_at: "document_idle"
};

console.log("[rolimons_auth_fetcher.ts] Content script loaded. Attempting to fetch _RoliVerification cookie...");

try {
  const rolimonsVerificationCookie = document.cookie.split('; ').find(row => row.startsWith('_RoliVerification='));
  if (rolimonsVerificationCookie) {
    const token = rolimonsVerificationCookie.split('=')[1];
    console.log("[rolimons_auth_fetcher.ts] _RoliVerification cookie found. Sending message to background script.");
    sendToBackground({
      name: "ROLIMONS_VERIFICATION_TOKEN",
      body: { token: token }
    });
  } else {
    console.warn("[rolimons_auth_fetcher.ts] _RoliVerification cookie not found.");
  }
} catch (e) {
  console.error("[rolimons_auth_fetcher.ts] Error fetching Rolimons Verification Token:", e);
}