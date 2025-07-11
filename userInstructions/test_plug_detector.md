## Testing the Optimized Plug Detection Algorithm

Follow these steps to test the plug detection algorithm with the new caching mechanism:

1.  **Build the Extension:**
    Open your terminal in the project root directory (`c:/Users/15980/Downloads/rolimons/rolimons-trade-ad-poster`) and run the following command:
    ```bash
    npm install
    npm run build
    ```

2.  **Load the Extension in Chrome:**
    a.  Open Chrome and navigate to `chrome://extensions`.
    b.  Enable "Developer mode" using the toggle in the top right corner.
    c.  Click on "Load unpacked" and select the `extension` folder from your project directory (`c:/Users/15980/Downloads/rolimons/rolimons-trade-ad-poster/extension`).

3.  **Configure and Enable Plug Detection:**
    a.  Click on the extension icon in your Chrome toolbar.
    b.  Go to the settings (if available in the popup or a separate options page).
    c.  Ensure "Plug Detection" is enabled. You can adjust `maxTradeAds`, `fetchInterval`, `minValue`, and observe the new `cacheDurationHours` setting.

4.  **Monitor Console Logs:**
    a.  Right-click on the extension icon in the Chrome toolbar and select "Inspect popup" (or "Manage Extension" and then "background page" if the logic runs in the background script).
    b.  In the opened Developer Tools window, go to the "Console" tab.
    c.  Observe the logs from `[PlugDetector]`. You should see messages indicating when scans are performed and when cached values are used for `getUserTradeAdCount`. This will show if the caching is reducing API calls.

5.  **Verify Plug Detection and Notifications:**
    a.  Keep the extension running and observe if "plug" users are detected and if Chrome notifications appear as expected.
    b.  Check the extension's popup (if applicable) to see the list of recent plugs.

Please let me know the results of your testing.