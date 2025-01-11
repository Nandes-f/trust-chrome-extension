// Function to extract user information
function extractUserInfo() {
  const userElement = document.querySelector('[class*="nameTag"]');
  if (userElement) {
    const username = userElement.textContent.trim();
    return { username };
  }
  return null;
}

// Function to extract group (server) information
function extractGroupInfo() {
  const groups = [];
  const serverElements = document.querySelectorAll('[class*="guild-"]');
  serverElements.forEach((serverElement) => {
    const nameElement = serverElement.querySelector('[aria-label]');
    if (nameElement) {
      groups.push(nameElement.getAttribute('aria-label'));
    }
  });
  return groups;
}

// Function to extract detailed Discord data
function extractDiscordData() {
  let data = {
    name: '',
    email: '',
    avatar: '',
    channels: [],
    groups: [],
    location: '',
    details: ''
  };

  // Extract name
  const nameElement = document.querySelector('.username_f3939d');
  if (nameElement) {
    data.name = nameElement.textContent.trim();
  }

  // Extract avatar
  const avatarElement = document.querySelector('.avatar_c51b4e');
  if (avatarElement) {
    data.avatar = avatarElement.src;
  }

  // Extract channels and groups
  const channelElements = document.querySelectorAll('.channel_c91bad');
  channelElements.forEach(element => {
    const name = element.querySelector('.name_ec8679')?.textContent.trim();
    if (name) {
      if (element.querySelector('.iconWrapper_fc4f04')) {
        data.groups.push(name);
      } else {
        data.channels.push(name);
      }
    }
  });

  // Extract location and details
  const subtextElement = document.querySelector('.subtext_f3939d');
  if (subtextElement) {
    data.location = subtextElement.textContent.trim();
  }

  const infoElement = document.querySelector('.info_e86508');
  if (infoElement) {
    data.details = infoElement.textContent.trim();
  }

  return data;
}

// Function to send extracted info to background script
function sendExtractedInfo() {
  const userInfo = extractUserInfo();
  const groupInfo = extractGroupInfo();
  const detailedInfo = extractDiscordData();
  
  chrome.runtime.sendMessage({
    action: 'extractedInfo',
    data: { 
      user: userInfo, 
      groups: groupInfo,
      detailedInfo: detailedInfo
    }
  });
}

// Run the extraction when the page is fully loaded
window.addEventListener('load', sendExtractedInfo);

// Periodically check for updates (every 5 seconds)
setInterval(sendExtractedInfo, 5000);