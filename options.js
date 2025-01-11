function logActivity(platform, action, contactCount, status = 'Success', data) {
  // Add data to the activity log after the status for linkedin and twitter
  if (platform === 'LinkedIn' && data) {
    const parts = [];
    if (data.name) parts.push(`<b>Name:</b> ${data.name}`);
    if (data.connections) parts.push(`<b>Connections:</b> ${data.connections}`);
    if (data.currentCompany) parts.push(`<b>Company:</b> ${data.currentCompany}`);
    if (data.currentTitle) parts.push(`<b>Title:</b> ${data.currentTitle}`);
    if (data.education) parts.push(`<b>Education:</b> ${data.education}`);
    if (data.languages) parts.push(`<b>Languages:</b> ${data.languages}`);
    if (data.experience && Array.isArray(data.experience)) {
      const experienceStr = data.experience
        .map(exp => `${exp.title} at ${exp.company}`)
        .join(', ');
      parts.push(`<b>Experience:</b> ${experienceStr}`);
    }
    if (data.location) parts.push(`<b>Location:</b> ${data.location}`);
    if (data.profileUrl) parts.push(`<b>Profile URL:</b> ${data.profileUrl}`);
    if (data.skills && Array.isArray(data.skills)) {
      parts.push(`<b>Skills:</b> ${data.skills.join(', ')}`);
    }

    if (parts.length > 0) {
      status = status + ' - ' + parts.join(' | ');
    }
  } 
   if (platform === 'Twitter' && data) {
    const parts = [];
    if (data.name) parts.push(`<b>Name:</b> ${data.name}`);
    if (data.followers) parts.push(`<b>Followers:</b> ${data.followers}`);
    if (data.following) parts.push(`<b>Following:</b> ${data.following}`);
    if (data.handle) parts.push(`<b>Handle:</b> @${data.handle}`);
    if (data.location) parts.push(`<b>Location:</b> ${data.location}`);
    if (data.bio) parts.push(`<b>Bio:</b> ${data.bio}`);
    if (data.tweets) parts.push(`<b>Tweets:</b> ${data.tweets}`);
    if (data.website) parts.push(`<b>Website:</b> ${data.website}`);

    if (parts.length > 0) {
      status = status + ' - ' + parts.join(' | ');
    }
  }

  chrome.storage.local.get(['activityLog'], (result) => {
    const activities = result.activityLog || [];
    activities.unshift({
      platform,
      date: new Date().toISOString(),
      action,
      contactCount,
      status
    });
    
    // Keep only the last 100 activities
    const trimmedActivities = activities.slice(0, 100);
    
    chrome.storage.local.set({ activityLog: trimmedActivities }, () => {
      console.log('Activity logged:', platform, action);
    });
  });
}

// Then define findDuplicates
function findDuplicates(contacts) {
  const duplicates = [];
  const seen = new Map();

  contacts.forEach(contact => {
    const name = contact['Name'] ? contact['Name'].toLowerCase().trim() : '';

    if (name) {
      if (seen.has(name)) {
        seen.get(name).push(contact);
      } else {
        seen.set(name, [contact]);
      }
    }
  });

  for (let [name, contactGroup] of seen) {
    if (contactGroup.length > 1) {
      duplicates.push(contactGroup);
    }
  }

  console.log('Found duplicates:', duplicates);
  return duplicates;
}

// Then define mergeDuplicate
async function mergeDuplicate(index) {
  try {
      let contacts = await getAllContactsFromDB();
      let duplicates = findDuplicates(contacts);
      let duplicateSet = duplicates[index];
      console.log('duplicateSet', duplicateSet);

      if (!duplicateSet || duplicateSet.length < 2) {
          console.error('Invalid duplicate set');
          return;
      }

      // Create a merged contact
      let mergedContact = {};
      
      // Preserve IDs from original contacts
      const originalIds = duplicateSet.map(contact => contact.id).filter(Boolean);
      
      // Fields that should be combined instead of taking the longest
      const combineFields = {
          'Phone': 4,    // Up to 4 phone numbers
          'E-mail': 3,   // Up to 3 email addresses
          'Website': 2,  // Up to 2 websites
          'Address': 2   // Up to 2 addresses
      };

      // Track used values for fields that should be combined
      const usedValues = new Map();

      // Merge data
      duplicateSet.forEach(contact => {
          Object.keys(contact).forEach(key => {
              if (key === 'id') return; // Skip ID field

              // Check if this is a field that should be combined
              const fieldType = Object.keys(combineFields).find(type => key.startsWith(type));
              
              if (fieldType) {
                  // Get the base field name (e.g., "Phone 1" from "Phone 1 - Value")
                  const baseField = key.split(' - ')[0];
                  const valueType = key.includes('- Value') ? 'Value' : 'Type';
                  
                  if (!usedValues.has(baseField)) {
                      usedValues.set(baseField, new Set());
                  }

                  if (contact[key] && !usedValues.get(baseField).has(contact[key])) {
                      // Find the next available number for this field type
                      for (let i = 1; i <= combineFields[fieldType]; i++) {
                          const newKey = `${fieldType} ${i} - ${valueType}`;
                          if (!mergedContact[newKey]) {
                              mergedContact[newKey] = contact[key];
                              usedValues.get(baseField).add(contact[key]);
                              break;
                          }
                      }
                  }
              } else {
                  // For other fields, keep the most complete information
                  if (contact[key] && (!mergedContact[key] || contact[key].length > mergedContact[key].length)) {
                      mergedContact[key] = contact[key];
                  }
              }
          });
      });

      // Use the ID from the first contact if available
      if (originalIds.length > 0) {
          mergedContact.id = originalIds[0];
      }

      // Ensure the merged contact has a platform
      mergedContact.platform = mergedContact.platform || duplicateSet[0].platform;

      // Remove duplicate contacts
      contacts = contacts.filter(contact => !duplicateSet.includes(contact));
      
      // Add merged contact
      contacts.push(mergedContact);


      // Clear and update the database
      await storeInIndexedDB(contacts,true);
      
      console.log('Merged contact:', mergedContact);
      logActivity('Enhance', 'Merge Duplicate', 1);
      
      // Refresh displays
      await displayMergeAndFix();
      selectSidebarItem(mergedContact.platform);
      await displayRegularContent(mergedContact.platform);
      
      return true;
  } catch (error) {
      console.error('Error in mergeDuplicate:', error);
      return false;
  }
}

function selectSidebarItem(selectedItem) {
  console.log('1938-1938');
  console.log('selectedItem', selectedItem);
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(i => i.classList.remove('active'));

  let selectedOption = '';

  // Handle both string and DOM element inputs
  if (typeof selectedItem === 'string') {
    // Find the sidebar item with matching text content
    const matchingItem = Array.from(sidebarItems).find(item => 
      item.textContent.trim() === selectedItem ||
      (selectedItem === 'Contacts' && item.textContent.trim().includes('Contacts'))
    );
    if (matchingItem) {
      matchingItem.classList.add('active');
    } else if (selectedItem === 'Contacts') {
      // If no match found and we're looking for Contacts, find the first item containing "Contacts"
      const contactsItem = Array.from(sidebarItems).find(item => 
        item.textContent.trim().includes('Contacts')
      );
      if (contactsItem) {
        contactsItem.classList.add('active');
      }
    }
    selectedOption = selectedItem;
  } else {
    // Handle DOM element
    selectedItem.classList.add('active');
    selectedOption = selectedItem.textContent.trim();
  }
  
  optionContent.innerHTML = '<p>Loading...</p>';
  
  chrome.storage.local.set({ lastSelectedContent: selectedOption }, () => {
    console.log('Last selected content saved:', selectedOption);
  });
}

// Then define mergeAllDuplicates
async function mergeAllDuplicates() {
  let contacts = await getAllContactsFromDB().then(contacts => {
    return contacts;
  });
    let duplicates = findDuplicates(contacts);

    // Array to store merged contacts
    let mergedContacts = [];

    // Merge each set of duplicates
    duplicates.forEach((duplicateSet) => {
      let mergedContact = {};

      // Merge data, keeping the most complete information
      duplicateSet.forEach(contact => {
        Object.keys(contact).forEach(key => {
          if (contact[key] && (!mergedContact[key] || contact[key].length > mergedContact[key].length)) {
            mergedContact[key] = contact[key];
          }
        });
      });

      // Ensure the merged contact has a platform
      mergedContact.platform = mergedContact.platform || duplicateSet[0].platform;

      mergedContacts.push(mergedContact);
    });

    // Remove all duplicates from the original contacts list
    contacts = contacts.filter(contact => 
      !duplicates.some(duplicateSet => duplicateSet.includes(contact))
    );

    // Add merged contacts to the list
    contacts = contacts.concat(mergedContacts);

    // Save the updated contacts
    await storeInIndexedDB(contacts);
      logActivity('Enhance', 'Merge All Duplicates', mergedContacts.length);
      displayMergeAndFix();
      displayRegularContent('Contacts'); 
}

// Then define displayMergeAndFix
async function displayMergeAndFix() {
  let contacts = await getAllContactsFromDB().then(contacts => {
    return contacts;
  });
    const duplicates = findDuplicates(contacts);
    
    console.log('Total duplicates found:', duplicates.length);

    let content = '<div class="merge-fix-container">' +
      '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
        '<h2 style="margin: 0;">Merge duplicates <span class="contact-count">(' + duplicates.length + ')</span></h2>' +
        '<button id="mergeAllButton" style="padding: 10px 15px; background-color: #4285f4; color: white; border: none; border-radius: 5px; cursor: pointer;">Merge All</button>' +
      '</div>' +
      '<div class="duplicate-list">';

    duplicates.forEach((duplicate, index) => {
      content += '<div class="duplicate-card">' +
        '<div class="duplicate-content" data-index="' + index + '">' +
          '<div class="contact-group" style="display: flex; flex-direction: column;">';

      // Display the name only once
      content += '<div class="contact-name" style="font-weight: bold; margin-bottom: 10px;">' + duplicate[0]['Name'] + '</div>';

      // Display all available data for each duplicate
      duplicate.forEach((contact, contactIndex) => {
        content += '<div class="contact-item" style="margin-bottom: 10px;">' +
          '<div class="contact-index" style="font-weight: bold;">Contact ' + (contactIndex + 1) + '</div>' +
          (contact['E-mail 1 - Value'] ? '<div>Email: ' + contact['E-mail 1 - Value'] + '</div>' : '') +
          (contact['Phone 1 - Value'] ? '<div>Phone: ' + contact['Phone 1 - Value'] + '</div>' : '') +
          (contact['Organization 1 - Title'] ? '<div>Job Title: ' + contact['Organization 1 - Title'] + '</div>' : '') +
          (contact['Organization 1 - Name'] ? '<div>Company: ' + contact['Organization 1 - Name'] + '</div>' : '') +
          (contact['External ID 1 - Value'] ? '<div>External ID: ' + contact['External ID 1 - Value'] + '</div>' : '') +
          (contact['platform'] ? '<div>Platform: ' + contact['platform'] + '</div>' : '') +
        '</div>';
      });

      content += '</div>' +
          '<div class="action-buttons" style="display: flex; justify-content: flex-end; margin-top: 10px;">' +
            '<button class="dismiss-button" data-index="' + index + '">Dismiss</button>' +
            '<button class="merge-button" data-index="' + index + '">Merge</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    });

    content += '</div></div>';
    document.getElementById('optionContent').innerHTML = content;

    // Add event listeners after content is added to the DOM
    addMergeAndFixListeners();

    // Add event listener for the Merge All button
    document.getElementById('mergeAllButton').addEventListener('click', mergeAllDuplicates);
}

// Define addMergeAndFixListeners in the global scope
function addMergeAndFixListeners() {
  const dismissButtons = document.querySelectorAll('.dismiss-button');
  const mergeButtons = document.querySelectorAll('.merge-button');

  dismissButtons.forEach(button => {
    button.addEventListener('click', function() {
      const index = this.getAttribute('data-index');
      dismissDuplicate(index);
    });
  });

  mergeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const index = this.getAttribute('data-index');
      mergeDuplicate(index);
    });
  });
}

// Add this function near the top of the file, before it's used
async function initializeQRAuth() {
  try {
    await QRAuth.initialize();
    return true;
  } catch (error) {
    console.error('Failed to initialize QRAuth:', error);
    return false;
  }
}
// Add this function near the top of the file
async function checkAuthentication() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['isAuthenticated', 'userData', 'authTimestamp'], (result) => {
      if (!result.isAuthenticated || !result.userData) {
        resolve(false);
        return;
      }

      // Check if authentication has expired (24 hours)
      const now = Date.now();
      const authAge = now - (result.authTimestamp || 0);
      const AUTH_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

      if (authAge > AUTH_EXPIRY) {
        // Clear expired authentication
        chrome.storage.local.remove(['isAuthenticated', 'userData', 'authTimestamp'], () => {
          resolve(false);
        });
        return;
      }

      resolve(true);
    });
  });
}

// Update the displayQRAuthScreen function
async function displayQRAuthScreen() {
    const optionContent = document.getElementById('optionContent');
    optionContent.innerHTML = `
        <div class="auth-container" style="display: flex; flex-direction: column; align-items: center; padding: 20px;">
            <h2>Scan QR Code to Login</h2>
            <div id="qr-container" style="margin: 20px 0; min-height: 256px; min-width: 256px;"></div>
            <div id="status-container" style="text-align: center; margin-top: 20px;">
                Initializing...
            </div>
        </div>
    `;

    try {
        // Get container elements
        const qrContainer = document.getElementById('qr-container');
        const statusContainer = document.getElementById('status-container');

        if (!qrContainer || !statusContainer) {
            console.error('Container elements not found!');
            return;
        }

        // Start the auth session using QRAuth from auth.js
        await QRAuth.startAuthSession(qrContainer, statusContainer);

        // Add listener for authentication success
        const unsubscribe = firebase.firestore().collection('authSessions')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const data = change.doc.data();
                    if (data.status === 'authenticated' && data.userData) {
                        // Store authentication data
                        chrome.storage.local.set({
                            isAuthenticated: true,
                            userData: data.userData,
                            authTimestamp: Date.now()
                        }, () => {
                            console.log('Authentication successful, data stored');
                            // Update the sidebar with user data
                            updateProfileUI(data.userData); // Call to update the profile UI
                            document.getElementById('userProfile').style.display = 'block';
                            // Refresh the main content
                            updateMainContent('Contacts');
                        });
                        
                        // Cleanup listener
                        unsubscribe();
                    }
                });
            });

    } catch (error) {
        console.error('Error in displayQRAuthScreen:', error);
        statusContainer.textContent = 'Error: ' + error.message;
    }
}

// Update the logout function
function logout() {
    chrome.storage.local.remove(['isAuthenticated', 'userData', 'authTimestamp'], () => {
        console.log('Logged out successfully');
        document.getElementById('userProfile').style.display = 'none'; // Hide user profile on logout
        displayQRAuthScreen();
    });
}

// Add this function after the existing LinkedIn-related code
function extractLinkedInData() {
  //if linkedinConnections are stored in chrome storage, then process them
  chrome.storage.local.get(['linkedinConnections'], (result) => {
    if (result.linkedinConnections && Object.keys(result.linkedinConnections).length > 0) {
      showNotification('LinkedIn connections found in storage, processing...', 'info');
      processPendingConnections();
    }
  });

  console.log("Starting LinkedIn extraction in background");
  
  showNotification(
    'Starting LinkedIn data extraction in background...', 
    'info',
    5000
  );

  chrome.storage.local.set({ 
    linkedinExtractionStatus: {
      inProgress: true,
      processed: 0,
      total: 0,
      lastUpdated: Date.now()
    }
  });

  chrome.tabs.query({url: ["*://www.linkedin.com/*"]}, function(tabs) {
    if (tabs.length === 0) {
      showNotification('Please open a LinkedIn profile page in a new tab before extracting data.', 'warning');
      return;
    }

    const linkedinTab = tabs[0];
    
    chrome.tabs.sendMessage(linkedinTab.id, {action: "extractLinkedInData"}, function(response) {
      if (chrome.runtime.lastError || !response || !response.success) {
        console.error('Error:', chrome.runtime.lastError || 'Invalid response');
        showNotification('Failed to extract LinkedIn data', 'error');
        return;
      }
      
      // Store the main profile without refreshing display
      storeLinkedInContact(response.data, false);
      
      if (response.data.connectionProfiles?.length > 0) {
        chrome.storage.local.set({ 
          linkedinExtractionStatus: {
            inProgress: true,
            processed: 0,
            total: response.data.connectionProfiles.length,
            lastUpdated: Date.now()
          }
        });
        
        showNotification(
          `Processing ${response.data.connectionProfiles.length} connections in background...`, 
          'info',
          5000
        );
        
        storeAndProcessConnections(response.data);
      }
    });
  });
}

// Add these functions to handle LinkedIn connection processing

// Function to store connection profiles and trigger processing
function storeAndProcessConnections(profileData) {
  chrome.storage.local.get(['linkedinConnections'], (result) => {
    const storedConnections = result.linkedinConnections || {};
    const newConnectionsCount = profileData.connectionProfiles.filter(
      profile => !storedConnections[profile]
    ).length;
    
    // Add new connection profiles
    profileData.connectionProfiles.forEach(profile => {
      if (!storedConnections[profile]) {
        storedConnections[profile] = {
          url: profile,
          status: 'pending',
          retries: 0
        };
      }
    });

    // Store updated connections
    chrome.storage.local.set({ linkedinConnections: storedConnections }, () => {
      console.log('Stored connection profiles:', Object.keys(storedConnections).length);
      showNotification(`Found ${newConnectionsCount} new connections to process`, 'info');
      
      // Start processing pending connections
      processPendingConnections();
    });
  });
}

// Add this function to check daily limit
async function checkDailyLimit() {
  return new Promise(resolve => {
    chrome.storage.local.get(['linkedinDailyStats'], (result) => {
      const today = new Date().toDateString();
      const stats = result.linkedinDailyStats || {};
      
      if (!stats[today]) {
        stats[today] = {
          processed: 0,
          lastUpdate: new Date().getTime()
        };
        chrome.storage.local.set({ linkedinDailyStats: stats });
        resolve(true); // Can process more
      } else {
        resolve(stats[today].processed < 10); // Check if under daily limit
      }
    });
  });
}

// Add this function to update daily count
function updateDailyCount() {
  chrome.storage.local.get(['linkedinDailyStats'], (result) => {
    const today = new Date().toDateString();
    const stats = result.linkedinDailyStats || {};
    
    if (!stats[today]) {
      stats[today] = {
        processed: 1,
        lastUpdate: new Date().getTime()
      };
    } else {
      stats[today].processed += 1;
      stats[today].lastUpdate = new Date().getTime();
    }
    
    chrome.storage.local.set({ linkedinDailyStats: stats });
  });
}

// Modify processPendingConnections to check daily limit
function processPendingConnections() {
  chrome.storage.local.get(['linkedinConnections'], async (result) => {
    const connections = result.linkedinConnections || {};
    
    const pendingConnections = Object.entries(connections)
      .filter(([_, data]) => data.status === 'pending' && data.retries < 3)
      .map(([url, data]) => ({ url, ...data }));

    if (pendingConnections.length === 0) {
      console.log('No pending connections to process');
      return;
    }

    // Check daily limit
    const canProcess = await checkDailyLimit();
    if (!canProcess) {
      showNotification('Daily limit of 10 profiles reached. Please try again tomorrow.', 'warning');
      return;
    }

    // Get today's remaining limit
    chrome.storage.local.get(['linkedinDailyStats'], (result) => {
      const today = new Date().toDateString();
      const stats = result.linkedinDailyStats || {};
      const processedToday = stats[today]?.processed || 0;
      const remainingToday = 10 - processedToday;
      
      // Limit connections to process
      const connectionsToProcess = pendingConnections.slice(0, remainingToday);

      console.log(`Starting to process ${connectionsToProcess.length} pending connections (Daily limit: ${remainingToday} remaining)`);
      
      // Update UI to show progress
      const linkedinDataContainer = document.getElementById('linkedinDataContainer');
      if (linkedinDataContainer) {
        linkedinDataContainer.innerHTML = `
          <div class="connection-extraction-progress">
            <h4>Processing Connections (Daily limit: ${remainingToday} remaining)</h4>
            <div class="progress-container">
              <div class="progress-bar" style="width: 0%"></div>
            </div>
            <div class="progress-status">
              <span class="progress-text">Processing 0/${connectionsToProcess.length}</span>
              <span class="progress-percentage">0%</span>
            </div>
            <div class="status-details">
              <p>Current profile: <span class="current-profile">-</span></p>
              <p>Status: <span class="current-status">Initializing...</span></p>
            </div>
          </div>`;
      }

      // Process connections one by one
      processNextConnection(connectionsToProcess, 0);
    });
  });
}

// Modify processNextConnection to update daily count
function processNextConnection(connections, index) {
  if (index >= connections.length) {
    console.log('Completed processing all connections');
    updateExtractionNotification(connections.length, connections.length, 'success');
    return;
  }

  const connection = connections[index];
  console.log(`Processing connection ${index + 1}/${connections.length}: ${connection.url}`);

  // Update notification with current progress
  updateExtractionNotification(index + 1, connections.length);

  // Create a hidden tab for processing
  chrome.tabs.create({ 
    url: connection.url, 
    active: false, 
    pinned: true 
  }, (newTab) => {
    const processingTabId = newTab.id;

    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === processingTabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        
        setTimeout(() => {
          chrome.tabs.sendMessage(processingTabId, {
            action: "extractLinkedInData",
            url: connection.url
          }, (response) => {
            // Close the processing tab after extraction
            chrome.tabs.remove(processingTabId);

            if (chrome.runtime.lastError || !response || !response.success) {
              console.error('Failed to extract profile:', chrome.runtime.lastError || 'Invalid response');
              updateConnectionStatus(connection.url, 'failed', null, connection.retries + 1);
            } else {
              console.log(connection.url);
              console.log(response.data);
              storeLinkedInContact(response.data);
              updateConnectionStatus(connection.url, 'completed', response.data);
              updateDailyCount(); // Update daily count after successful processing
            }

            // Process next connection after a delay
            setTimeout(() => processNextConnection(connections, index + 1), 5000);
          });
        }, 3000);
      }
    });
  });
}

// Function to update connection status
function updateConnectionStatus(url, status, profileData = null, retries = 0) {
  chrome.storage.local.get(['linkedinConnections', 'linkedinExtractionStatus'], (result) => {
    const connections = result.linkedinConnections || {};
    const extractionStatus = result.linkedinExtractionStatus || {};
    
    connections[url] = {
      ...connections[url],
      status,
      retries,
      lastUpdated: Date.now()
    };

    if (profileData) {
      connections[url].profileData = profileData;
    }

    // Update extraction progress
    if (extractionStatus.inProgress) {
      extractionStatus.processed = Object.values(connections)
        .filter(conn => conn.status === 'completed').length;
      extractionStatus.lastUpdated = Date.now();
    }

    chrome.storage.local.set({ 
      linkedinConnections: connections,
      linkedinExtractionStatus: extractionStatus
    });
  });
}

// Add this function to store LinkedIn contacts
async function storeLinkedInContact(data, refreshDisplay = false) {
  const contact = {
    'Name': data.name || '',
    'E-mail 1 - Value': data.email || '',
    'Organization 1 - Title': data.currentTitle || '',
    'Organization 1 - Name': data.currentCompany || '',
    'Custom Field 1 - Type': 'LinkedIn URL',
    'Custom Field 1 - Value': data.profileUrl || '',
    'Custom Field 2 - Type': 'Connections',
    'Custom Field 2 - Value': data.connections || '',
    'Custom Field 3 - Type': 'Experience',
    'Custom Field 3 - Value': JSON.stringify(data.experience || []),
    'Custom Field 4 - Type': 'Skills',
    'Custom Field 4 - Value': JSON.stringify(data.skills || []),
    'Custom Field 5 - Type': 'Languages',
    'Custom Field 5 - Value': JSON.stringify(data.languages || []),
    'Notes': data.about || '',
    'Location': data.location || '',
    'Education': JSON.stringify(data.education || []),
    'platform': 'LinkedIn',
    'Avatar': data.profilePicture || ''
  };

  let contacts = await getAllContactsFromDB();
  const existingIndex = contacts.findIndex(c => 
    c['Custom Field 1 - Value'] === contact['Custom Field 1 - Value']
  );

  if (existingIndex !== -1) {
    contacts[existingIndex] = { ...contacts[existingIndex], ...contact };
  } else {
    contacts.push(contact);
  }

  await storeInIndexedDB(contacts);
  logActivity('LinkedIn', 'Extract Profile', 1, 'Success', data);

  // Only refresh display if requested
  if (refreshDisplay) {
    displayRegularContent('LinkedIn');
  }
}

// Add new function to handle Twitter content display
async function displayTwitterContent() {
  let contacts = await getAllContactsFromDB().then(contacts => {
    return contacts;
  });
      const content = createTwitterContent(contacts);
      document.getElementById('optionContent').innerHTML = content;
      addTwitterListener();
}

function addTwitterListener() {
  const extractButton = document.getElementById('extractTwitterData');
  if (extractButton) {
      extractButton.addEventListener('click', extractTwitterData);
  } else {
      console.error('Twitter extract button not found');
  }
}

function extractTwitterData() {
  console.log("Attempting to extract Twitter data");
 
   //store the status in local storage 
   chrome.storage.local.set({ExtractionTStatus:{status:'collecting profiles...', current:0, total:0}}, () => {
    console.log('Status stored in local storage');
  });

  chrome.storage.local.get(['twitterFollowing'], (result) => {
    if (result.twitterFollowing && Object.keys(result.twitterFollowing).length > 0) {
      showNotification('Twitter following found in storage, processing...', 'info');
      processPendingFollowing();
      return;
    }
  });
  
  showNotification(
    'Starting Twitter data extraction in background...', 
    'info',
    2000
  );
  chrome.tabs.query({url: ["*://twitter.com/*", "*://x.com/*"]}, function(tabs) {
    if (tabs.length === 0) {
       showNotification('Please open a Twitter profile page in a new tab before extracting data.', 'warning');
      return;
    }

    const twitterTab = tabs[0];

    //twitter url
    const twitterUrl = twitterTab.url;

    //notification message
    const notificationMsg = document.createElement('div');
    notificationMsg.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: #4caf50;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      z-index: 1000;
      font-size: 16px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    notificationMsg.textContent = 'collecting following profiles...';
    document.body.appendChild(notificationMsg);

    const twitterButton=document.querySelector('.twitter');
    twitterButton.textContent='collecting profiles...';
    twitterButton.disabled=true;

    // Send initial extraction message
    chrome.tabs.sendMessage(twitterTab.id, {action: "extractTwitterData", url: twitterUrl,id:1}, async function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
        showNotification('Failed to extract Twitter data'+ chrome.runtime.lastError.message, 'error');
        if (extractButton) extractButton.disabled = false;
        if (loadingIcon) loadingIcon.remove();
        return;
      }

      notificationMsg.remove();

      showNotification(
        `Extracting Twitter data...`, 
        'info',
        5000
      );
      
      if (response && response.success) {
        notificationMsg.remove();
        showNotification(
          `Extracted Twitter data...`, 
          'info',
          5000
        );
        console.log("Received Twitter data:", response.data);
        
        // Store the main profile
        storeTwitterContact(response.data.mainProfile);
        let followingProfiles = response.data.followingProfiles;

        await storeTwitterContacts(followingProfiles);

        showNotification(
          `Found ${followingProfiles.length} profiles to process`, 
          'info',
          5000
        );
        //console.log("Total profiles to process:", combinedProfiles);
        // If there are following profiles, store and process them
        if (followingProfiles.length > 0) {
          storeAndProcessFollowing(followingProfiles);
        }
        
        if (extractButton) extractButton.disabled = false;
        if (loadingIcon) loadingIcon.remove();
      } else {
        console.error('Failed to extract Twitter data. Response:', response);
        alert('Failed to extract Twitter data. Please make sure you are on a Twitter profile page and try again.');
        if (extractButton) extractButton.disabled = false;
        if (loadingIcon) loadingIcon.remove();
      }
    });
  });
}

function storeAndProcessFollowing(profiles) {
  chrome.storage.local.get(['twitterFollowing'], (result) => {
    const storedFollowing = result.twitterFollowing || {};
    
    // Add new following profiles
    profiles.forEach(profile => {
      if (!storedFollowing[profile]) {
        storedFollowing[profile] = {
          url: profile,
          status: 'pending',
          retries: 0
        };
      }
    });

    // Store updated following
    chrome.storage.local.set({ twitterFollowing: storedFollowing }, () => {
      console.log('Stored following profiles:', Object.keys(storedFollowing).length);
      

      // Start processing pending following
      processPendingFollowing();
    });
  });
}

// Add this function to check daily limit
async function TwittercheckDailyLimit() {
  return new Promise(resolve => {
    chrome.storage.local.get(['twitterDailyStats'], (result) => {
      const today = new Date().toDateString();
      const stats = result.twitterDailyStats || {};
      
      if (!stats[today]) {
        stats[today] = {
          processed: 0,
          lastUpdate: new Date().getTime()
        };
        chrome.storage.local.set({ twitterDailyStats: stats });
        resolve(true); // Can process more
      } else {
        resolve(stats[today].processed < 10); // Check if under daily limit
      }
    });
  });
}

// Add this function to update daily count
function TwitterupdateDailyCount() {
  chrome.storage.local.get(['twitterDailyStats'], (result) => {
    const today = new Date().toDateString();
    const stats = result.twitterDailyStats || {};
    
    if (!stats[today]) {
      stats[today] = {
        processed: 1,
        lastUpdate: new Date().getTime()
      };
    } else {
      stats[today].processed += 1;
      stats[today].lastUpdate = new Date().getTime();
    }
    
    chrome.storage.local.set({ twitterDailyStats: stats });
  });
}

function processPendingFollowing() {
  chrome.storage.local.get(['twitterFollowing'], async (result) => {
    const following = result.twitterFollowing || {};
    
    const pendingFollowing = Object.entries(following)
      .filter(([_, data]) => data.status === 'pending' && data.retries < 3)
      .map(([url, data]) => ({ url, ...data }));

    if (pendingFollowing.length === 0) {
      console.log('No pending following to process');
      return;
    }

    const canProcess = await TwittercheckDailyLimit();
    if (!canProcess) {
      showNotification('Daily limit of 10 profiles reached. Please try again tomorrow.', 'warning');
      return;
    }
    
    // Get today's remaining limit
    chrome.storage.local.get(['twitterDailyStats'], (result) => {
      const today = new Date().toDateString();
      const stats = result.twitterDailyStats || {};
      const processedToday = stats[today]?.processed || 0;
      const remainingToday = 10 - processedToday;
      console.log(`Remaining to process: ${remainingToday}`);

    //connections to process
    const connectionsToFollow = pendingFollowing.slice(0, remainingToday);
    console.log(`Connections to process: ${connectionsToFollow.length}`);

    console.log(`Starting to process ${connectionsToFollow.length} pending following`);
    
    // Update UI to show progress
    const twitterDataContainer = document.getElementById('twitterDataContainer');
    if (twitterDataContainer) {
      twitterDataContainer.innerHTML = `
        <div class="following-extraction-progress">
          <p>Processing following profiles... (0/${connectionsToFollow.length})</p>
          <div class="progress-bar"></div>
        </div>`;
    }

    // Process following one by one
    processNextFollowing(connectionsToFollow, 0);
    });
  });
}

function processNextFollowing(following, index) {
  if (index >= following.length) {
    console.log('Completed processing all following');
    updateTwitterNotification(following.length, following.length, 'success');
    const twitterDataContainer = document.getElementById('twitterDataContainer');
    if (twitterDataContainer) {
      twitterDataContainer.innerHTML += '<p>Following processing complete!</p>';
    }
    return;
  }

  const profile = following[index];
  console.log(`Processing following ${index + 1}/${following.length}: ${profile.url}`);
  updateTwitterNotification(index + 1, following.length);

  // Update progress in UI
  const progressElement = document.querySelector('.following-extraction-progress p');
  if (progressElement) {
    progressElement.textContent = `Processing following profiles... (${index + 1}/${following.length})`;
  }

  // Find the Twitter tab and update its URL
  chrome.tabs.query({url: ["*://twitter.com/*", "*://x.com/*"]}, (tabs) => {
    if (tabs.length === 0) {
      console.error('No Twitter tab found');
      updateFollowingStatus(profile.url, 'failed', null, profile.retries + 1);
      setTimeout(() => processNextFollowing(following, index + 1), 1000);
      return;
    }

    // Update the tab URL and wait for page load
    chrome.tabs.update(tabs[0].id, { url: profile.url }, (tab) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
  setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              action: "extractTwitterData",
              url: profile.url
            }, (response) => {
              if (chrome.runtime.lastError || !response || !response.success) {
                console.error('Failed to extract profile:', chrome.runtime.lastError || 'Invalid response');
                updateFollowingStatus(profile.url, 'failed', null, profile.retries + 1);
              } else {
                console.log(response.data.mainProfile);
                storeTwitterContact(response.data.mainProfile);
                updateFollowingStatus(profile.url, 'completed', response.data.mainProfile);
                TwitterupdateDailyCount();
              }

              // Wait before processing next profile
              setTimeout(() => processNextFollowing(following, index + 1), 5000);
            });
          }, 3000); // Wait 3 seconds for dynamic content to load
        }
      });
    });
  });
}

function updateFollowingStatus(url, status, profileData = null, retries = 0) {
  chrome.storage.local.get(['twitterFollowing'], (result) => {
    const following = result.twitterFollowing || {};
    
    following[url] = {
      ...following[url],
      status,
      retries,
      lastUpdated: new Date().toISOString()
    };

    if (profileData) {
      following[url].profileData = profileData;
    }

    chrome.storage.local.set({ twitterFollowing: following });
  });
}

async function storeTwitterContact(data,refreshDisplay=false) {
  const contact = {
    'Name': data.name || '',
    'Custom Field 1 - Type': 'Twitter Handle',
    'Custom Field 1 - Value': data.handle || '',
    'Custom Field 2 - Type': 'Followers',
    'Custom Field 2 - Value': data.followers || '',
    'Custom Field 3 - Type': 'Following',
    'Custom Field 3 - Value': data.following || '',
    'Custom Field 4 - Type': 'Tweets',
    'Custom Field 4 - Value': data.tweets || '',
    'Notes': data.bio || '',
    'Location': data.location || '',
    'Birthday': data.joinDate || '',
    'Website 1 - Value': data.website || '',
    'platform': 'Twitter',
    'url': data.url || '',
    'Avatar': data.profileImageUrl || ''
  };

  let contacts = await getAllContactsFromDB().then(contacts => {
    return contacts;
  });
    
    // Check if contact already exists (by Twitter handle)
    const existingIndex = contacts.findIndex(c => 
      c['Custom Field 1 - Value'] === contact['Custom Field 1 - Value'] &&
      c.platform === 'Twitter'
    );

    if (existingIndex !== -1) {
      contacts[existingIndex] = {
        ...contacts[existingIndex],
        ...contact
      };
    } else {
      contacts.push(contact);
    }

     await storeInIndexedDB(contacts);
      console.log('Twitter contact stored');
      logActivity('Twitter', 'Extract Profile', 1, 'Success', data);
      if(refreshDisplay){
        displayRegularContent('Twitter');
      }
}

function generateCSV(contacts) {
  const headers = [
    'Name', 'Given Name', 'Additional Name', 'Family Name', 'Yomi Name', 'Given Name Yomi', 'Additional Name Yomi', 'Family Name Yomi',
    'Name Prefix', 'Name Suffix', 'Initials', 'Nickname', 'Short Name', 'Maiden Name', 'Birthday', 'Gender', 'Location',
    'Billing Information', 'Directory Server', 'Mileage', 'Occupation', 'Hobby', 'Sensitivity', 'Priority', 'Subject', 'Notes',
    'Language', 'Photo', 'Group Membership', 'E-mail 1 - Type', 'E-mail 1 - Value', 'E-mail 2 - Type', 'E-mail 2 - Value',
    'E-mail 3 - Type', 'E-mail 3 - Value', 'Phone 1 - Type', 'Phone 1 - Value', 'Phone 2 - Type', 'Phone 2 - Value',
    'Phone 3 - Type', 'Phone 3 - Value', 'Phone 4 - Type', 'Phone 4 - Value', 'Address 1 - Type', 'Address 1 - Formatted',
    'Address 1 - Street', 'Address 1 - City', 'Address 1 - PO Box', 'Address 1 - Region', 'Address 1 - Postal Code',
    'Address 1 - Country', 'Address 1 - Extended Address', 'Organization 1 - Type', 'Organization 1 - Name',
    'Organization 1 - Yomi Name', 'Organization 1 - Title', 'Organization 1 - Department', 'Organization 1 - Symbol',
    'Organization 1 - Location', 'Organization 1 - Job Description', 'Organization 2 - Type', 'Organization 2 - Name',
    'Organization 2 - Yomi Name', 'Organization 2 - Title', 'Organization 2 - Department', 'Organization 2 - Symbol',
    'Organization 2 - Location', 'Organization 2 - Job Description', 'Relation 1 - Type', 'Relation 1 - Value',
    'External ID 1 - Type', 'External ID 1 - Value', 'Website 1 - Type', 'Website 1 - Value', 'Website 2 - Type',
    'Website 2 - Value', 'Event 1 - Type', 'Event 1 - Value', 'Custom Field 1 - Type', 'Custom Field 1 - Value'
  ];

  let csvContent = headers.join(',') + '\n';

  contacts.forEach(contact => {
    const row = headers.map(header => {
      let value = contact[header] || '';
      // Escape special characters and wrap in quotes if necessary
      value = value.toString().replace(/"/g, '""');
      return value.includes(',') ? '"' + value + '"' : value;
    });
    csvContent += row.join(',') + '\n';
  });

  return csvContent;
}

function downloadCSV(content, fileName) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function createContactsTable(contacts, platform) {
  // Handle null or undefined inputs
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <i class="material-icons">person_off</i>
      <p>No contacts found${platform ? ` for ${platform}` : ''}</p>
    `;
    return emptyState;
  }

  // Filter contacts based on platform
  const filteredContacts = platform === 'Contacts' || platform === 'Google' ? 
    contacts : 
    contacts.filter(contact => contact?.platform === platform);

  if (filteredContacts.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <i class="material-icons">person_off</i>
      <p>No contacts found for ${platform}</p>
    `;
    return emptyState;
  }

  // Create table with proper structure
  const table = document.createElement('table');
  table.className = 'contacts-table';

  // Define column configurations for all platforms
  const columnConfig = {
    'Twitter': [
      { id: 'avatar', label: 'Avatar', width: '60px' },
      { id: 'name', label: 'Name', width: '150px' },
      { id: 'handle', label: 'Twitter ID', width: '120px' },
      { id: 'bio', label: 'About', width: '120px' },
      { id: 'location', label: 'Location', width: '120px' },
      { id: 'followers', label: 'Followers', width: '100px' },
      { id: 'following', label: 'Following', width: '100px' },
    ],
    'LinkedIn': [
      { id: 'avatar', label: 'Avatar', width: '60px' },
      { id: 'name', label: 'Name', width: '120px' },
      { id: 'location', label: 'Location', width: '100px' },
      { id: 'skills', label: 'Skills', width: '100px' },
      { id: 'title', label: 'Job Title', width: '120px' },
      { id: 'company', label: 'Company', width: '120px' },
      { id: 'education', label: 'Education', width: '120px' },
      { id: 'experience', label: 'Experience', width: '120px' }
    ],
    'Contacts': [
      { id: 'avatar', label: 'Avatar', width: '60px' },
      { id: 'name', label: 'Name', width: '150px' },
      { id: 'contact', label: 'Contact Info', width: '250px' },
      { id: 'skills', label: 'Skills', width: '150px' },
      { id: 'title', label: 'Job Title', width: '150px' },
      { id: 'company', label: 'Company', width: '150px' }
    ],
    'Google': [
      { id: 'avatar', label: 'Avatar', width: '60px' },
      { id: 'name', label: 'Name', width: '150px' },
      { id: 'contact', label: 'Contact Info', width: '200px' },
      { id: 'skills', label: 'Skills', width: '200px' },
      { id: 'title', label: 'Job Title', width: '150px' },
      { id: 'company', label: 'Company', width: '150px' }
    ],
    'Telegram': [
      { id: 'avatar', label: 'Avatar', width: '60px' },
      { id: 'name', label: 'Name', width: '150px' },
      { id: 'username', label: 'Username', width: '120px' },
      { id: 'phone', label: 'Phone', width: '120px' },
      { id: 'bio', label: 'Bio', width: '200px' },
      { id: 'status', label: 'Status', width: '100px' }
    ],
    'WhatsApp': [
      { id: 'avatar', label: 'Avatar', width: '60px' },
      { id: 'name', label: 'Name', width: '150px' },
      { id: 'phone', label: 'Phone', width: '150px' },
      { id: 'status', label: 'Status', width: '200px' },
      { id: 'lastSeen', label: 'Last Seen', width: '150px' }
    ],
    'Discord': [
      { id: 'avatar', label: 'Avatar', width: '60px' },
      { id: 'name', label: 'Name', width: '150px' },
      { id: 'username', label: 'Username', width: '150px' },
      { id: 'status', label: 'Status', width: '150px' },
      { id: 'server', label: 'Server', width: '150px' }
    ]
  };

  // Get columns for current platform, fallback to Contacts configuration
  const columns = columnConfig[platform] || columnConfig['Contacts'];

  // Create header
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  columns.forEach(column => {
    const th = document.createElement('th');
    th.textContent = column.label;
    th.style.width = column.width;
    th.style.minWidth = column.width;
    th.style.maxWidth = column.width;
    headerRow.appendChild(th);
  });

  // Create table body
  const tbody = table.createTBody();
  filteredContacts.forEach((contact, index) => {
    const row = tbody.insertRow();
    row.className = index % 2 === 0 ? 'even' : 'odd';

    columns.forEach(column => {
      const cell = row.insertCell();
      cell.style.width = column.width;
      cell.style.minWidth = column.width;
      cell.style.maxWidth = column.width;
      cell.style.whiteSpace = 'normal';
      cell.style.wordWrap = 'break-word';
      cell.style.overflow = 'hidden';
      cell.style.textOverflow = 'ellipsis';

      if (column.id === 'avatar') {
        const avatar = document.createElement('img');
        if(contact.platform === 'Twitter'){
          console.log(contact['Avatar']);
          avatar.src = contact['Avatar'] || 'person.png';
        }else{
          avatar.src = contact['Photo'] || 'person.png';
        }
        avatar.alt = `${contact['Name']}'s avatar`;
        avatar.className = 'contact-avatar';
        avatar.onerror = () => avatar.src = 'person.png';
        cell.appendChild(avatar);
      } else {
        cell.innerHTML = getCellContent(contact, column.id, platform);
      }
    });
  });

  return table;
}

// Helper function to get cell content
function getCellContent(contact, columnId, platform) {
  if (!contact || !columnId) {
    return '';
  }

  // Common fields across all platforms
  switch (columnId) {
    case 'name':
      return contact['Name'] || '';
    case 'avatar':
      return ''; // Handled separately in table creation
  }

  // Platform-specific field handling
  switch (platform) {
    case 'Twitter':
      return getTwitterContent(contact, columnId);
    case 'LinkedIn':
      return getLinkedInContent(contact, columnId);
    case 'Telegram':
      return getTelegramContent(contact, columnId);
    case 'WhatsApp':
      return getWhatsAppContent(contact, columnId);
    case 'Discord':
      return getDiscordContent(contact, columnId);
    default:
      return getDefaultContent(contact, columnId);
  }
}

// Platform-specific content handlers
function getTwitterContent(contact, columnId) {
  switch (columnId) {
    case 'handle':
      const handle = contact['Custom Field 1 - Value'];
      return handle ? 
        `<a href="https://twitter.com/${handle}" target="_blank">@${handle}</a>` : 
        '';
    case 'bio':
      return contact['Notes'] || '';
    case 'location':
      return contact['Location'] || '';
    case 'followers':
      return contact['Custom Field 2 - Value'] || '';
    case 'following':
      return contact['Custom Field 3 - Value'] || '';
    case 'tweets':
      return contact['Custom Field 4 - Value'] || '';
    default:
      return '';
  }
}

function getLinkedInContent(contact, columnId) {
  switch (columnId) {
    case 'location':
      return contact['Location'] || '';
    case 'skills':
      return formatSkills(contact['Custom Field 4 - Value'] || '');
    case 'title':
      return contact['Organization 1 - Title'] || '';
    case 'company':
      return contact['Organization 1 - Name'] || '';
    case 'education':
      return formatEducation(contact['Education']);
    case 'experience':
      return formatExperience(contact['Custom Field 3 - Value']);
    default:
      return '';
  }
}

function getTelegramContent(contact, columnId) {
  switch (columnId) {
    case 'username':
      return contact['Custom Field 1 - Value'] || '';
    case 'phone':
      return contact['Phone 1 - Value'] || '';
    case 'bio':
      return contact['Notes'] || '';
    case 'status':
      return contact['Custom Field 2 - Value'] || '';
    default:
      return '';
  }
}

function getWhatsAppContent(contact, columnId) {
  switch (columnId) {
    case 'phone':
      return contact['Phone 1 - Value'] || '';
    case 'status':
      return contact['Custom Field 1 - Value'] || '';
    case 'lastSeen':
      return contact['Custom Field 2 - Value'] || '';
    default:
      return '';
  }
}

function getDiscordContent(contact, columnId) {
  switch (columnId) {
    case 'username':
      return contact['Custom Field 1 - Value'] || '';
    case 'status':
      return contact['Custom Field 2 - Value'] || '';
    case 'server':
      return contact['Custom Field 3 - Value'] || '';
    default:
      return '';
  }
}

function getDefaultContent(contact, columnId) {
  switch (columnId) {
    case 'contact':
      return formatContactInfo(contact);
    case 'skills':
      return contact['Custom Field 4 - Value'] || contact['Notes'] || '';
    case 'title':
      return contact['Organization 1 - Title'] || '';
    case 'company':
      return contact['Organization 1 - Name'] || '';
    default:
      return '';
  }
}

// Helper formatting functions
function formatSkills(skills) {
  try {
    const skillsArray = JSON.parse(skills);
    return `<div class="skills-wrapper" style="word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
      ${Array.isArray(skillsArray) ? skillsArray.join(', ') : skills}
    </div>`;
  } catch {
    return `<div class="skills-wrapper" style="word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
      ${skills}
    </div>`;
  }
}

function formatContactInfo(contact) {
  if (!contact) return '';
  
  const info = [];
  
  // Add phone numbers
  for (let i = 1; i <= 4; i++) {
    if (contact[`Phone ${i} - Value`]) {
      info.push(`
        <div class="contact-item" style="word-wrap: break-word; overflow-wrap: break-word; max-width: 100%; margin-bottom: 4px;">
          <i class="material-icons" style="font-size: 16px; color: #6c757d; vertical-align: middle;">phone</i>
          <span style="display: inline-block; vertical-align: middle;">
            ${contact[`Phone ${i} - Value`]}
            ${contact[`Phone ${i} - Type`] ? 
              `<span class="contact-type" style="font-size: 12px; color: #6c757d; margin-left: 4px;">${contact[`Phone ${i} - Type`]}</span>` 
              : ''}
          </span>
        </div>
      `);
    }
  }
  
  // Add email addresses
  for (let i = 1; i <= 3; i++) {
    if (contact[`E-mail ${i} - Value`]) {
      info.push(`
        <div class="contact-item" style="word-wrap: break-word; overflow-wrap: break-word; max-width: 100%; margin-bottom: 4px;">
          <i class="material-icons" style="font-size: 16px; color: #6c757d; vertical-align: middle;">email</i>
          <span style="display: inline-block; vertical-align: middle;">
            ${contact[`E-mail ${i} - Value`]}
            ${contact[`E-mail ${i} - Type`] ? 
              `<span class="contact-type" style="font-size: 12px; color: #6c757d; margin-left: 4px;">${contact[`E-mail ${i} - Type`]}</span>` 
              : ''}
          </span>
        </div>
      `);
    }
  }
  
  return `<div style="max-width: 100%;">${info.join('')}</div>`;
}

function formatEducation(education) {
  try {
    const educationArray = JSON.parse(education || '[]');
    return `<div style="word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
      ${educationArray
        .map(edu => `
          <div class="education-item" style="margin-bottom: 4px;">
            <strong style="display: block; font-size: 13px;">${edu.school}</strong>
            ${edu.degree ? 
              `<div class="degree" style="font-size: 12px; color: #6c757d;">${edu.degree}</div>` 
              : ''}
          </div>
        `)
        .join('')}
    </div>`;
  } catch {
    return '';
  }
}

function formatExperience(experience) {
  try {
    const experienceArray = JSON.parse(experience || '[]');
    return `<div style="word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
      ${experienceArray
        .slice(0, 2)
        .map(exp => `
          <div class="experience-item" style="margin-bottom: 4px;">
            <strong style="display: block; font-size: 13px;">${exp.title}</strong>
            <div class="company" style="font-size: 12px; color: #6c757d;">${exp.company}</div>
          </div>
        `)
        .join('')}
    </div>`;
  } catch {
    return '';
  }
}


function updateContactCount(count) {
  const countSpan = optionContent.querySelector('.contact-count');
  if (countSpan) {
    countSpan.textContent = '(' + count + ')';
  }
}

async function checkStoredContacts() {
  let contacts = await getAllContactsFromDB().then(contacts => {
    return contacts;
  });
  //try catch
  try {
    console.log(contacts);
  } catch (error) {
    console.error('Error retrieving contacts:', error);
  }
}

function findDuplicates(contacts) {
  const duplicates = [];
  const seen = new Map();

  contacts.forEach(contact => {
    const name = contact['Name'] ? contact['Name'].toLowerCase().trim() : '';

    if (name) {
      if (seen.has(name)) {
        seen.get(name).push(contact);
      } else {
        seen.set(name, [contact]);
      }
    }
  });

  for (let [name, contactGroup] of seen) {
    if (contactGroup.length > 1) {
      duplicates.push(contactGroup);
    }
  }

  console.log('Found duplicates:', duplicates);
  return duplicates;
}

function dismissDuplicate(index) {
  console.log('Dismissing duplicate at index:', index);
  // Implement dismiss logic here
  displayMergeAndFix();
}

function findMatchingHeader(csvHeader, commonHeaders) {
  // Direct match
  if (commonHeaders.includes(csvHeader)) {
    return csvHeader;
  }

  // Case-insensitive match
  const lowerCaseHeader = csvHeader.toLowerCase();
  const match = commonHeaders.find(header => header.toLowerCase() === lowerCaseHeader);
  if (match) {
    return match;
  }

  // Partial match
  const partialMatch = commonHeaders.find(header => 
    lowerCaseHeader.includes(header.toLowerCase()) || 
    header.toLowerCase().includes(lowerCaseHeader)
  );
  if (partialMatch) {
    return partialMatch;
  }

  // Special cases
  switch (lowerCaseHeader) {
    case 'first name':
      return 'Given Name';
    case 'last name':
      return 'Family Name';
    case 'email':
    case 'e-mail':
    case 'email address':
      return 'E-mail 1 - Value';
    case 'phone':
    case 'mobile':
      return 'Phone 1 - Value';
    case 'company':
    case 'organization':
      return 'Organization 1 - Name';
    case 'job':
    case 'title':
    case 'position':
      return 'Organization 1 - Title';
  }

  // No match found
  return null;
}

async function displayAndStoreContacts(contacts, platform) {
  let existingContacts = await getAllContactsFromDB().then(contacts => {
    return contacts;
  });
    
    // Convert existing contacts to an array if it's not already
    if (!Array.isArray(existingContacts)) {
      existingContacts = [existingContacts];
    }

    // Ensure each new contact has the correct platform
    contacts = contacts.map(contact => ({...contact, platform: platform}));

    const updatedContacts = existingContacts.concat(contacts);
    await storeInIndexedDB(updatedContacts);
      updateContactCount(updatedContacts.length);
      
      // Immediately display the updated contacts
      displayRegularContent(platform);

      // Log the contacts for debugging
      console.log('Updated contacts:', updatedContacts);
      console.log('Displaying contacts for platform:', platform);
}
// Modify the DOMContentLoaded event listener for sidebar functionality



  
function parseCSV(content, platform) {
  const contacts = [];
  const commonHeaders = [
    'Name', 'Given Name', 'Additional Name', 'Family Name', 'Yomi Name', 'Given Name Yomi', 'Additional Name Yomi', 'Family Name Yomi',
    'Name Prefix', 'Name Suffix', 'Initials', 'Nickname', 'Short Name', 'Maiden Name', 'Birthday', 'Gender', 'Location',
    'Billing Information', 'Directory Server', 'Mileage', 'Occupation', 'Hobby', 'Sensitivity', 'Priority', 'Subject', 'Notes',
    'Language', 'Photo', 'Group Membership', 'E-mail 1 - Type', 'E-mail 1 - Value', 'E-mail 2 - Type', 'E-mail 2 - Value',
    'E-mail 3 - Type', 'E-mail 3 - Value', 'Phone 1 - Type', 'Phone 1 - Value', 'Phone 2 - Type', 'Phone 2 - Value',
    'Phone 3 - Type', 'Phone 3 - Value', 'Phone 4 - Type', 'Phone 4 - Value', 'Address 1 - Type', 'Address 1 - Formatted',
    'Address 1 - Street', 'Address 1 - City', 'Address 1 - PO Box', 'Address 1 - Region', 'Address 1 - Postal Code',
    'Address 1 - Country', 'Address 1 - Extended Address', 'Organization 1 - Type', 'Organization 1 - Name',
    'Organization 1 - Yomi Name', 'Organization 1 - Title', 'Organization 1 - Department', 'Organization 1 - Symbol',
    'Organization 1 - Location', 'Organization 1 - Job Description', 'Organization 2 - Type', 'Organization 2 - Name',
    'Organization 2 - Yomi Name', 'Organization 2 - Title', 'Organization 2 - Department', 'Organization 2 - Symbol',
    'Organization 2 - Location', 'Organization 2 - Job Description', 'Relation 1 - Type', 'Relation 1 - Value',
    'External ID 1 - Type', 'External ID 1 - Value', 'Website 1 - Type', 'Website 1 - Value', 'Website 2 - Type',
    'Website 2 - Value', 'Event 1 - Type', 'Event 1 - Value', 'Custom Field 1 - Type', 'Custom Field 1 - Value'
  ];

  Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      const csvHeaders = results.meta.fields.map(header => header.trim());

      results.data.forEach((row, rowIndex) => {
        let contact = {
          platform: platform
        };

        // Initialize all fields with empty strings
        commonHeaders.forEach(header => {
          contact[header] = '';
        });

        // Map CSV data to our contact object
        csvHeaders.forEach(csvHeader => {
          const value = row[csvHeader];
          const matchingCommonHeader = findMatchingHeader(csvHeader, commonHeaders);
          
          if (matchingCommonHeader) {
            contact[matchingCommonHeader] = value || '';
          } else {
            // If no matching header found, store in Custom Field
            if (!contact['Custom Field 1 - Type']) {
              contact['Custom Field 1 - Type'] = csvHeader;
              contact['Custom Field 1 - Value'] = value || '';
            }
          }
        });

        // Handle "First Name" and "Last Name" specifically
        if (row['First Name'] || row['Last Name']) {
          contact['Given Name'] = row['First Name'] || '';
          contact['Family Name'] = row['Last Name'] || '';
          contact['Name'] = (contact['Given Name'] + ' ' + contact['Family Name']).trim();
        }

        // Ensure Name field is populated if it's still empty
        if (!contact['Name']) {
          contact['Name'] = [contact['Given Name'], contact['Additional Name'], contact['Family Name']]
            .filter(Boolean)
            .join(' ');
        }

        contacts.push(contact);
      });
    }
  });

  return contacts;
}

// Helper functions for activity display
function getPlatformIcon(platform) {
  const icons = {
    'Google': 'account_circle',
    'LinkedIn': 'business',
    'Facebook': 'public',
    'Twitter': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    'WhatsApp': 'chat',
    'Discord': 'forum',
    'Telegram': 'send',
    'Import': 'file_download',
    'Export': 'file_upload',
    'Database': 'cloud_download'
  };
  return icons[platform] || 'merge_type';
}

function formatDate(date) {
  return new Date(date).toLocaleString();
}

async function exportContacts(platform) {
  if (platform === 'Contacts') {      
    let contacts = await getAllContactsFromDB().then(contacts => {
      return contacts;
    });
  if (contacts.length === 0) {
      logActivity('Export', 'Export Contacts', 0, 'Error');
      alert('No contacts to export.');
      return;
    }

    const csvContent = generateCSV(contacts);
    downloadCSV(csvContent, 'contacts.csv');
    logActivity('Export', 'Export Contacts', contacts.length);
  }
  else if (platform === 'LinkedIn') {
    let contacts = await getAllContactsFromDB().then(contacts => {
      // Filter to get only LinkedIn contacts
      return contacts.filter(contact => contact.platform === platform);
    });
    const csvContent = generateCSV(contacts);
    downloadCSV(csvContent, 'linkedin_contacts.csv');
    logActivity('Export', 'Export LinkedIn Contacts', contacts.length);
  }
}

function importContacts(platform) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';

  console.log('importContacts');
  console.log('2420-2420');
  console.log(platform);
  console.log('2423-2423');
  
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target.result;
      const contacts = parseCSV(content, platform);
      if (contacts.length > 0) {
        displayAndStoreContacts(contacts, platform);
        logActivity(platform, 'Import', contacts.length); // Log the activity
        checkStoredContacts();
      } else {
        logActivity(platform, 'Import', 0, 'Error'); // Log failed import
        alert('No valid contacts found in the CSV file.');
      }
    };
    reader.readAsText(file);
  };

  input.click();
}

function createTwitterContent(contacts) {
  let content = '<div class="twitter-container">' +
    '<div id="twitterDataContainer" style="margin-top: 20px;"></div>';

  if (contacts.length > 0) {
    content += '<div class="table-container">' +
      createContactsTable(contacts, 'Twitter').outerHTML +
    '</div>';
  } else {
    content += '<div style="display: flex; justify-content: center; align-items: center; margin-top: 200px;">' +
      '<p style="font-weight: bold; font-size: 1.2em; text-align: center;">No Twitter contacts found</p>' +
    '</div>';
  }

  content += '</div>';
  return content;
}

function displayTelegramData(data) {
  const telegramDataContainer = document.getElementById('telegramDataContainer');
  let content = '<h4>Telegram Information:</h4>';
  
  if (data.contacts && data.contacts.length > 0) {
    content += '<h5>Contacts:</h5>' +
      createTelegramContactsTable(data.contacts).outerHTML;
  } else {
    content += '<p>No contacts found.</p>';
  }

  if (data.channels && data.channels.length > 0) {
    content += '<h5>Channels:</h5>' +
      '<ul>' +
      data.channels.map(channel => `<li>${channel.title} (ID: ${channel.id})</li>`).join('') +
      '</ul>';
  }

  if (data.groups && data.groups.length > 0) {
    content += '<h5>Groups:</h5>' +
      '<ul>' +
      data.groups.map(group => `<li>${group.title} (ID: ${group.id})</li>`).join('') +
      '</ul>';
  }

  telegramDataContainer.innerHTML = content;
}

// Update the createLinkedInContent function to keep instructions
function createLinkedInContent(contacts) {
  let content = '<div class="linkedin-container">' +
    '<div id="linkedinDataContainer" style="margin-top: 20px;"></div>';

  if (contacts.length > 0) {
    content += '<div class="table-container">' +
      createContactsTable(contacts, 'LinkedIn').outerHTML +
    '</div>';
  } else {
    content += '<div style="display: flex; justify-content: center; align-items: center; margin-top: 200px;">' +
      '<p style="font-weight: bold; font-size: 1.2em; text-align: center;">No LinkedIn contacts found.</p>' +
    '</div>';
  }



  content += '</div>';
  return content;
}

function addDiscordListener() {
  document.getElementById('extractDiscordData').addEventListener('click', extractDiscordData);
}
function createDiscordContent(discordInfo, contacts) {
  let content = '<div class="discord-container">' +
    '<h3>Extract Discord Data</h3>' +
    '<p>To extract data from Discord, please follow these steps:</p>' +
    '<ol>' +
      '<li>Open <a href="https://discord.com/app" target="_blank">Discord</a> in a new tab</li>' +
      '<li>Log in to your Discord account (if not already logged in)</li>' +
      '<li>Return to this tab and click on the extraction button below</li>' +
    '</ol>' +
    '<div class="discord-options" style="margin-top: 20px;">' +
      '<button id="extractDiscordData" class="discord-button">Extract Discord User and Group Info</button>' +
    '</div>' +
    '<div id="discordDataContainer" style="margin-top: 20px;"></div>';

  if (discordInfo.user || discordInfo.groups.length > 0) {
    content += '<h4>Extracted Discord Information:</h4>';
    if (discordInfo.user) {
      content += '<h5>User Info:</h5>' +
        '<p>Username: ' + discordInfo.user.username + '</p>';
    }
    if (discordInfo.groups.length > 0) {
      content += '<h5>Groups:</h5>' +
        '<ul>' +
        discordInfo.groups.map(group => '<li>' + group + '</li>').join('') +
        '</ul>';
    }
  }

  content += '</div>';
  return content;
}

function clearContactsAndCache() {
  if (confirm('Are you sure you want to Delete all contacts and cached data? This action cannot be undone.')) {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        console.error('Error clearing data:', chrome.runtime.lastError);
        alert('An error occurred while clearing data. Please try again.');
      } else {
        console.log('All data cleared successfully');
        alert('All contacts and cached data have been cleared.');
        updateMainContent('Contacts'); // Refresh the contacts view
      }
    });
  }
}

function displayClearContactsOption() {
  optionContent.innerHTML = '<h2>Delete</h2>' +
    '<p>Are you sure you want to Delete all contacts? This action cannot be undone.</p>' +
    '<button id="clearContactsButton">Delete all Contacts</button>';
  
  document.getElementById('clearContactsButton').addEventListener('click', clearContactsAndCache);
}

// Update the displayActivityContent function to show database syncs
function displayActivityContent() {
    chrome.storage.local.get(['activityLog'], (result) => {
        const activities = result.activityLog || [];

        const activityTableContainer = `
        <div style="
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          margin-top: 24px;
          overflow: hidden;
        ">
          <div style="
            padding: 16px 24px;
            border-bottom: 1px solid #e8eaed;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <h3 style="margin: 0; color: #202124;">Recent Activities</h3>
          </div>
          
          <div style="overflow-x: auto;">
            <table style="
              width: 100%;
              border-collapse: collapse;
              min-width: 800px;
            ">
              <thead>
                <tr>
                  <th style="
                    padding: 16px 24px;
                    text-align: left;
                    border-bottom: 1px solid #e8eaed;
                    color: #5f6368;
                    font-weight: 500;
                    font-size: 14px;
                    background: #f8f9fa;
                  ">Platform</th>
                  <th style="
                    padding: 16px 24px;
                    text-align: left;
                    border-bottom: 1px solid #e8eaed;
                    color: #5f6368;
                    font-weight: 500;
                    font-size: 14px;
                    background: #f8f9fa;
                  ">Date</th>
                  <th style="
                    padding: 16px 24px;
                    text-align: left;
                    border-bottom: 1px solid #e8eaed;
                    color: #5f6368;
                    font-weight: 500;
                    font-size: 14px;
                    background: #f8f9fa;
                  ">Action</th>
                  <th style="
                    padding: 16px 24px;
                    text-align: left;
                    border-bottom: 1px solid #e8eaed;
                    color: #5f6368;
                    font-weight: 500;
                    font-size: 14px;
                    background: #f8f9fa;
                  ">Contacts</th>
                  <th style="
                    padding: 16px 24px;
                    text-align: left;
                    border-bottom: 1px solid #e8eaed;
                    color: #5f6368;
                    font-weight: 500;
                    font-size: 14px;
                    background: #f8f9fa;
                  ">Status</th>
                </tr>
              </thead>
              <tbody>
                ${activities.map(activity => `
                  <tr>
                    <td style="
                      padding: 16px 24px;
                      border-bottom: 1px solid #e8eaed;
                      color: #202124;
                      font-size: 14px;
                    ">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="material-icons" style="
                          font-size: 20px;
                          color: ${getPlatformColor(activity.platform)};
                        ">
                          ${activity.platform === 'Database' ? 'cloud_download' : getPlatformIcon(activity.platform)}
                        </i>
                        ${activity.platform}
                      </div>
                    </td>
                    <td style="
                      padding: 16px 24px;
                      border-bottom: 1px solid #e8eaed;
                      color: #5f6368;
                      font-size: 14px;
                    ">${formatDate(activity.date)}</td>
                    <td style="
                      padding: 16px 24px;
                      border-bottom: 1px solid #e8eaed;
                      color: #202124;
                      font-size: 14px;
                    ">${activity.action}</td>
                    <td style="
                      padding: 16px 24px;
                      border-bottom: 1px solid #e8eaed;
                      color: #202124;
                      font-size: 14px;
                      font-weight: 500;
                    ">${activity.contactCount}</td>
                    <td style="
                      padding: 16px 24px;
                      border-bottom: 1px solid #e8eaed;
                      font-size: 14px;
                    ">
                      <span style="
                        padding: 4px 12px;
                        border-radius: 16px;
                        font-size: 12px;
                        font-weight: 500;
                        ${getStatusStyle(activity.status)}
                      ">${activity.status}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
        
        let content = `
            <div class="header-container" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">Activity <span class="activity-count">(${activities.length})</span></h2>
                <div class="search-container" style="flex-grow: 1; display: flex; justify-content: center; margin: 0 20px;">
                    <input type="text" id="searchInput" placeholder="Search activities..." style="width: 50%; padding: 8px; border: 1px solid #ddd; border-radius: 15px;">
                </div>
            </div>`;

        if (activities.length > 0) {
            content += activityTableContainer;
        } else {
            content += `
                <div style="text-align: center; padding: 40px;">
                    <i class="material-icons" style="font-size: 48px; color: #ccc;">history</i>
                    <p>No activities recorded yet</p>
                </div>`;
        }

        document.getElementById('optionContent').innerHTML = content;
        addSearchFunctionality();
    });
}

function addSearchFunctionality() {
  const searchInput = document.getElementById('searchInput');
  const table = document.querySelector('table');
  if (table) {
    const rows = table.querySelectorAll('tr');

    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      
      rows.forEach((row, index) => {
        if (index === 0) return; // Skip the header row
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
      });
    });
  }
}

function addIconListeners(platform) {
  const importIcon = document.querySelector('.action-icon[id="importContacts"]');
  const exportIcon = document.querySelector('.action-icon[id="exportContacts"]');
  const extractLinkedInIcon = document.querySelector('.action-icon[id="extractLinkedInData"]');
  const syncIcon = document.querySelector('.action-icon[id="syncContacts"]');

  if (platform === 'Contacts') {
    // const addIcon = document.querySelector('.action-icon[id="addNewContact"]');
    // if (addIcon) {
    //   addIcon.addEventListener('click', () => {
    //     console.log('Add New clicked');
    //     // Implement Add New functionality
    //   });
    // }
  }

  if (syncIcon) {
    syncIcon.addEventListener('click', async () => {
      console.log('Sync clicked');
      const successMsg = document.createElement('div');
      successMsg.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: #4caf50;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          font-size: 16px;
          z-index: 1000;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      `;
      successMsg.innerHTML = `
      <i class="material-icons" style="vertical-align: middle; margin-right: 5px; animation: spin 1s linear infinite;">sync</i>
      Syncing contacts to Firebase...
      `;
      document.body.appendChild(successMsg);
      await syncContactsToFirebase();
      successMsg.innerHTML = `
      <i class="material-icons" style="vertical-align: middle; margin-right: 5px; animation: spin 1s linear infinite;">sync</i>
      Sync complete!
      `;
      setTimeout(() => {
        successMsg.remove();
      }, 2000);
    });
  }

  if (importIcon) {
    importIcon.addEventListener('click', () => {
      console.log('Import clicked');
      importContacts(platform);
    });
  }

  if (exportIcon) {
    exportIcon.addEventListener('click', () => {
      console.log('Export clicked');
      alert('Export clicked');
      exportContacts(platform);
    });
  }

  if (extractLinkedInIcon) {
    extractLinkedInIcon.addEventListener('click', extractLinkedInData);
  }
}

  // Add this near the top of the file, after logActivity and before updateMainContent
  async function displayRegularContent(platform) {
    try {
      // Validate platform parameter with more specific checks
      if (!platform || typeof platform !== 'string') {
        console.error('Invalid platform parameter:', platform);
        throw new Error('Valid platform parameter is required');
      }

      // Define valid platforms - add 'Google' to the list
      const validPlatforms = [
        'Contacts', 
        'WhatsApp', 
        'LinkedIn', 
        'Twitter', 
        'Discord', 
        'Telegram', 
        'Google', 
        'profile'
      ];

      if (!validPlatforms.includes(platform)) {
        console.error('Unsupported platform:', platform);
        throw new Error(`Unsupported platform: ${platform}`);
      }

      const container = document.querySelector('.table-container') || document.createElement('div');
      container.className = 'table-container';
      
      // Show loading state
      container.innerHTML = '';
      container.appendChild(showLoadingState());

      // Get contacts with proper error handling
      const contacts = await getAllContactsFromDB().catch(error => {
        console.error('Error fetching contacts:', error);
        return [];
      });

      // Special handling for Google platform
      if (platform === 'Google') {
        const googleContacts = contacts.filter(contact => contact.platform === 'Contacts');
        
        let content = `
          <div class="header-container" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; width: 25%;">${platform} <span class="contact-count">(${googleContacts.length})</span></h2>
            <div class="search-container" style="flex-grow: 1; display: flex; justify-content: center; margin: 0 20px;">
              <input type="text" id="searchInput" placeholder="Search contacts..." style="width: 50%; padding: 8px; border: 1px solid #ddd; border-radius: 15px;">
            </div>
            <div class="action-icons" style="width: 25%; display: flex; justify-content: flex-end;">
        `;

        content += '</div></div>';
        content += '<div class="table-container"></div>';

        const optionContent = document.getElementById('optionContent');
        if (!optionContent) {
          throw new Error('Option content container not found');
        }

        optionContent.innerHTML = content;
        const tableContainer = optionContent.querySelector('.table-container');
        if (tableContainer) {
          const table = createContactsTable(googleContacts, 'Contacts');
          tableContainer.appendChild(table);
        }

        addSearchFunctionality();
        return;
      }

      // Regular platform handling
      let content = `
        <div class="header-container" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; width: 25%;">${platform} <span class="contact-count">(0)</span></h2>
          <div class="search-container" style="flex-grow: 1; display: flex; justify-content: center; margin: 0 20px;">
            <input type="text" id="searchInput" placeholder="Search contacts..." style="width: 50%; padding: 8px; border: 1px solid #ddd; border-radius: 15px;">
          </div>
          <div class="action-icons" style="width: 25%; display: flex; justify-content: flex-end;">
      `;

      // Add platform-specific icons
      if (platform === 'Contacts') {
        content += `
          <i class="material-icons action-icon" id="exportContacts">file_upload</i>
          <i class="material-icons action-icon" id="syncContacts">sync</i>
        `;
      } else {
        content += '<i class="material-icons action-icon" id="importContacts">file_download</i>';
        
        // Define platforms that support export functionality
        const exportablePlatforms = ['WhatsApp', 'LinkedIn', 'Twitter'];
        if (exportablePlatforms.includes(platform)) {
          content += '<i class="material-icons action-icon" id="exportContacts">file_upload</i>';
          
          // Add LinkedIn-specific extraction icon
          if (platform === 'LinkedIn') {
            // content += '<i class="material-icons action-icon" id="extractLinkedInData">person_search</i>';
          }
        }
      }

      content += '</div></div>';
      content += '<div class="table-container"></div>';

      // Update the DOM
      const optionContent = document.getElementById('optionContent');
      if (!optionContent) {
        throw new Error('Option content container not found');
      }

      optionContent.innerHTML = content;

      // Get the table container and add the contacts table
      const tableContainer = optionContent.querySelector('.table-container');
      if (tableContainer) {
        const table = createContactsTable(contacts, platform);
        tableContainer.appendChild(table);

        // Update contact count
        const filteredContacts = platform === 'Contacts' ? 
          contacts : 
          contacts.filter(contact => contact?.platform === platform);
        updateContactCount(filteredContacts.length);
      }

      // Add event listeners
      addIconListeners(platform);
      addSearchFunctionality();

      // Add platform-specific listeners
      switch (platform) {
        case 'WhatsApp':
          addWhatsAppListeners();
          break;
        case 'Twitter':
          addTwitterListener();
          break;
        case 'Discord':
          addDiscordListener();
          break;
        case 'profile':
          chrome.storage.local.set({lastSelectedContent: 'Profile'}, () => {
            console.log('Last selected content saved:', 'Profile');
          });
          chrome.storage.local.get(['userData'], (result) => {
            console.log('User data:', result.userData);
            showProfileStep(result.userData);
          });
          break;
      }

    } catch (error) {
      console.error('Error displaying content:', error);
      const container = document.querySelector('.table-container');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="material-icons">error</i>
            <p>Error loading contacts: ${error.message}</p>
          </div>
        `;
      }
    }
  }

function displayTelegramContent() {
    chrome.storage.local.get(['telegramInfo', 'contacts'], (result) => {
      const telegramContacts = result.telegramInfo?.contacts || [];
      const allContacts = result.contacts || [];
      const telegramContactCount = allContacts.filter(contact => contact.platform === 'Telegram').length;

      const optionContent = document.getElementById('optionContent');
      optionContent.innerHTML = `
        <div class="telegram-container">
          <div class="header-container" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; width: 25%;">Telegram <span class="contact-count">(${telegramContactCount})</span></h2>
            <div class="search-container" style="flex-grow: 1; display: flex; justify-content: center; margin: 0 20px;">
              <input type="text" id="searchInput" placeholder="Search contacts..." style="width: 50%; padding: 8px; border: 1px solid #ddd; border-radius: 15px;">
            </div>
            <div class="action-icons" style="width: 25%; display: flex; justify-content: flex-end;">
              <i class="material-icons action-icon" id="importContacts">file_download</i>
              <i class="material-icons action-icon" id="exportContacts">file_upload</i>
            </div>
          </div>
          <div class="telegram-options" style="margin-top: 20px;">
            <button id="extractTelegramData" class="telegram-button">Extract Telegram Data</button>
          </div>
          <div id="telegramDataContainer" style="margin-top: 20px;"></div>
        </div>
      `;

      const extractButton = document.getElementById('extractTelegramData');
      extractButton.addEventListener('click', extractTelegramData);

      const searchInput = document.getElementById('searchInput');
      searchInput.addEventListener('input', () => {
        const filteredContacts = searchTelegramContacts(telegramContacts);
        displayTelegramData({ contacts: filteredContacts, channels: result.telegramInfo?.channels, groups: result.telegramInfo?.groups });
      });

      const importIcon = document.getElementById('importContacts');
      importIcon.addEventListener('click', () => importContacts('Telegram'));

      const exportIcon = document.getElementById('exportContacts');
      exportIcon.addEventListener('click', exportContacts);

      displayTelegramData(result.telegramInfo || { contacts: [] });
    });
  }

// Modify the updateMainContent function to check authentication first
function updateMainContent(platform) {
  console.log('updateMainContent');
  console.log('2961-2961');
  console.log('platform', platform);
  // alert('updateMainContent 2961');
  // Clean up any existing content and listeners
  if (window.currentCleanupFunction) {
    window.currentCleanupFunction();
  }

  // Remove any existing message listeners
  if (window.messageListener) {
    chrome.runtime.onMessage.removeListener(window.messageListener);
    window.messageListener = null;
  }

  // Clear any stored data
  window.lastProcessedData = null;

  // Check authentication before showing content
  checkAuthentication().then(async isAuthenticated => {
    if (!isAuthenticated) {
      displayQRAuthScreen();
      return;
    }

    // Rest of your existing updateMainContent code...
    let platformName = "";
    if (platform.includes('Twitter') || platform.includes('WhatsApp') || platform.includes('Discord') || platform.includes('Maps')) {
      platformName = platform.trim();
    } else if (platform.includes('Google') || platform.includes('GContacts')) {
      platformName = 'Google';
    } else if (platform.includes('Telegram')) {
      platformName = 'Telegram';
    } 
    else if (platform.includes('Profile')) {
      platformName = 'Profile';
    }
    else {
      console.log('1721-1721');
      console.log('platform', platform);
      platformName = platform.split(' ').slice(1).join(' ').trim();
    }
      
      console.log('Updating content for platform:', platformName);
  
      // Retrieve any stored data before switching content
       let contacts = await getAllContactsFromDB().then(contacts => {
        return contacts;
       });
        switch(platformName) {
          case 'LinkedIn':
            // alert('displayLinkedInContent');
            const linkedinContent = createLinkedInContent(contacts || []);
            optionContent.innerHTML = linkedinContent;
            // Add event listener for the extract button
            document.getElementById('extractLinkedInData')?.addEventListener('click', extractLinkedInData);
            displayRegularContent(platformName); // Keep existing functionality
            break;
          case 'Contacts':
          case 'Google':
          case 'Facebook':
          case 'Twitter':
          case 'WhatsApp':
          case 'Discord':
            // alert('displayRegularContent 1963');
            displayRegularContent(platformName);
            break;
          case 'Enhance':
            displayMergeAndFix();
            break;
          case 'Import':
            displayImportOptions();
            break;
          case 'Export':
            displayExportOptions();
            break;
          case 'Delete':
            displayClearContactsOption();
            break;
          case 'Maps':
            displayMapsContent();
            break;
          case 'Amazon':
            displayAmazonOrders();
            break;  
          case 'Products':
            displayProducts();
            break;
          case 'Places':
            displayPlacesContent();
            break;    
          case 'Telegram':
            displayTelegramContent();
            break;
          case 'Activity':
            // alert('displayActivityContent');
            displayActivityContent();
            break;
          case 'Profile':
            // alert('displayProfileContent');
            displayProfileContent();
            break;
          default:
            console.log('default');
            console.log('2990-2990');
            console.log('Unknown platform:', platformName);
            displayRegularContent('profile'); // Fallback to Contacts if unknown
        }
  });
}



// Single DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOMContentLoaded initialized'); 
  //linkedinConnectionsare stored in chrome storage
  chrome.storage.local.get(['linkedinConnections'], async (result) => {
    console.log('linkedinConnections', result.linkedinConnections);
    
    // Only proceed if there are LinkedIn connections
    if (result.linkedinConnections && Object.keys(result.linkedinConnections).length > 0) {
      const canScrape = await checkDailyLimit();
      if (canScrape) {
        processPendingConnections();
      }
    }
  });

  chrome.storage.local.get(['twitterFollowing'], async (result) => {
    if (result.twitterFollowing && Object.keys(result.twitterFollowing).length > 0) {
      const canScrape = await TwittercheckDailyLimit();
      if (canScrape) {
        processPendingFollowing();
      }
    }
  });

  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const optionContent = document.getElementById('optionContent');
  const sidebar = document.querySelector('.sidebar');

  // Initialize authentication and user profile
  const result = await new Promise(resolve => {
    chrome.storage.local.get(['isAuthenticated', 'userData', 'lastSelectedContent'], resolve);
  });

  // Handle authentication state
  if (result.isAuthenticated && result.userData) {
    const authContainer = document.querySelector('.auth-container');
    if (authContainer) {
      authContainer.style.display = 'none';
    }
    document.getElementById('userProfile').style.display = 'block';
  } else {
    const authContainer = document.querySelector('.auth-container');
    if (authContainer) {
      authContainer.style.display = 'block';
    }
    document.getElementById('userProfile').style.display = 'none';
  }

  // Initialize sidebar functionality
  sidebar.addEventListener('click', function(event) {
    const target = event.target;
    if (target.classList.contains('sidebar-item')) {
      console.log('sidebar-item clicked');
      const platform = target.dataset.platform;
      //if platform is undefined then it is a profile click
      updateMainContent(platform);
    }
  });


  console.log('sidebarItems', sidebarItems);

  console.log('lastSelectedContent', result.lastSelectedContent);
  // Initialize sidebar items with stored selection
  const lastSelectedOption = result.lastSelectedContent || 'Contacts';
  
  // alert(lastSelectedOption);

  //remove the active class from all sidebar items
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
  });
  
  sidebarItems.forEach(item => {
    item.addEventListener('click', function() {
      // alert('sidebar-item clicked');
      selectSidebarItem1(this);
    });

    const itemText = item.textContent.trim();
    console.log('itemText', itemText);
    console.log('lastSelectedOption', lastSelectedOption);
    if (itemText === lastSelectedOption) {
      console.log('itemText === lastSelectedOption');
      item.classList.add('active');
    }
  });

  if(lastSelectedOption === 'Profile'){
    console.log('1842-1842');
    const profileItem = document.querySelector('#userProfile');
    if(profileItem){
      profileItem.classList.add('active');
    }
    updateMainContent('Profile');
  }
  else{
    console.log('1847-1847');
  // Select default tab if none is active
  if (!document.querySelector('.sidebar-item.active')) {
    const contactsTab = Array.from(sidebarItems).find(item => 
      item.textContent.trim() === 'Contacts'
    );
    if (contactsTab) {
      contactsTab.classList.add('active');
    }
  }
  // Helper function for selecting sidebar items
 


  console.log('1876-1876');// Initialize content
  updateMainContent(lastSelectedOption);
  }

  // Add sync button event listener
  const syncButton = document.getElementById('syncButton');
  if (syncButton) {
    syncButton.addEventListener('click', handleSync);
  }
});

function selectSidebarItem1(selectedItem) {

  const sidebarItems = document.querySelectorAll('.sidebar-item');
  // alert('selectSidebarItem');
  sidebarItems.forEach(i => i.classList.remove('active'));
  selectedItem.classList.add('active');
  const selectedOption = selectedItem.textContent.trim();
  
  optionContent.innerHTML = '<p>Loading...</p>';
  
  chrome.storage.local.set({ lastSelectedContent: selectedOption }, () => {
    console.log('Last selected content saved:', selectedOption);
  });
  
  setTimeout(() => {
    updateMainContent(selectedOption);
  }, 500);
}

function displayProfileContent(){
  console.log('1893-1893');
  document.getElementById('userProfile').style.display = 'block';
  //remove the active class from all sidebar items
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
  });

  chrome.storage.local.set({lastSelectedContent: 'Profile'}, () => {
    console.log('Last selected content saved:', 'Profile');
  });
  //add the active class to the profile item
  document.querySelector('#userProfile').classList.add('active');
  chrome.storage.local.get(['userData'], (result) => {
    console.log('User data:', result.userData);
    showProfileStep(result.userData);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const whatsappDataContainer = document.getElementById('whatsappDataContainer');
  
  if (message.action === "extractionProgress") {
    const progressElement = document.getElementById('extractionProgress');
    if (progressElement) {
      progressElement.textContent = `${Math.round(message.progress * 100)}% (${message.currentContact}/${message.totalContacts})`;
    }
  } else if (message.action === "extractionComplete") {
    whatsappDataContainer.innerHTML = '<p>Extraction complete! Contacts have been saved.</p>';
    displayRegularContent('WhatsApp');
  } else if (message.action === "extractionError") {
    whatsappDataContainer.innerHTML = `<p>Error during extraction: ${message.error}</p>`;
    if (message.error === "Please open WhatsApp Web before starting extraction") {
      whatsappDataContainer.innerHTML += '<p>Please open <a href="https://web.whatsapp.com" target="_blank">WhatsApp Web</a> in a new tab, then try again.</p>';
    }
  }
});

// Add these notification-related functions near the top of the file
function showNotification(message, type = 'info', duration = 3000) {
  // Remove any existing notification
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  // Set background color based on type
  switch (type) {
    case 'success':
      notification.style.backgroundColor = '#4caf50';
      break;
    case 'error':
      notification.style.backgroundColor = '#f44336';
      break;
    case 'warning':
      notification.style.backgroundColor = '#ff9800';
      break;
    default:
      notification.style.backgroundColor = '#2196f3';
  }

  // Add icon based on type
  const icon = document.createElement('i');
  icon.className = 'material-icons';
  icon.textContent = type === 'success' ? 'check_circle' : 
                    type === 'error' ? 'error' : 
                    type === 'warning' ? 'warning' : 'info';
  notification.appendChild(icon);

  // Add message
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  notification.appendChild(messageSpan);

  // Add to document
  document.body.appendChild(notification);

  // Remove after duration
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

function updateTwitterNotification(current, total, status = 'processing') {
   chrome.storage.local.set({ExtractionTStatus: {current, total, status}}, () => {
      status = status;
      current = current;
      total = total;
   });
   const twitterButton=document.querySelector('.twitter');
   if(twitterButton){
    twitterButton.disabled = true;
    twitterButton.style.backgroundColor = 'white';
    const ButtonTemplate = `
    <div class="extraction-status" style="background-color: white; border: 1px solid #90CAF9; border-radius: 4px;  position: relative; overflow: hidden; min-width: 140px; height: 20px;">
    <i class="material-icons spinning" style="color: #1976D2;">sync</i>
    <span class="status-text" style="color: #1976D2;">Processing: ${current} of ${total}</span>
    <div class="progress-bar" style="width: ${(current / total) * 100}%; background: #1976D2; height: 100%; position: absolute; left: 0; top: 0; opacity: 0.5;"></div>
    </div>
    `;
    twitterButton.innerHTML = ButtonTemplate;
    twitterButton.classList.add('extracting');
   }
   if(status === 'success' || status === 'error'){
    twitterButton.classList.remove('extracting');
    twitterButton.disabled = false;
    twitterButton.style.backgroundColor = '#388e3c';
    twitterButton.innerHTML = 'Extraction completed';
   }
}

// Add this function to manage the persistent notification
function updateExtractionNotification(current, total, status = 'processing') {

   chrome.storage.local.set({extractionStatus: {current, total, status}}, () => {
      status = status;
      current = current;
      total = total;
   });

    //start extractio button
    const extractButton = document.querySelector('.linkedin');
    if (extractButton) {
      extractButton.disabled = true;
      extractButton.style.backgroundColor = 'white';

      // Create template using template literals for better readability
      const buttonTemplate = `
        <div class="extraction-status" style="background-color: #E3F2FD; border: 1px solid #90CAF9; border-radius: 4px;  position: relative; overflow: hidden; min-width: 250px; height: 36px;">
          <i class="material-icons spinning" style="color: #1976D2;">sync</i>
          <span class="status-text" style="color: #1976D2;">Processing: ${current} of ${total}</span>
          <div class="progress-bar" style="width: ${(current / total) * 100}%; background: #1976D2; height: 100%; position: absolute; left: 0; top: 0; opacity: 0.5;"></div>
        </div>
      `;

      extractButton.innerHTML = buttonTemplate;
      extractButton.classList.add('extracting');
    }

  // If process is complete, remove notification after delay
  if (status === 'success' || status === 'error') {
    extractButton.classList.remove('extracting');
    extractButton.disabled = false;
    extractButton.style.backgroundColor = '#388e3c';
    extractButton.innerHTML = 'Extraction completed';
  }
}

// Update the processNextConnection function
function processNextConnection(connections, index) {
  if (index >= connections.length) {
    console.log('Completed processing all connections');
    updateExtractionNotification(connections.length, connections.length, 'success');
    return;
  }

  const connection = connections[index];
  console.log(`Processing connection ${index + 1}/${connections.length}: ${connection.url}`);

  // Update notification with current progress
  updateExtractionNotification(index + 1, connections.length);

  // Create a hidden tab for processing
  chrome.tabs.create({ 
    url: connection.url, 
    active: false, 
    pinned: true 
  }, (newTab) => {
    const processingTabId = newTab.id;

    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === processingTabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        
        setTimeout(() => {
          chrome.tabs.sendMessage(processingTabId, {
            action: "extractLinkedInData",
            url: connection.url
          }, (response) => {
            // Close the processing tab after extraction
            chrome.tabs.remove(processingTabId);

            if (chrome.runtime.lastError || !response || !response.success) {
              console.error('Failed to extract profile:', chrome.runtime.lastError || 'Invalid response');
              updateConnectionStatus(connection.url, 'failed', null, connection.retries + 1);
            } else {
              storeLinkedInContact(response.data);
              updateConnectionStatus(connection.url, 'completed', response.data);
              updateDailyCount(); // Update daily count after successful processing
            }

            // Process next connection after a delay
            setTimeout(() => processNextConnection(connections, index + 1), 5000);
          });
        }, 3000);
      }
    });
  });
}


const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-20px); }
  }
  
  .extraction-notification {
    transition: background-color 0.3s;
  }

  .start-extraction-btn.linkedin {
    min-width: 250px;
    transition: all 0.3s ease;
  }

  .start-extraction-btn.linkedin.extracting {
    background-color: white;  // Changed from #f5f5f5 to white
    cursor: not-allowed;
  }

  .extraction-status {
    display: flex;
    align-items: center;
    gap: 12px;
    background: white;  // Changed from #E3F2FD to white
    border: 1px solid #90CAF9;
    border-radius: 4px;
    position: relative;
    overflow: hidden;
    min-width: 140px;
    height: 20px;
  }

  .status-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .status-header .material-icons.spinning {
    animation: spin 2s linear infinite;
  }

  .status-progress {
    margin-bottom: 8px;
    font-size: 14px;
  }

  .progress-bar-container {
    background: rgba(0, 0, 0, 0.1);
    height: 4px;
    border-radius: 2px;
    margin-bottom: 4px;
  }

  .progress-bar {
    height: 100%;
    background: #0077b5;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-percentage {
    font-size: 12px;
    text-align: right;
  }

  .extraction-status {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #E3F2FD;
    border: 1px solid #90CAF9;
    border-radius: 4px;
    padding: 8px 16px;
    position: relative;
    overflow: hidden;
    min-width: 140px;
    height: 20px;
  }

  .material-icons.spinning {
    color: #1976D2;
    animation: spin 1.5s linear infinite;
    font-size: 20px;
  }

  .status-text {
    color: #1976D2;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    z-index: 1;
  }

  .progress-bar {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: #BBDEFB;
    transition: width 0.3s ease;
    opacity: 0.5;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Add this function to handle the sync operation
async function handleSync() {
  const syncButton = document.getElementById('syncButton');
  
  // Disable button and show spinning animation
  syncButton.disabled = true;
  syncButton.querySelector('i').style.animation = 'spin 1s linear infinite';
  
  try {
    // Show notification that sync is starting
    showNotification('Starting synchronization...', 'info');
    
    // Get all contacts from IndexedDB

    await syncContactsToFirebase();
    
    // Log the sync activity
    logActivity('Database', 'Sync', contacts.length);
    
    // TODO: Add your sync logic here
    // For example, sync with a remote server or cloud storage
    
    // Simulate sync delay (remove this in production)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Show success notification
    showNotification('Synchronization completed successfully!', 'success');
    
  } catch (error) {
    console.error('Sync failed:', error);
    showNotification('Sync failed: ' + error.message, 'error');
    logActivity('Database', 'Sync', 0, 'Error');
  } finally {
    // Re-enable button and stop spinning animation
    syncButton.disabled = false;
    syncButton.querySelector('i').style.animation = '';
  }
}

// Add these CSS styles to your existing styles
const additionalStyles = `
  .floating-sync-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background-color: #1976D2;
    color: white;
    border: none;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.3s, transform 0.3s;
  }

  .floating-sync-button:hover {
    background-color: #1565C0;
    transform: scale(1.05);
  }

  .floating-sync-button:active {
    transform: scale(0.95);
  }

  .floating-sync-button:disabled {
    background-color: #90CAF9;
    cursor: not-allowed;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Add the styles to the document
const styleElement = document.createElement('style');
styleElement.textContent = additionalStyles;
document.head.appendChild(styleElement);


const tableStyles = document.createElement('style');
tableStyles.textContent = `
  .contacts-table {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    width: 100%;
    border-collapse: collapse;
    background: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    border-radius: 8px;
    overflow: hidden;
    margin: 20px 0;
  }

  .contacts-table thead th {
    background: #f8f9fa;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 12px;
    letter-spacing: 0.5px;
    padding: 16px;
    text-align: left;
    border-bottom: 2px solid #e9ecef;
    color: #495057;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .contacts-table tbody tr {
    transition: background-color 0.2s;
  }

  .contacts-table tbody tr:nth-child(even) {
    background-color: #f8f9fa;
  }

  .contacts-table tbody tr:hover {
    background-color: #e9ecef;
  }

  .contacts-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #e9ecef;
    vertical-align: middle;
    color: #212529;
    font-size: 14px;
  }

  .contact-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #e9ecef;
    transition: transform 0.2s;
  }

  .contact-avatar:hover {
    transform: scale(1.1);
  }

  .contact-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    background: #f8f9fa;
    transition: background-color 0.2s;
  }

  .contact-item:hover {
    background: #e9ecef;
  }

  .contact-type {
    font-size: 11px;
    color: #6c757d;
    background: #e9ecef;
    padding: 2px 6px;
    border-radius: 12px;
    margin-left: 4px;
    border: 1px solid #dee2e6;
  }

  .table-container {
    padding: 20px;
    background: #f8f9fa;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    margin: 20px 0;
    overflow: auto;
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: #6c757d;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #6c757d;
  }

  .loading-spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
    margin-right: 12px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

document.head.appendChild(tableStyles);

// Add these styles right after the existing tableStyles
const additionalTableStyles = document.createElement('style');
additionalTableStyles.textContent = `
  .contacts-table {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    animation: fadeIn 0.3s ease-in;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .contacts-table th {
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(8px);
  }

  .contacts-table tbody tr {
    cursor: pointer;
  }

  .contact-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 4px;
    background: #f8f9fa;
    transition: background-color 0.2s;
  }

  .contact-item:hover {
    background: #e9ecef;
  }

  .contact-type {
    font-size: 11px;
    color: #6c757d;
    background: #e9ecef;
    padding: 2px 6px;
    border-radius: 12px;
    margin-left: 4px;
    border: 1px solid #dee2e6;
  }

  .education-item, .experience-item {
    margin-bottom: 8px;
    font-size: 13px;
    padding: 6px;
    border-radius: 4px;
    background: #f8f9fa;
  }

  .education-item strong, .experience-item strong {
    color: #495057;
    display: block;
    margin-bottom: 2px;
  }

  .degree, .company {
    color: #6c757d;
    font-size: 12px;
    margin-top: 2px;
    font-style: italic;
  }

  .table-container {
    padding: 20px;
    background: #f8f9fa;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    margin: 20px 0;
  }

  /* Scrollbar styling */
  .table-container::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .table-container::-webkit-scrollbar-track {
    background: #f1f3f5;
    border-radius: 4px;
  }

  .table-container::-webkit-scrollbar-thumb {
    background: #ced4da;
    border-radius: 4px;
  }

  .table-container::-webkit-scrollbar-thumb:hover {
    background: #adb5bd;
  }

  /* Avatar hover effect */
  .contacts-table img {
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .contacts-table img:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  /* Empty state styling */
  .empty-state {
    text-align: center;
    padding: 40px;
    color: #6c757d;
  }

  .empty-state i {
    font-size: 48px;
    margin-bottom: 16px;
    color: #adb5bd;
  }

  /* Loading state */
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #6c757d;
  }

  .loading-spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
    margin-right: 12px;
  }
`;

document.head.appendChild(additionalTableStyles);

// Add loading state function
function showLoadingState() {
  const loadingState = document.createElement('div');
  loadingState.className = 'loading-state';
  loadingState.innerHTML = `
    <div class="loading-spinner"></div>
    <span>Loading contacts...</span>
  `;
  return loadingState;
}

// Helper function to get platform-specific colors
function getPlatformColor(platform) {
  const colors = {
    'LinkedIn': '#0077B5',
    'Twitter': '#1DA1F2',
    'Google': '#4285F4',
    'Database': '#34A853',
    'Default': '#5f6368'
  };
  return colors[platform] || colors.Default;
}

// Helper function to get status-specific styles
function getStatusStyle(status) {
  const styles = {
    'Completed': 'background: #E6F4EA; color: #1E8E3E;',
    'In Progress': 'background: #FEF7E0; color: #F9AB00;',
    'Failed': 'background: #FCE8E6; color: #D93025;',
    'Default': 'background: #F1F3F4; color: #5F6368;'
  };
  return styles[status] || styles.Default;
}

// Helper function to get platform-specific icons
function getPlatformIcon(platform) {
  const icons = {
    'LinkedIn': 'business',
    'Twitter': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="color: #4285F4;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path> </svg>',
    'Google': 'account_circle',
    'Default': 'circle'
  };
  return icons[platform] || icons.Default;
}