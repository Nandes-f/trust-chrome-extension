// Add this function before it's used (at the top of the file, after the initial function declarations)
//indexDb
//created IndexDb
const DB_NAME = 'ContactsDB';
const DB_VERSION = 1;
const STORE_NAME = 'contacts';
const LINKEDIN_STORE_NAME = 'linkedin';
const TWITTER_STORE_NAME = 'twitter';


//INIT INDEXDB
function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION + 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(LINKEDIN_STORE_NAME)) {
        db.createObjectStore(LINKEDIN_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(TWITTER_STORE_NAME)) {
        db.createObjectStore(TWITTER_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

//
async function storeInIndexedDB(contacts, merge = false) {
  try {
    const db = await initIndexedDB();
    //create transaction
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    if(merge){
      //clear store
      clearStore(store);
    }
    //get existing contacts
    const existingContacts = await getAllContacts(store);
    console.log('existingContacts', existingContacts);
    const existingKeys = new Set(existingContacts.map(getContactKey));

    // Filter out duplicates and store new contacts
    const uniqueContacts = contacts.filter(contact => {
      const key = getContactKey(contact);
      if (existingKeys.has(key)) {
        return false; // Skip this contact as it's a duplicate
      }
      existingKeys.add(key);
      return true;
    });

    // Store unique contacts
    for (const contact of uniqueContacts) {
      await storeContact(store, contact);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`Successfully stored ${uniqueContacts.length} unique contacts`);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error in storeInIndexedDB:', error);
    throw error;
  }
}

// Helper function to clear the store
function clearStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Helper function to store a single contact
function storeContact(store, contact) {
  return new Promise((resolve, reject) => {
    const request = store.put(contact);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllContacts(store) {
  return new Promise((resolve, reject) => {
    const contacts = [];
    const request = store.openCursor();
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        contacts.push(cursor.value);
        cursor.continue();
      } else {
        resolve(contacts);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function getAllContactsFromDB() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initIndexedDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const contacts = await getAllContacts(store);
      resolve(contacts);
    } catch (error) {
      console.error('Error getting contacts from IndexedDB:', error);
      reject(error);
    }
  });
}

// ... existing code ...

// Function to sync contacts with Firebase
async function syncContactsToFirebase() {
  try {
    const contacts = await getAllContactsFromDB();
    const id = await chrome.storage.local.get(['userData']).then(result => {
      console.log('result', result);
      return result.userData.uid;
    });
    const apiUrl = `https://valut-backend.onrender.com/contacts/${id}`;
    console.log('apiUrl', apiUrl);
    let lastResult;

    // iterate over contacts 
    for (const contact of contacts) {
      try {
        
        let response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contact }),
        });
        
        console.log('response', response);
        // Skip this contact if we get a 400 status
        if (response.status === 400) {
          console.log(`Skipping contact due to 400 status:`, contact);
          continue;
        }

        // For other error status codes, throw an error
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        lastResult = await response.json();
        console.log('Successfully synced contact to Firebase:', lastResult);
      } catch (contactError) {
        console.error('Error syncing individual contact:', contactError);
        // Continue with next contact even if this one fails
        continue;
      }
    }
  } catch (error) {
    console.error('Error syncing contacts to Firebase:', error);
    throw error;
  }
}


// Helper function to generate a unique key for each contact
function getContactKey(contact) {
  // Create a unique key based on name and platform
  // You can modify this to include other fields that determine uniqueness
  const name = (contact.Name || '').toLowerCase().trim();
  const platform = (contact.platform || '').toLowerCase().trim();
  const email = (contact['E-mail 1 - Value'] || '').toLowerCase().trim();
  const phone = (contact['Phone 1 - Value'] || '').trim();
  
  return `${name}|${platform}|${email}|${phone}`;
}

async function storeTwitterContacts(followingUrls, merge = false) {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction([TWITTER_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(TWITTER_STORE_NAME);

    if (merge) {
      await clearStore(store);
    }

    // Get existing profiles
    const existingProfiles = await getAllTwitterProfiles(store);
    const existingUrls = new Set(existingProfiles.map(profile => profile.url));

    // Transform URLs into profile objects and filter duplicates
    const uniqueProfiles = followingUrls
      .filter(url => !existingUrls.has(url))
      .map(url => ({
        url: url,
        username: url.split('/').pop(), // Extract username from URL
        dateAdded: new Date().toISOString(),
        status: 'pending' // Add status for tracking processing
      }));

    // Store unique profiles
    for (const profile of uniqueProfiles) {
      await storeContact(store, profile);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`Successfully stored ${uniqueProfiles.length} unique Twitter profiles`);
        resolve(uniqueProfiles);
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error in storeTwitterContacts:', error);
    throw error;
  }
}

// Helper function to get all Twitter profiles
function getAllTwitterProfiles(store) {
  return new Promise((resolve, reject) => {
    const profiles = [];
    const request = store.openCursor();
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        profiles.push(cursor.value);
        cursor.continue();
      } else {
        resolve(profiles);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Function to store LinkedIn profile URLs
async function storeLinkedInConnections(profileUrls, merge = false) {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction([LINKEDIN_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(LINKEDIN_STORE_NAME);

    if (merge) {
      await clearStore(store);
    }

    // Get existing URLs
    const existingConnections = await getAllLinkedInConnections();
    const existingUrls = new Set(existingConnections.map(conn => conn.profileUrl));

    // Filter out duplicates
    const uniqueUrls = profileUrls.filter(url => !existingUrls.has(url));

    // Store unique URLs
    for (const url of uniqueUrls) {
      await storeLinkedInConnection(store, {
        profileUrl: url,
        dateAdded: new Date().toISOString()
      });
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`Successfully stored ${uniqueUrls.length} unique LinkedIn URLs`);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error in storeLinkedInConnections:', error);
    throw error;
  }
}

// Helper function to store a single LinkedIn URL
function storeLinkedInConnection(store, urlData) {
  return new Promise((resolve, reject) => {
    const request = store.put(urlData);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Function to get all LinkedIn URLs
async function getAllLinkedInConnections() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initIndexedDB();
      const transaction = db.transaction([LINKEDIN_STORE_NAME], 'readonly');
      const store = transaction.objectStore(LINKEDIN_STORE_NAME);
      
      const connections = [];
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          connections.push(cursor.value);
          cursor.continue();
        } else {
          resolve(connections);
        }
      };
      
      request.onerror = () => reject(request.error);
    } catch (error) {
      console.error('Error getting LinkedIn URLs from IndexedDB:', error);
      reject(error);
    }
  });
}