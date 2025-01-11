// Global variables - ONLY declare these once at the top
const isCollectingData = {
  status: false
};
let lastUrl = location.href;

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    handleScrapeRequest(sendResponse);
  } else if (request.action === "startExtraction") {
    handleStartExtraction(sendResponse);
  }
  return true;
}); 

// Handle scrape request
function handleScrapeRequest(sendResponse) {
  const url = window.location.href;
  let contacts = [];
  let siteName = "";

  if (url.includes("contacts.google.com")) {
    contacts = scrapeGoogleContacts();
    siteName = "Google Contacts";
  } else if (url.includes("amazon.com")) {
    contacts = scrapeAmazon();
    siteName = "Amazon";
  } else if (url.includes("facebook.com")) {
    contacts = scrapeFacebook();
    siteName = "Facebook";
  } else if (url.includes("web.whatsapp.com")) {
    contacts = scrapeWhatsApp();
    siteName = "WhatsApp Web";
  }

  chrome.runtime.sendMessage({ 
    action: "saveContacts", 
    contacts: contacts,
    siteName: siteName
  });
}

// Handle start extraction
function handleStartExtraction(sendResponse) {
  // Your WhatsApp extraction logic here
  sendResponse({status: "Extraction started"});
}
