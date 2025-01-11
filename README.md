# Contacts Chrome Extension

This Chrome extension, called Contacts, allows you to scrape contact information from various websites and store it locally.

## Setup and Testing Instructions

1. **Prepare the Extension Files**
   - Create a new directory for your extension.
   - Save all the following files in this directory:
     - manifest.json
     - popup.html
     - popup.js
     - content.js
     - background.js
     - options.html
     - options.js

2. **Create Icon Files**
   - Create or obtain icon files named:
     - icon16.png
     - icon48.png
     - icon128.png
   - Place these icon files in your extension directory.

3. **Load the Extension in Chrome**
   - Open Google Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner.
   - Click "Load unpacked" and select your extension directory.

4. **Test Basic Functionality**
   - Click on the extension icon in the Chrome toolbar.
   - Verify that the popup opens and displays correctly.
   - The popup should show a header with "Contacts" and menu items for "Options" and "Delete".
   - Verify that the "Scrape Contacts" button and an area for displaying contacts are present.

5. **Test Menu Functionality**
   - Click the "Options" menu item to open the options page in a new tab.
   - Click the "Delete" menu item to verify it clears stored contacts.

6. **Test Options Page**
   - Verify that the options page opens in a new tab.
   - Check that the sidebar contains all the website options (Google Contacts, Amazon, LinkedIn, Facebook, WhatsApp Web).
   - Click each option to ensure it updates the main content area.
   - Test clearing contacts from this page.

7. **Verify Data Storage**
   - After scraping, reopen the extension popup.
   - Check if the scraped contacts are displayed in the contact list.

8. **Debug Using Chrome DevTools**
   - Right-click the extension icon and select "Inspect popup" to debug the popup.
   - For background script debugging, go to the extensions page, find your extension, and click on "service worker" under "Inspect views".

9. **Test on Different Supported Websites**
   - Repeat the scraping process on other supported sites to ensure it works across all of them.

10. **Implement and Test Individual Scraping Functions**
    - For each website (Google Contacts, Amazon, LinkedIn, Facebook, WhatsApp), implement the specific scraping logic in the respective functions in `content.js`.
    - Test each function individually by navigating to the website and running the scrape function.

## Notes

- Remember that web scraping may violate some websites' terms of service. Ensure you have the right to access and store this data before implementing the actual scraping logic.
- For more robust testing, consider adding error handling and testing edge cases.
- Use `console.log()` statements in your code to track the flow and debug issues.
- Test with different amounts of data and on various pages within each supported website.

If you encounter any specific issues during testing, refer to the Chrome extension documentation or seek help from the developer community."# trust-chrome-extension" 
"# trust-chrome-extension" 
