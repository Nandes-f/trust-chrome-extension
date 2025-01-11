document.addEventListener('DOMContentLoaded', function() {
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('mySidebar');
  const sidebarClose = document.getElementById('sidebarClose');

  sidebarToggle.addEventListener('click', function(e) {
    e.preventDefault();
    sidebar.classList.toggle('active');
  });

  sidebarClose.addEventListener('click', function(e) {
    e.preventDefault();
    sidebar.classList.remove('active');
  });

  const contactsLink = document.getElementById('contactsLink');
  const importLink = document.getElementById('importLink');
  const exportLink = document.getElementById('exportLink');
  const mergeAndFixLink = document.getElementById('mergeAndFixLink');
  const clearDataLink = document.getElementById('clearDataLink');
  const scrapeButton = document.getElementById('scrapeButton');
  const googleLogin = document.getElementById('googleLogin');
  const facebookLogin = document.getElementById('facebookLogin');
  const linkedinLogin = document.getElementById('linkedinLogin');
  const amazonLogin = document.getElementById('amazonLogin');
  const twitterLogin = document.getElementById('twitterLogin');
  const whatsappLogin = document.getElementById('whatsappLogin');
  const contactsButton = document.getElementById('contactsButton');

  contactsLink.addEventListener('click', () => {
    chrome.tabs.create({url:'options.html'});
    console.log('Contacts clicked');
    displayContacts();
  });

  contactsButton.addEventListener('click', () => {
    chrome.tabs.create({url:'options.html'});
    console.log('Contacts clicked');
    displayContacts();
  });

  importLink.addEventListener('click', () => {
    console.log('Import clicked');
    chrome.tabs.create({url:'options.html'});
    console.log('Contacts clicked');
    displayContacts();
  });

  exportLink.addEventListener('click', () => {
    console.log('Export clicked');
    chrome.tabs.create({url:'options.html'});
    console.log('Contacts clicked');
    displayContacts();
  });

  mergeAndFixLink.addEventListener('click', () => {
    console.log('Enhance');
    chrome.tabs.create({url:'options.html'});
    console.log('Contacts clicked');
    displayContacts();
  });

  scrapeButton.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "scrape" });
  });

  googleLogin.addEventListener('click', () => {
    console.log('Google login clicked');
    // Implement Google login logic here
  });

  facebookLogin.addEventListener('click', () => {
    console.log('Facebook login clicked');
    // Implement Facebook login logic here
  });

  linkedinLogin.addEventListener('click', () => {
    console.log('LinkedIn login clicked');
    // Implement LinkedIn login logic here
  });

  amazonLogin.addEventListener('click', () => {
    console.log('Amazon login clicked');
    // Implement Amazon login logic here
  });

  twitterLogin.addEventListener('click', () => {
    console.log('Twitter login clicked');
    // Implement Twitter login logic here
  });

  whatsappLogin.addEventListener('click', () => {
    console.log('WhatsApp login clicked');
    // Implement WhatsApp login logic here
  });

  clearDataLink.addEventListener('click', () => {
    console.log('Delete/Cache clicked');
    if (confirm('Are you sure you want to Delete all contacts and cached data? This action cannot be undone.')) {
      clearContactsAndCache();
    }
  });

  // Check if user is logged in
  checkLoginStatus();

  const searchInput = document.querySelector('.search-input');
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    // Implement search functionality here
    console.log('Searching for:', searchTerm);
    // You can filter contacts or perform other search-related actions
  });
});

function checkLoginStatus() {
  // Implement logic to check if user is logged in
  // For now, we'll assume the user is not logged in
  const isLoggedIn = false;

  if (isLoggedIn) {
    document.querySelector('.login-options').style.display = 'none';
    document.getElementById('scrapeButton').style.display = 'block';
    displayContacts();
  } else {
    document.querySelector('.login-options').style.display = 'flex';
    document.getElementById('scrapeButton').style.display = 'none';
    document.getElementById('contactList').innerHTML = '<span style="text-align: center; display: block; margin-top: 20px; font-weight: bold; font-size: 12px; color: #000;"></span>';
  }
}

function displayContacts() {
  chrome.storage.local.get('contacts', (result) => {
    const contactList = document.getElementById('contactList');
    contactList.innerHTML = '';
    if (result.contacts && result.contacts.length > 0) {
      const ul = document.createElement('ul');
      result.contacts.forEach(contact => {
        const li = document.createElement('li');
        li.textContent = JSON.stringify(contact);
        ul.appendChild(li);
      });
      contactList.appendChild(ul);
    } else {
      contactList.textContent = 'No contacts stored.';
    }
  });
}

function clearContactsAndCache() {
  chrome.storage.local.clear(() => {
    if (chrome.runtime.lastError) {
      console.error('Error clearing data:', chrome.runtime.lastError);
      alert('An error occurred while clearing data. Please try again.');
    } else {
      console.log('All data cleared successfully');
      alert('All contacts and cached data have been cleared. The options page will now refresh.');
      
      // Refresh only the options page
      chrome.tabs.query({url: 'chrome-extension://ppboejjbaglnfjcbdakgkfghlpajobda/options.html'}, function(tabs) {
        if (tabs.length > 0) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
      
      // Close the popup
      window.close();
    }
  });
}