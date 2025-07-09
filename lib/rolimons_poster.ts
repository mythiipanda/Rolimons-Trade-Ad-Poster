/**
 * Posts a trade ad to the Rolimons API.
 * @param {number} robloxId - The Roblox User ID.
 * @param {number[]} offerItemIds - An array of item IDs to offer.
 * @param {number[]} requestItemIds - An array of item IDs to request.
 * @param {string} tradeNotes - Optional trade notes.
 * @param {string[]} tradeTags - Optional trade tags.
 * @param {string} rolimonsVerificationToken - The Rolimons verification token.
 * @returns {Promise<boolean>} A promise that resolves to true if the ad was posted successfully, false otherwise.
 */
export async function manualPostTradeAd(
  robloxId: number,
  offerItemIds: number[],
  requestItemIds: number[],
  tradeNotes: string,
  tradeTags: string[],
  rolimonsVerificationToken: string
): Promise<boolean> {
  const sendBody = {
    player_id: robloxId,
    offer_item_ids: offerItemIds.map(item => parseInt(item.toString(), 10)),
    request_item_ids: requestItemIds.map(item => parseInt(item.toString(), 10)),
    ...(tradeTags && tradeTags.length > 0 && { request_tags: tradeTags }),
    ...(tradeNotes && tradeNotes.length > 0 && { trade_notes: tradeNotes }),
  };

  console.log("[rolimons_poster.ts] Sending trade ad with body:", sendBody);
  console.log("[rolimons_poster.ts] Stringified body:", JSON.stringify(sendBody));

  try {
    const res = await fetch('https://api.rolimons.com/tradeads/v1/createad', {
      method: "POST",
      headers: {
        'content-type': 'application/json',
        'cookie': `_RoliVerification=${rolimonsVerificationToken}`
      },
      body: JSON.stringify(sendBody)
    });

    if (res.status === 201) {
      console.log("Successfully posted ad!");
      return true;
    } else {
      console.error(`Error requesting rolimons trade ad API. Status: ${res.status}, Status Text: ${res.statusText}`);
      try {
        const errorBody = await res.json();
        console.error("Error Response Body:", errorBody);
      } catch (jsonError) {
        console.error("Could not parse error response body as JSON:", jsonError);
      }
    }
  } catch (err) {
    console.error("Error posting trade ad:", err);
  }
  return false;
}