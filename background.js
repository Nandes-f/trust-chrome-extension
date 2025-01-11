let extractionInProgress = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "contactsExtracted") {
    console.log("Contacts extracted:", message.data);
    extractionInProgress = false;
    chrome.storage.local.set({ 'whatsappContacts': message.data }, () => {
      console.log('WhatsApp contacts saved to storage');
    });
    chrome.runtime.sendMessage({ action: "extractionComplete", data: message.data });
  } else if (message.action === "extractionError") {
    console.error("Error extracting contacts:", message.error);
    extractionInProgress = false;
    chrome.runtime.sendMessage({ action: "extractionError", error: message.error });
  } else if (message.action === "extractionProgress") {
    console.log(`Extraction progress: ${Math.round(message.progress * 100)}%`);
    console.log(`Processed ${message.currentContact} out of ${message.totalContacts} contacts`);
    chrome.runtime.sendMessage(message);
  } else if (message.action === "startExtraction") {
    startExtraction();
  } else if (message.action === "openTabAndExtractProfile") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }
      
      const activeTab = tabs[0];
      chrome.tabs.update(activeTab.id, {url: message.url}, (tab) => {
        let attempts = 0;
        const maxAttempts = 30; // Try for about 30 seconds
        const checkInterval = 1000; // Check every second

        function injectScriptAndExtract() {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['twitter_content_script.js']
          }, () => {
            if (chrome.runtime.lastError) {
              console.error("Error injecting script:", chrome.runtime.lastError);
              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(injectScriptAndExtract, checkInterval);
              } else {
                sendResponse({ success: false, error: 'Failed to inject content script' });
              }
            } else {
              checkForSchemaAndExtract();
            }
          });
        }

        function checkForSchemaAndExtract() {
          chrome.tabs.sendMessage(tab.id, { action: "checkForSchema" }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("Error checking for schema:", chrome.runtime.lastError);
              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(checkForSchemaAndExtract, checkInterval);
              } else {
                sendResponse({ success: false, error: 'Timeout: UserProfileSchema not found' });
              }
            } else if (response && response.found) {
              chrome.tabs.sendMessage(tab.id, { action: "extractProfileData" }, (profileResponse) => {
                if (profileResponse && profileResponse.success) {
                  sendResponse({ success: true, data: profileResponse.data });
                } else {
                  sendResponse({ success: false, error: 'Failed to extract profile data' });
                }
              });
            } else {
              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(checkForSchemaAndExtract, checkInterval);
              } else {
                sendResponse({ success: false, error: 'Timeout: UserProfileSchema not found' });
              }
            }
          });
        }

        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            injectScriptAndExtract();
          }
        });
      });
    });
    return true; // Indicates that the response is asynchronous
  } else if (message.action === "extractedInfo") {
    console.log('Extracted Discord Info:', message.data);
    // Process Discord data
    chrome.storage.local.set({ 'discordInfo': message.data }, () => {
      console.log('Discord info saved to storage');
    });
    chrome.runtime.sendMessage({ action: "discordExtractionComplete", data: message.data });
  } else if (message.action === "extractTelegramData") {
    extractTelegramData()
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // Indicates that the response will be sent asynchronously
  } else if (message.action === "startTelegramExtraction") {
    extractTelegramData()
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // Indicates that the response will be sent asynchronously
  } else if (message.action === "navigateToConnections") {
    chrome.tabs.update(sender.tab.id, { url: message.url }, (tab) => {
      // Add listener for when navigation completes
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          // Remove the listener
          chrome.tabs.onUpdated.removeListener(listener);
          // Start collection after navigation
          chrome.tabs.sendMessage(tabId, { action: "collectLinkedInData" });
        }
      });
    });
  }
});

function startExtraction() {
  if (extractionInProgress) {
    console.log("Extraction already in progress");
    chrome.runtime.sendMessage({ action: "extractionError", error: "Extraction already in progress" });
    return;
  }

  chrome.tabs.query({url: "https://web.whatsapp.com/*"}, function(tabs) {
    if (tabs.length === 0) {
      console.error("WhatsApp Web is not open in any tab");
      chrome.runtime.sendMessage({ action: "extractionError", error: "Please open WhatsApp Web before starting extraction" });
      return;
    }

    const whatsappTab = tabs[0];
    
    chrome.scripting.executeScript({
      target: { tabId: whatsappTab.id },
      files: ['whatsapp_content_script.js']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error injecting script:", chrome.runtime.lastError);
        chrome.runtime.sendMessage({ action: "extractionError", error: "Failed to inject content script" });
      } else {
        extractionInProgress = true;
        chrome.tabs.sendMessage(whatsappTab.id, {action: "extractContacts"}, function(response) {
          if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError);
            extractionInProgress = false;
            chrome.runtime.sendMessage({ action: "extractionError", error: chrome.runtime.lastError.message });
          } else if (response && response.status === "started") {
            console.log("Extraction started successfully");
          } else if (response && response.status === "inProgress") {
            console.log("Extraction already in progress");
          }
        });
      }
    });
  });
}

// Add this new event listener
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: 'options.html' });
});

// Add this new event listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openTab") {
        chrome.tabs.create({ url: request.url, active: false }, (tab) => {
            let attempts = 0;
            const maxAttempts = 30; // Try for about 30 seconds
            const checkInterval = 1000; // Check every second

            function checkForSchema() {
                chrome.tabs.sendMessage(tab.id, { action: "checkForSchema" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error checking for schema:", chrome.runtime.lastError);
                        attempts++;
                        if (attempts < maxAttempts) {
                            setTimeout(checkForSchema, checkInterval);
                        } else {
                            chrome.tabs.remove(tab.id);
                            sendResponse({ success: false, error: 'Timeout: UserProfileSchema not found' });
                        }
                    } else if (response && response.found) {
                        chrome.tabs.sendMessage(tab.id, { action: "extractProfileData" }, (profileResponse) => {
                            chrome.tabs.remove(tab.id);
                            if (profileResponse && profileResponse.success) {
                                sendResponse({ success: true, data: profileResponse.data });
                            } else {
                                sendResponse({ success: false, error: 'Failed to extract profile data' });
                            }
                        });
                    } else {
                        attempts++;
                        if (attempts < maxAttempts) {
                            setTimeout(checkForSchema, checkInterval);
                        } else {
                            chrome.tabs.remove(tab.id);
                            sendResponse({ success: false, error: 'Timeout: UserProfileSchema not found' });
                        }
                    }
                });
            }

            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    checkForSchema();
                }
            });
        });
        return true; // Indicates that the response is asynchronous
    }
});

// Add this new event listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchProfileData") {
        fetch(request.url)
            .then(response => response.text())
            .then(html => {
                // Use regex to extract the script content
                const scriptRegex = /<script data-testid="UserProfileSchema-test"[^>]*>([\s\S]*?)<\/script>/i;
                const match = html.match(scriptRegex);
                
                if (match && match[1]) {
                    const schemaData = JSON.parse(match[1]);
                    const author = schemaData.author;

                    let profileData = {
                        'Name': author.givenName || '',
                        'Nickname': author.additionalName || '',
                        'Notes': author.description || '',
                        'Location': author.homeLocation ? author.homeLocation.name : '',
                        'Photo': author.image ? author.image.contentUrl : '',
                        'Website 1 - Type': 'Twitter',
                        'Website 1 - Value': author.url || '',
                        'Custom Field 1 - Type': 'Twitter ID',
                        'Custom Field 1 - Value': author.identifier || '',
                        'Birthday': schemaData.dateCreated || ''
                    };

                    if (author.interactionStatistic) {
                        author.interactionStatistic.forEach(stat => {
                            switch(stat.name) {
                                case 'Follows':
                                    profileData['Custom Field 2 - Type'] = 'Twitter Followers';
                                    profileData['Custom Field 2 - Value'] = stat.userInteractionCount;
                                    break;
                                case 'Friends':
                                    profileData['Custom Field 3 - Type'] = 'Twitter Following';
                                    profileData['Custom Field 3 - Value'] = stat.userInteractionCount;
                                    break;
                                case 'Tweets':
                                    profileData['Custom Field 4 - Type'] = 'Twitter Tweets';
                                    profileData['Custom Field 4 - Value'] = stat.userInteractionCount;
                                    break;
                            }
                        });
                    }

                    sendResponse({success: true, data: profileData});
                } else {
                    sendResponse({success: false, error: 'UserProfileSchema not found'});
                }
            })
            .catch(error => {
                sendResponse({success: false, error: error.message});
            });
        return true; // Indicates that the response is asynchronous
    }
});

// Add this new event listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractedInfo') {
    console.log('Extracted Discord Info:', message.data);
    // Here you can process or store the extracted information
    // For example, you could send it to a server or store it locally
  }
});

// Add this new event listener for Discord
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('discord.com')) {
    chrome.tabs.sendMessage(tabId, { action: "checkDiscord" });
  }
});

async function extractTelegramData() {
  const phoneNumber = await promptUser("Enter your phone number:");
  if (!phoneNumber) throw new Error("Phone number is required");

  const startResponse = await fetch('http://localhost:3000/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneNumber })
  });
  const startResult = await startResponse.json();
  if (!startResult.success) throw new Error(startResult.error);

  const code = await promptUser("Enter the code you received:");
  if (!code) throw new Error("Code is required");

  const loginResponse = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const loginResult = await loginResponse.json();
  if (!loginResult.success) throw new Error(loginResult.error);

  const contactsResponse = await fetch('http://localhost:3000/contacts');
  const contactsResult = await contactsResponse.json();
  if (!contactsResult.success) throw new Error(contactsResult.error);

  const channelsResponse = await fetch('http://localhost:3000/channels');
  const channelsResult = await channelsResponse.json();
  if (!channelsResult.success) throw new Error(channelsResult.error);

  const groupsResponse = await fetch('http://localhost:3000/groups');
  const groupsResult = await groupsResponse.json();
  if (!groupsResult.success) throw new Error(groupsResult.error);

  return {
    contacts: contactsResult.contacts,
    channels: channelsResult.channels,
    groups: groupsResult.groups
  };
}

function promptUser(message, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Prompt response timeout"));
    }, timeout);

    chrome.runtime.sendMessage({ type: "PROMPT_USER", message }, (response) => {
      clearTimeout(timeoutId);
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// Add this new event listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startTelegramExtraction") {
    extractTelegramData()
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // Indicates that the response will be sent asynchronously
  }
});

// Update the LinkedIn navigation handler in background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "navigateToProfile") {
    chrome.tabs.query({url: ["*://www.linkedin.com/*"]}, function(tabs) {
      if (tabs.length > 0) {
        const linkedinTab = tabs[0];
        
        // Update the tab URL
        chrome.tabs.update(linkedinTab.id, {url: request.url}, (tab) => {
          // Add listener for when navigation completes
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              // Remove the listener
              chrome.tabs.onUpdated.removeListener(listener);
              
              // Wait a bit for the page to fully load
              setTimeout(() => {
                // Send message back to content script that navigation is complete
                chrome.tabs.sendMessage(tabId, {
                  action: "profilePageLoaded",
                  url: request.url
                });
              }, 3000);
            }
          });
        });
      }
    });
    return true; // Keep message channel open
  }
});
