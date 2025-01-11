// LinkedIn data extraction script
async function extractLinkedInProfile() {
  const profile = {};

  // Add profile picture extraction
  const profilePicElement = document.querySelector('.pv-top-card-profile-picture__image') || 
                          document.querySelector('.profile-photo-edit__preview') ||
                          document.querySelector('.presence-entity__image');
  if (profilePicElement) {
    profile.profilePicture = profilePicElement.src;
  }

  // Extract basic info - updated selector for name
  profile.name = document.querySelector('.RIbnCAsTbWzbdDScQkPGXRrQHSaITKZWQhh')?.textContent.trim() || 
                 document.querySelector('h1.inline.t-24')?.textContent.trim() || 
                 document.querySelector('.text-heading-xlarge')?.textContent.trim() || '';

  profile.profileUrl = window.location.href;

  // Extract current position and company
  const positionElement = document.querySelector('.text-body-medium.break-words');
  if (positionElement) {
    const positionText = positionElement.textContent.trim();
    const match = positionText.match(/(.*?)\s+at\s+(.*)/);
    if (match) {
      profile.currentTitle = match[1].trim();
      profile.currentCompany = match[2].trim();
    } else {
      profile.currentTitle = positionText;
    }
  }

  // Extract connections
  const connectionsElement = document.querySelector('.t-bold');
  if (connectionsElement) {
    const connectionsText = connectionsElement.textContent.trim();
    profile.connections = connectionsText.replace(/\D/g, '');
  }

  // Extract location
  const locationElement = document.querySelector('.text-body-small.inline.t-black--light.break-words');
  if (locationElement) {
    profile.location = locationElement.textContent.trim();
  }

  // Extract about/summary
  const aboutSection = document.querySelector('#about')?.parentElement;
  if (aboutSection) {
    profile.about = aboutSection.querySelector('.inline-show-more-text')?.textContent.trim() || '';
  }

  // Extract experience
  profile.experience = [];
  const experienceSection = document.querySelector('#experience')?.parentElement;
  if (experienceSection) {
    const experiences = experienceSection.querySelectorAll('li.artdeco-list__item');
    experiences.forEach(exp => {
      const experience = {
        title: exp.querySelector('.t-bold span')?.textContent.trim() || '',
        company: exp.querySelector('.t-normal.t-black--light span')?.textContent.trim() || '',
        duration: exp.querySelector('span.t-normal.t-black--light:not(:first-child)')?.textContent.trim() || '',
        location: exp.querySelector('.experience-item__location span')?.textContent.trim() || ''
      };
      if (experience.title || experience.company) {
        profile.experience.push(experience);
      }
    });
  }

  // Extract skills
  profile.skills = [];
  const skillsSection = document.querySelector('#skills')?.parentElement;
  if (skillsSection) {
    const skills = skillsSection.querySelectorAll('.artdeco-list__item');
    skills.forEach(skill => {
      const skillName = skill.querySelector('.t-bold span')?.textContent.trim();
      if (skillName) {
        profile.skills.push(skillName);
      }
    });
  }

  // Extract languages
  profile.languages = [];
  const languagesSection = document.querySelector('#languages')?.parentElement;
  if (languagesSection) {
    const languages = languagesSection.querySelectorAll('.artdeco-list__item');
    languages.forEach(lang => {
      const language = {
        name: lang.querySelector('.t-bold span')?.textContent.trim() || '',
        proficiency: lang.querySelector('.t-normal.t-black--light span')?.textContent.trim() || ''
      };
      if (language.name) {
        profile.languages.push(language);
      }
    });
  }

  // Extract education
  profile.education = [];
  const educationSection = document.querySelector('#education')?.parentElement;
  if (educationSection) {
    const educationItems = educationSection.querySelectorAll('li.artdeco-list__item');
    educationItems.forEach(edu => {
      const education = {
        school: edu.querySelector('.t-bold span')?.textContent.trim() || '',
        degree: edu.querySelector('.t-normal.t-black--light span')?.textContent.trim() || '',
        period: edu.querySelector('span.t-normal.t-black--light:not(:first-child)')?.textContent.trim() || '',
        fieldOfStudy: edu.querySelector('.education__item--details span:nth-child(2)')?.textContent.trim() || ''
      };
      if (education.school) {
        profile.education.push(education);
      }
    });
  }

  // Extract connections list
  profile.connectionProfiles = [];
  const connectionsButton = document.querySelector('a[href*="/mynetwork/invite-connect/connections/"]');
  if (connectionsButton) {
    try {
      // Click connections button to open connections page
      connectionsButton.click();
      
      // Wait for connections page to load and verify it's loaded correctly
      await new Promise(async (resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
          const connectionsList = document.querySelectorAll('.mn-connection-card');
          if (connectionsList.length > 0) {
            resolve();
            break;
          }
          await new Promise(r => setTimeout(r, 3000));
          attempts++;
        }
        if (attempts >= maxAttempts) {
          reject(new Error('Connections page failed to load'));
        }
      });

      // Function to scroll and collect connections with retry mechanism
      async function scrollAndCollectConnections() {
        const connections = new Set();
        let previousHeight = 0;
        let scrollAttempts = 0;
        let noChangeCount = 0;
        const maxScrollAttempts = 200; // Increased for larger connection lists
        const maxNoChange = 3;

        while (scrollAttempts < maxScrollAttempts && noChangeCount < maxNoChange) {
          // Get all connection cards currently visible
          const connectionsList = document.querySelectorAll('.mn-connection-card');
          const beforeCount = connections.size;
          
          connectionsList.forEach(connection => {
            const profileLink = connection.querySelector('a[href*="/in/"]')?.href;
            if (profileLink) {
              connections.add(profileLink);
            }
          });

          // Check for and click "Show more results" button
          const showMoreButton = document.querySelector('button.scaffold-finite-scroll__load-button');
          if (showMoreButton && showMoreButton.offsetParent !== null) { // Check if button is visible
            try {
              showMoreButton.click();
              // Wait longer after clicking "Show more"
              await new Promise(resolve => setTimeout(resolve, 3000));
              noChangeCount = 0; // Reset count after clicking show more
              console.log('Clicked "Show more results" button');
              continue;
            } catch (error) {
              console.error('Error clicking show more button:', error);
            }
          }

          // Check if we added any new connections
          if (connections.size === beforeCount) {
            noChangeCount++;
          } else {
            noChangeCount = 0; // Reset if we found new connections
          }

          // Scroll with a more reliable method
          const scrollHeight = document.documentElement.scrollHeight;
          window.scrollTo({
            top: scrollHeight - 1500, // Scroll to slightly above bottom to trigger loading
            behavior: 'smooth'
          });
          
          // Wait longer for content to load
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Verify we're still on the connections page
          if (!document.querySelector('.mn-connection-card')) {
            throw new Error('Lost connection cards - possible session timeout');
          }

          // Check scroll position
          const currentHeight = document.documentElement.scrollHeight;
          if (currentHeight === previousHeight && !showMoreButton) {
            noChangeCount++;
          } else {
            previousHeight = currentHeight;
            noChangeCount = 0;
          }
          
          scrollAttempts++;
          console.log(`Collected ${connections.size} connections. Scroll attempt: ${scrollAttempts}, No change count: ${noChangeCount}`);

          // Add a small delay between scrolls
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Verify we collected a reasonable number of connections
        const expectedConnections = document.querySelector('.t-bold')?.textContent.trim().replace(/\D/g, '');
        if (expectedConnections && connections.size < parseInt(expectedConnections) * 0.8) {
          throw new Error(`Only collected ${connections.size} of ${expectedConnections} expected connections`);
        }

        return Array.from(connections);
      }

      // Add retry mechanism for the entire collection process
      let retryAttempts = 0;
      const maxRetries = 3;
      
      while (retryAttempts < maxRetries) {
        try {
          profile.connectionProfiles = await scrollAndCollectConnections();
          console.log('Total connections collected:', profile.connectionProfiles.length);
          break;
        } catch (error) {
          retryAttempts++;
          console.error(`Collection attempt ${retryAttempts} failed:`, error);
          
          if (retryAttempts >= maxRetries) {
            throw new Error('Failed to collect connections after multiple attempts');
          }
          
          // Wait before retry and refresh the page
          await new Promise(resolve => setTimeout(resolve, 5000));
          window.location.reload();
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

    } catch (error) {
      console.error('Error extracting connections:', error);
      throw error; // Propagate error for handling upstream
    }
  }

  console.log('Extracted profile:', profile);
  return profile;
}

// Function to wait for page load
async function waitForPageLoad() {
  const maxAttempts = 10;
  const checkInterval = 1000; // 1 second

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check for key elements that indicate the profile has loaded
    const nameElement = document.querySelector('.RIbnCAsTbWzbdDScQkPGXRrQHSaITKZWQhh') || 
                       document.querySelector('h1.inline.t-24') || 
                       document.querySelector('.text-heading-xlarge');
    
    const positionElement = document.querySelector('.text-body-medium.break-words');
    
    if (nameElement && positionElement) {
      // Additional wait to ensure dynamic content loads
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error('Page failed to load completely');
}

// Update the extractConnectionProfile function
async function extractConnectionProfile(profileUrl) {
  try {
    // Store current URL to return later
    const originalUrl = window.location.href;

    // Navigate to the profile
    window.location.href = profileUrl;
    
    // Wait for page to load
    await waitForPageLoad();
    
    // Extract profile data
    const profileData = await extractLinkedInProfile();

    // Return to original URL
    window.location.href = originalUrl;
    await new Promise(resolve => setTimeout(resolve, 3000));

    return profileData;
  } catch (error) {
    console.error('Error in extractConnectionProfile:', error);
    throw new Error(`Failed to extract profile at ${profileUrl}: ${error.message}`);
  }
}

// Add new function to handle connection profiles storage and processing
async function handleConnectionProfiles(profileData) {
  try {
    // First store the connection profiles
    await new Promise((resolve, reject) => {
      chrome.storage.local.get(['linkedinConnections'], (result) => {
        const storedConnections = result.linkedinConnections || {};
        
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

        chrome.storage.local.set({ linkedinConnections: storedConnections }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    });

    // Then process pending connections
    await processPendingConnections();
  } catch (error) {
    console.error('Error handling connection profiles:', error);
    throw error;
  }
}

// Add function to process pending connections
async function processPendingConnections() {
  try {
    const { linkedinConnections } = await new Promise(resolve => {
      chrome.storage.local.get(['linkedinConnections'], resolve);
    });

    if (!linkedinConnections) return;

    const pendingConnections = Object.entries(linkedinConnections)
      .filter(([_, data]) => data.status === 'pending' && data.retries < 3)
      .map(([url, data]) => ({ url, ...data }));

    if (pendingConnections.length === 0) {
      console.log('No pending connections to process');
      return;
    }

    // Send start message
    chrome.runtime.sendMessage({
      action: "startConnectionExtraction",
      total: pendingConnections.length
    });

    // Process each pending connection
    for (let i = 0; i < pendingConnections.length; i++) {
      const connection = pendingConnections[i];
      
      try {
        // Wait between profile extractions
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        const connectionProfile = await extractConnectionProfile(connection.url);
        
        // Update storage with success status
        await updateConnectionStatus(connection.url, 'completed', connectionProfile);
        
        // Send progress message
        chrome.runtime.sendMessage({
          action: "connectionProfileExtracted",
          data: connectionProfile,
          current: i + 1,
          total: pendingConnections.length
        });
      } catch (error) {
        console.error(`Error processing connection ${connection.url}:`, error);
        
        // Update retry count and status
        await updateConnectionStatus(connection.url, 'failed', null, connection.retries + 1);
        
        // Send error message
        chrome.runtime.sendMessage({
          action: "connectionExtractionError",
          error: error.message,
          profileUrl: connection.url
        });
      }
    }

    // Send completion message
    chrome.runtime.sendMessage({
      action: "connectionExtractionComplete"
    });
  } catch (error) {
    console.error('Error processing pending connections:', error);
    throw error;
  }
}

// Add helper function to update connection status
async function updateConnectionStatus(url, status, profileData = null, retries = 0) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['linkedinConnections'], (result) => {
      const connections = result.linkedinConnections || {};
      
      connections[url] = {
        ...connections[url],
        status,
        retries,
        lastUpdated: new Date().toISOString()
      };

      if (profileData) {
        connections[url].profileData = profileData;
      }

      chrome.storage.local.set({ linkedinConnections: connections }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  });
}

// Update the processNextConnection function
async function processNextConnection(connections, index) {
  if (index >= connections.length) {
    console.log('Completed processing all connections');
    chrome.runtime.sendMessage({
      action: "connectionExtractionComplete"
    });
    return;
  }

  const connection = connections[index];
  console.log(`Processing connection ${index + 1}/${connections.length}: ${connection.url}`);

  try {
    // Request navigation to profile
    chrome.runtime.sendMessage({
      action: "navigateToProfile",
      url: connection.url
    });

    // Wait for navigation completion message
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Navigation timeout'));
      }, 30000); // 30 second timeout

      chrome.runtime.onMessage.addListener(function listener(message) {
        if (message.action === "profilePageLoaded" && message.url === connection.url) {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          resolve();
        }
      });
    });

    // Wait additional time for dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract profile data
    const profileData = await extractBasicProfile();
    
    // Update storage with success status and profile data
    await updateConnectionStatus(connection.url, 'completed', profileData);
    
    // Send progress message
    chrome.runtime.sendMessage({
      action: "connectionProfileExtracted",
      data: profileData,
      current: index + 1,
      total: connections.length
    });

    // Wait before processing next connection
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Process next connection
    await processNextConnection(connections, index + 1);
  } catch (error) {
    console.error(`Error processing connection ${connection.url}:`, error);
    
    // Update retry count and status
    await updateConnectionStatus(connection.url, 'failed', null, connection.retries + 1);
    
    // Send error message
    chrome.runtime.sendMessage({
      action: "connectionExtractionError",
      error: error.message,
      profileUrl: connection.url
    });

    // Continue with next connection after error
    await new Promise(resolve => setTimeout(resolve, 5000));
    await processNextConnection(connections, index + 1);
  }
}

// Add function to extract basic profile data
async function extractBasicProfile() {
  try {
    const profile = {};

    // Add profile picture extraction
    const profilePicElement = document.querySelector('.pv-top-card-profile-picture__image') || 
                            document.querySelector('.profile-photo-edit__preview') ||
                            document.querySelector('.presence-entity__image');
    if (profilePicElement) {
      profile.profilePicture = profilePicElement.src;
    }

    // Extract basic info
    profile.name = document.querySelector('.RIbnCAsTbWzbdDScQkPGXRrQHSaITKZWQhh')?.textContent.trim() || 
                   document.querySelector('h1.inline.t-24')?.textContent.trim() || 
                   document.querySelector('.text-heading-xlarge')?.textContent.trim() || '';

    profile.profileUrl = window.location.href;

    // Extract current position and company
    const positionElement = document.querySelector('.text-body-medium.break-words');
    if (positionElement) {
      const positionText = positionElement.textContent.trim();
      const match = positionText.match(/(.*?)\s+at\s+(.*)/);
      if (match) {
        profile.currentTitle = match[1].trim();
        profile.currentCompany = match[2].trim();
      } else {
        profile.currentTitle = positionText;
      }
    }

    // Extract connections
    const connectionsElement = document.querySelector('.t-bold');
    if (connectionsElement) {
      const connectionsText = connectionsElement.textContent.trim();
      profile.connections = connectionsText.replace(/\D/g, '');
    }

    // Extract location
    const locationElement = document.querySelector('.text-body-small.inline.t-black--light.break-words');
    if (locationElement) {
      profile.location = locationElement.textContent.trim();
    }

    // Extract about/summary
    const aboutSection = document.querySelector('#about')?.parentElement;
    if (aboutSection) {
      profile.about = aboutSection.querySelector('.inline-show-more-text')?.textContent.trim() || '';
    }

    // Extract experience
    profile.experience = [];
    const experienceSection = document.querySelector('#experience')?.parentElement;
    if (experienceSection) {
      const experiences = experienceSection.querySelectorAll('li.artdeco-list__item');
      experiences.forEach(exp => {
        const experience = {
          title: exp.querySelector('.t-bold span')?.textContent.trim() || '',
          company: exp.querySelector('.t-normal.t-black--light span')?.textContent.trim() || '',
          duration: exp.querySelector('span.t-normal.t-black--light:not(:first-child)')?.textContent.trim() || '',
          location: exp.querySelector('.experience-item__location span')?.textContent.trim() || ''
        };
        if (experience.title || experience.company) {
          profile.experience.push(experience);
        }
      });
    }

    // Extract skills
    profile.skills = [];
    const skillsSection = document.querySelector('#skills')?.parentElement;
    if (skillsSection) {
      const skills = skillsSection.querySelectorAll('.artdeco-list__item');
      skills.forEach(skill => {
        const skillName = skill.querySelector('.t-bold span')?.textContent.trim();
        if (skillName) {
          profile.skills.push(skillName);
        }
      });
    }

    // Extract languages
    profile.languages = [];
    const languagesSection = document.querySelector('#languages')?.parentElement;
    if (languagesSection) {
      const languages = languagesSection.querySelectorAll('.artdeco-list__item');
      languages.forEach(lang => {
        const language = {
          name: lang.querySelector('.t-bold span')?.textContent.trim() || '',
          proficiency: lang.querySelector('.t-normal.t-black--light span')?.textContent.trim() || ''
        };
        if (language.name) {
          profile.languages.push(language);
        }
      });
    }

    // Extract education
    profile.education = [];
    const educationSection = document.querySelector('#education')?.parentElement;
    if (educationSection) {
      const educationItems = educationSection.querySelectorAll('li.artdeco-list__item');
      educationItems.forEach(edu => {
        const education = {
          school: edu.querySelector('.t-bold span')?.textContent.trim() || '',
          degree: edu.querySelector('.t-normal.t-black--light span')?.textContent.trim() || '',
          period: edu.querySelector('span.t-normal.t-black--light:not(:first-child)')?.textContent.trim() || '',
          fieldOfStudy: edu.querySelector('.education__item--details span:nth-child(2)')?.textContent.trim() || ''
        };
        if (education.school) {
          profile.education.push(education);
        }
      });
    }

    console.log('Extracted profile data:', profile);
    return profile;
  } catch (error) {
    console.error('Error extracting profile data:', error);
    throw error;
  }
}

// Update the message listener to handle profile navigation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractLinkedInData") {
    if (request.url) {
      // This is a connection profile extraction request
      extractBasicProfile()
        .then(profileData => {
          sendResponse({ success: true, data: profileData });
        })
        .catch(error => {
          console.error('Error extracting profile data:', error);
          sendResponse({ success: false, error: error.message });
        });
    } else {
      // This is the initial profile extraction request
      extractLinkedInProfile()
        .then(profileData => {
          sendResponse({ success: true, data: profileData });
        })
        .catch(error => {
          console.error('Error extracting profile data:', error);
          sendResponse({ success: false, error: error.message });
        });
    }
    return true;
  }
}); 