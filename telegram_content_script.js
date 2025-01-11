console.log("Telegram content script loaded");

function promptUser(message) {
  return new Promise((resolve) => {
    const response = prompt(message);
    resolve(response);
  });
}

async function extractTelegramData() {
  const phone = await promptUser("Please enter your phone number:");
  if (!phone) {
    throw new Error("Phone number is required");
  }

  // Here you would interact with the Telegram web interface to enter the phone number
  // This part requires detailed knowledge of the Telegram web app structure

  const code = await promptUser("Please enter the code you received:");
  if (!code) {
    throw new Error("Code is required");
  }

  // Here you would enter the code into the Telegram web interface
  // Again, this requires detailed knowledge of the Telegram web app structure

  // After successful login, you would extract the contacts, channels, and groups data
  // This is a placeholder for the actual extraction logic
  const extractedData = {
    contacts: [
      { firstName: "John", phone: "+1234567890", username: "john_doe" },
      { firstName: "Jane", phone: "+0987654321", username: "jane_doe" }
    ],
    channels: [
      { title: "News Channel", id: "news_channel_id" },
      { title: "Tech Updates", id: "tech_updates_id" }
    ],
    groups: [
      { title: "Family Group", id: "family_group_id" },
      { title: "Work Team", id: "work_team_id" }
    ]
  };

  return extractedData;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractTelegramData") {
    console.log("Received request to extract Telegram data");
    
    extractTelegramData()
      .then(data => {
        console.log("Extracted data:", data);
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error("Extraction failed:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Indicates that the response will be sent asynchronously
  }
});

console.log("Telegram content script is ready");