let initialized = false;
let firestore = null;

const config = {
    apiKey: "AIzaSyDM4T1LIfxn7AFMloIoRmJvhdJbXWqJq0U",
    authDomain: "prompt-fun.firebaseapp.com",
    projectId: "prompt-fun",
    storageBucket: "prompt-fun.appspot.com",
    messagingSenderId: "875628277505",
    appId: "1:875628277505:web:ecc400a65a525dbafef500",
    measurementId: "G-0P4RGVQYQC"
};

class QRAuth {
    static async initialize() {
        if (initialized) return;

        try {
            // Clear any existing Firebase instances
            if (firebase.apps.length) {
                await firebase.app().delete();
            }

            // Initialize Firebase
            const app = firebase.initializeApp(config);
            firestore = firebase.firestore();
            
            firestore.settings({
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });
            
            initialized = true;
            console.log("Firebase initialized successfully!", app);
            return true;
        } catch (error) {
            console.error("Failed to initialize Firebase:", error);
            throw error;
        }
    }

    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    static generateQRCode(container, text) {
        console.log('generateQRCode called with:', {
            containerExists: !!container,
            containerType: container ? container.tagName : 'none',
            text: text
        });

        if (!container) {
            console.error('Container element not found!');
            return null;
        }

        if (typeof QRCode === 'undefined') {
            console.error('QRCode library not loaded! Please ensure qrcode.min.js is included before auth.js');
            console.log('Available global objects:', Object.keys(window));
            return null;
        }

        container.innerHTML = '';
        
        try {
            console.log('Creating new QRCode instance...');
            const qr = new QRCode(container, {
                text: text,
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            
            console.log('QR code generated successfully');
            return text;
        } catch (error) {
            console.error('Error generating QR code:', error);
            console.error('Container:', container);
            console.error('Text:', text);
            return null;
        }
    }

    static async startAuthSession(container, statusContainer) {
        console.log('Starting auth session...', {container, statusContainer});
        
        if (!initialized) {
            console.log('Firebase not initialized, initializing...');
            await this.initialize();
        }

        const sessionId = this.generateUUID();
        const timestamp = firebase.firestore.Timestamp.now();
        
        try {
            console.log('Creating auth session document...', sessionId);
            const docRef = firestore.collection('authSessions').doc(sessionId);
            await docRef.set({
                status: 'pending',
                createdAt: timestamp,
                expiresAt: new firebase.firestore.Timestamp(timestamp.seconds + 300, 0),
                lastUpdated: timestamp
            });
            
            const qrData = JSON.stringify({
                sessionId: sessionId,
                type: 'auth'
            });
            
            console.log('Generating QR code with data:', qrData);
            const qrResult = this.generateQRCode(container, qrData);
            console.log('QR code generation result:', qrResult);
            
            return this.listenToAuthSession(sessionId, container, statusContainer);
        } catch (error) {
            console.error("Error in startAuthSession:", error);
            if (statusContainer) {
                statusContainer.textContent = 'Error starting auth session: ' + error.message;
            }
            throw error;
        }
    }
    static updateProfileUI(userData) {
        const profileItems = document.querySelectorAll('.sidebar-item');
        const profileItem = Array.from(profileItems).find(item => {
            const icon = item.querySelector('i.material-icons');
            return icon && icon.textContent === 'account_box';
        });

        if (profileItem) {
            profileItem.innerHTML = `
                <div class="profile-wrapper" style="position: relative; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; cursor: pointer;" class="profile-trigger">
                        <div style="display: flex; align-items: center;">
                            <div class="profile-circle" style="width: 30px; height: 30px; border-radius: 50%; background: #e0e0e0; margin-right: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                ${userData.photoURL ? 
                                    `<img src="${userData.photoURL}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                    `<span style="font-size: 18px; color: #666;">${userData.name.charAt(0).toUpperCase()}</span>`
                                }
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 500;">${userData.name}</span>
                                <span style="font-size: 12px; color: #666;">${userData.phoneNumber}</span>
                            </div>
                        </div>
                    </div>
                    
                </div>
            `;

            // Set up event handlers
            this.setupProfileEventHandlers(profileItem);
        }
    }

    static listenToAuthSession(sessionId, qrContainer, statusContainer) {
        console.log("Setting up listener for session:", sessionId);
        
        if (!statusContainer) {
            console.error('Status container not found!');
            return;
        }
        
        const sessionRef = firestore.collection('authSessions').doc(sessionId);
        
        return sessionRef.onSnapshot(async (doc) => {
            console.log("Received snapshot update:", doc.data());
            const data = doc.data();
            if (!data) {
                statusContainer.textContent = 'Error: No data available';
                return;
            }
            console.log("Session status:", data.status);
            
            switch(data.status) {
                
                case 'authenticated':
                    try {
                        const userDoc = await firestore.collection('registered_users').doc(data.userId).get();
                        const userContactsDoc = await firestore.collection('registered_users').doc(data.userId).collection('contacts').get();
                        const userData = {
                            ...userDoc.data(),
                            uid: data.userId  // Add the userId from the auth session
                        };
                        const userContacts = userContactsDoc.docs.map(doc => {
                            const data = doc.data();
                            console.log('Raw contact data from Firestore:', data);
                            return {
                                ...data,
                                id: doc.id
                            };
                        });
                        console.log('User contacts from Firestore:', userContacts);
                        
                        if (userData) {
                            updateProfileSidebarUI(userData);
                            // Convert Firestore contacts to the app's contact format
                            const formattedContacts = userContacts.map(contact => {
                                console.log('Processing contact:', contact);

                                // Handle name field properly
                                let name = '';
                                if (contact.displayName) {
                                    name = contact.displayName;
                                } else if (contact.name) {
                                    if (typeof contact.name === 'object') {
                                        const firstName = contact.name.firstName || '';
                                        const lastName = contact.name.lastName || '';
                                        name = `${firstName} ${lastName}`.trim();
                                    } else if (typeof contact.name === 'string') {
                                        name = contact.name;
                                    }
                                } else if (contact.firstName || contact.lastName) {
                                    name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
                                }

                                // Handle phone numbers array
                                let primaryPhone = '';
                                let phoneType = 'mobile';
                                if (Array.isArray(contact.phones) && contact.phones.length > 0) {
                                    const primaryPhoneObj = contact.phones.find(phone => phone.isPrimary) || contact.phones[0];
                                    primaryPhone = primaryPhoneObj.normalizedNumber || primaryPhoneObj.number;
                                    phoneType = primaryPhoneObj.label || primaryPhoneObj.customLabel || 'mobile';
                                }

                                // Handle emails array
                                let primaryEmail = '';
                                let emailType = '';
                                const additionalEmails = {};
                                if (Array.isArray(contact.emails) && contact.emails.length > 0) {
                                    const primaryEmailObj = contact.emails.find(email => email.isPrimary) || contact.emails[0];
                                    primaryEmail = primaryEmailObj.address || primaryEmailObj.email;
                                    emailType = primaryEmailObj.label || primaryEmailObj.type || 'other';

                                    // Add additional emails
                                    contact.emails.slice(1).forEach((email, index) => {
                                        additionalEmails[`E-mail ${index + 2} - Type`] = email.label || email.type || 'other';
                                        additionalEmails[`E-mail ${index + 2} - Value`] = email.address || email.email;
                                    });
                                }

                                // Handle organizations array
                                let primaryOrg = { title: '', company: '' };
                                const additionalOrgs = {};
                                if (Array.isArray(contact.organizations) && contact.organizations.length > 0) {
                                    const primaryOrgObj = contact.organizations.find(org => org.isPrimary) || contact.organizations[0];
                                    primaryOrg = {
                                        title: primaryOrgObj.title || primaryOrgObj.jobTitle || '',
                                        company: primaryOrgObj.name || primaryOrgObj.company || ''
                                    };

                                    // Add additional organizations
                                    contact.organizations.slice(1).forEach((org, index) => {
                                        additionalOrgs[`Organization ${index + 2} - Title`] = org.title || org.jobTitle || '';
                                        additionalOrgs[`Organization ${index + 2} - Name`] = org.name || org.company || '';
                                    });
                                }

                                // Create the formatted contact with all fields
                                const formattedContact = {
                                    'Name': name || 'Unnamed Contact',
                                    'Given Name': contact.firstName || (contact.name?.firstName) || '',
                                    'Family Name': contact.lastName || (contact.name?.lastName) || '',
                                    'E-mail 1 - Type': emailType,
                                    'E-mail 1 - Value': primaryEmail,
                                    'Phone 1 - Type': phoneType,
                                    'Phone 1 - Value': primaryPhone,
                                    'Organization 1 - Title': primaryOrg.title,
                                    'Organization 1 - Name': primaryOrg.company,
                                    'Notes': contact.notes || contact.bio || contact.about || '',
                                    'Location': contact.location || contact.address || '',
                                    'Website': contact.website || contact.url || '',
                                    'platform': contact.platform || 'Contacts',
                                    'External ID 1 - Value': contact.id || '',
                                    'Custom Field 1 - Type': 'Source',
                                    'Custom Field 1 - Value': 'Database',
                                    'Photo': contact.photoURL || contact.avatar || '',
                                    // Add additional phones
                                    ...(Array.isArray(contact.phones) && contact.phones.length > 1 
                                        ? contact.phones.slice(1).reduce((acc, phone, index) => ({
                                            ...acc,
                                            [`Phone ${index + 2} - Type`]: phone.label || phone.customLabel || 'other',
                                            [`Phone ${index + 2} - Value`]: phone.normalizedNumber || phone.number
                                        }), {})
                                        : {}),
                                    // Add additional emails
                                    ...additionalEmails,
                                    // Add additional organizations
                                    ...additionalOrgs
                                };

                                console.log('Formatted contact:', formattedContact);
                                return formattedContact;
                            });

                            console.log('All formatted contacts:', formattedContacts);


                            // Save contacts to API
                            // await saveContactsToAPI(formattedContacts);
                            // Store contacts in chrome.storage
                            let existingContacts = await getAllContactsFromDB().then(contacts => {
                                console.log('Existing contacts:', contacts);
                                return contacts;
                            });
                                
                                // Merge existing contacts with new contacts from database
                                const mergedContacts = [...existingContacts];
                                
                                formattedContacts.forEach(newContact => {
                                    const existingIndex = mergedContacts.findIndex(
                                        c => c['External ID 1 - Value'] === newContact['External ID 1 - Value']
                                    );
                                    
                                    if (existingIndex === -1) {
                                        mergedContacts.push(newContact);
                                    } else {
                                        mergedContacts[existingIndex] = newContact;
                                    }
                                });

                                console.log('Final merged contacts:', mergedContacts);

                                // Hide QR container and update status
                                qrContainer.style.display = 'none';
                                statusContainer.style.display = 'none';

                                // Store contacts in IndexedDB
                                await storeInIndexedDB(mergedContacts);
                                
                                // Store auth data and contacts
                                chrome.storage.local.set({ 
                                    isAuthenticated: true, 
                                    userData: userData,
                                    contacts: mergedContacts,
                                    authTimestamp: Date.now(),
                                    lastSelectedContent: 'Profile'
                                }, () => {
                                    // Log the sync activity
                                    if (typeof logActivity === 'function') {
                                        logActivity('Database', 'Sync', formattedContacts.length);
                                    }

                                    console.log('User data:', userData);

                                    // Show multi-step profile immediately after authentication
                                    showProfileStep(userData);

                                    // Update sidebar selection to highlight Profile
                                    const sidebarItems = document.querySelectorAll('.sidebar-item');
                                    sidebarItems.forEach(item => {
                                        item.classList.remove('selected');
                                        if (item.querySelector('.material-icons')?.textContent === 'account_box') {
                                            item.classList.add('selected');
                                        }
                                    });
                                });
                            }
                        } catch (error) {
                            statusContainer.textContent = 'Error fetching user details: ' + error.message;
                        }
                        break;
                        
                    case 'pending':
                        statusContainer.textContent = 'Waiting for mobile scan...';
                        break;
                        
                    case 'scanned':
                        statusContainer.textContent = 'QR Code scanned! Authenticating...';
                        break;
                        
                    case 'expired':
                        qrContainer.style.display = 'none';
                        statusContainer.textContent = 'QR Code expired. Please refresh the page.';
                        break;
                        
                    case 'error':
                        qrContainer.style.display = 'none';
                        statusContainer.textContent = 'Error: ' + (data.error || 'Unknown error occurred');
                        break;
                }
            });
        }

        static async checkAndUpdateAuthStatus() {
            try {
                const data = await chrome.storage.local.get(['isAuthenticated', 'userData']);
                if (data.isAuthenticated && data.userData) {
                    // Update the profile section
                    this.updateProfileUI(data.userData);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Error checking auth status:', error);
                return false;
            }
        }

       

        static setupProfileEventHandlers(profileItem) {
            const profileTrigger = profileItem.querySelector('.profile-trigger');
          

            // Add profile trigger click handler
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                showProfile();
            });
        }

        static async saveProfile(userData) {
            alert('saveProfile');
            alert(userData.uid);
            try {
                // Update Firestore
                const userDocRef = firestore.collection('registered_users').doc(userData.uid);
                console.log('User data to save:', userData);
                const result = await userDocRef.set(userData, { merge: true });
                console.log('Firestore update result:', result);
                
                // Update local storage
                await chrome.storage.local.set({ userData: userData });
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background-color: #4caf50;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 4px;
                    z-index: 1000;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                `;
                successMsg.textContent = 'Profile updated successfully!';
                document.body.appendChild(successMsg);

                chrome.storage.local.set({lastSelectedContent: 'Profile'}, () => {
                    console.log('Last selected content set to Profile');
                });
                
                // // Remove success message after 2 seconds
                setTimeout(() => {
                    successMsg.remove();
                    window.location.reload(); 
                }, 2000);

                return true;
            } catch (error) {
                console.error('Error saving profile:', error);
                
                // Show error message
                const errorMsg = document.createElement('div');
                errorMsg.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background-color: #f44336;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 4px;
                    z-index: 1000;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                `;
                errorMsg.textContent = 'Error updating profile. Please try again.';
                document.body.appendChild(errorMsg);
                
                // Remove error message after 3 seconds
                setTimeout(() => {
                    errorMsg.remove();
                }, 3000);

                return false;
            }
        }
    }

    window.QRAuth = QRAuth;

    
    document.addEventListener('DOMContentLoaded', async () => {
        await QRAuth.initialize();
        await QRAuth.checkAndUpdateAuthStatus();        
    }); 

    // ... existing code ..

    // Add these functions to handle editing
    window.editLinkedIn = function() {
        const container = document.querySelector('[data-field="linkedin"]');
        const currentValue = userData.linkedinId || '';
        container.innerHTML = `
            <input type="text" id="linkedinId" value="${currentValue}" 
                style="
                    width: calc(100% - 16px);
                    padding: 8px;
                    margin-top: 4px;
                    border: 1px solid #dadce0;
                    border-radius: 4px;
                    font-size: 14px;
                    line-height: 20px;
                    color: #202124;
                    outline: none;
                    transition: border-color 0.2s;
                "
                placeholder="Enter your LinkedIn profile URL">
        `;
    };

    window.editTwitter = function() {
        const container = document.querySelector('[data-field="twitter"]');
        const currentValue = userData.twitterId || '';
        container.innerHTML = `
            <input type="text" id="twitterId" value="${currentValue}" 
                style="
                    width: calc(100% - 16px);
                    padding: 8px;
                    margin-top: 4px;
                    border: 1px solid #dadce0;
                    border-radius: 4px;
                    font-size: 14px;
                    line-height: 20px;
                    color: #202124;
                    outline: none;
                    transition: border-color 0.2s;
                "
                placeholder="Enter your Twitter profile URL">
        `;
    };

     async function showProfileStep(userData) {
        const optionContent = document.getElementById('optionContent');
        if (!optionContent) return;

        const profileItem = document.querySelector('#userProfile');

        // Remove 'active' class from all sidebar items
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });

        profileItem.classList.add('active');

        chrome.storage.local.set({lastSelectedContent: 'Profile'}, () => {
            console.log('Last selected content saved:', 'Profile');
        });

        // Get extraction status first
        const { extractionStatus } = await chrome.storage.local.get(['extractionStatus']);

        console.log('Extraction status:', extractionStatus);

        const {ExtractionTStatus} = await chrome.storage.local.get(['ExtractionTStatus']);

        const {linkedinExtractionStatus} = await chrome.storage.local.get(['linkedinExtractionStatus']);

        
        // Create the LinkedIn button content based on extraction status
        const getLinkedInButtonContent = async () => {

            if(linkedinExtractionStatus?.processed === 0){
                return `<div class="start-extraction-btn linkedin" style="background-color: #E3F2FD; color: #1976D2; border: 1px solid #90CAF9; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; transition: background-color 0.2s; min-width: 140px; justify-content: center;">
                                <p>collecting profiles...</p>
                            </div>`;
            }

            if (extractionStatus?.status === 'processing') {
                return `<div class="start-extraction-btn linkedin" style="background-color: white; color: white; border: none;  border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; transition: background-color 0.2s; min-width: 140px; justify-content: center;height: 20px;">
                    <div style="background-color: #E3F2FD; border: 1px solid #90CAF9; border-radius: 4px;  position: relative; overflow: hidden; min-width: 140px; height: 10px; display: flex; align-items: center; justify-content: center;">
                        <div style="display: flex; align-items: center; gap: 8px; z-index: 1;">
                            <i class="material-icons spinning" style="color: #1976D2;">sync</i>
                            <span class="status-text" style="color: #1976D2;">Processing: ${extractionStatus.current} of ${extractionStatus.total}</span>
                        </div>
                        <div class="progress-bar" style="width: ${(extractionStatus.current / extractionStatus.total) * 100}%; background: #1976D2; height: 100%; position: absolute; left: 0; top: 0; opacity: 0.5;"></div>
                    </div>
                </div>`;
            }
        
            // Use Promise to handle the async chrome.storage.local.get
            return new Promise((resolve) => {
                chrome.storage.local.get(['linkedinDailyStats'], (result) => {
                    const linkedinDailyStats = result.linkedinDailyStats || {};
                    const today = new Date().toDateString();
        
                    if (linkedinDailyStats[today] && linkedinDailyStats[today].processed >= 10) {
                        resolve(`
                            <div class="start-extraction-btn linkedin" style="background-color: #E3F2FD; color: #1976D2; border: 1px solid #90CAF9; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; transition: background-color 0.2s; min-width: 140px; justify-content: center;">
                                <p>scraping limit done</p>
                            </div>
                        `);
                    } else {
                        resolve(`
                            <button class="start-extraction-btn linkedin" 
                                    style="
                                        background-color: #388e3c;
                                        color: white;
                                        border: none;
                                        padding: 8px 16px;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        font-size: 14px;
                                        font-weight: 500;
                                        display: flex;
                                        align-items: center;
                                        gap: 8px;
                                        transition: background-color 0.2s;
                                        min-width: 140px;
                                        justify-content: center;
                                    "
                                    onmouseover="this.style.backgroundColor='#2e7d32'"
                                    onmouseout="this.style.backgroundColor='#388e3c'"
                            >
                                <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                                </svg>
                                Start Extraction
                            </button>
                        `);
                    }
                });
            });
        };

        const getTwitterButtonContent = () => {
            if(ExtractionTStatus?.current === 0){
                return `<button class="start-extraction-btn twitter" style="background-color: #388e3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; transition: background-color 0.2s; min-width: 140px; justify-content: center;">
            collecting profiles...
       </button>`;
            }   
            if(ExtractionTStatus?.status === 'processing'){
            return `<button class="start-extraction-btn twitter" style="
        position: relative;
        background-color: #388e3c;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background-color 0.2s;
        min-width: 140px;
        justify-content: center;
        overflow: hidden;
    ">
        <div style="position: relative; z-index: 2; display: flex; align-items: center; gap: 8px;">
            <i class="material-icons spinning" style="color: white;">sync</i>
            <span class="status-text" style="color: white;">Processing: ${ExtractionTStatus.current} of ${ExtractionTStatus.total}</span>
        </div>
        <div class="progress-bar" style="
            width: ${(ExtractionTStatus.current / ExtractionTStatus.total) * 100}%;
            background: rgba(255, 255, 255, 0.2);
            height: 100%;
            position: absolute;
            left: 0;
            top: 0;
            z-index: 1;
            transition: width 0.3s ease;
        "></div>
    </button>`;
           }
           return `<button class="start-extraction-btn twitter" style="background-color: #388e3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; transition: background-color 0.2s; min-width: 140px; justify-content: center;">
           <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="currentColor">
               <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
           </svg>
           Start Extraction
       </button>`;
        };

        // In your LinkedIn profile section, replace the conditional rendering with:
        const linkedInSection = `
            <div style="margin-bottom: 24px;">
                <div style="color: #5f6368; font-size: 14px; margin-bottom: 8px;">LinkedIn Profile</div>
                ${userData.linkedinId ? `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <a href="${userData.linkedinId}" 
                           target="_blank" 
                           style="
                               color: #1a73e8;
                               text-decoration: none;
                               font-size: 15px;
                               flex: 1;
                               white-space: nowrap;
                               overflow: hidden;
                               text-overflow: ellipsis;
                           "
                        >${userData.linkedinId}</a>
                        ${await getLinkedInButtonContent()}
                    </div>
                ` : `
                    <input type="text" 
                           id="linkedinId" 
                           placeholder="Enter your LinkedIn profile URL"
                           style="
                               width: 100%;
                               padding: 10px;
                               border: 1px solid #dadce0;
                               border-radius: 4px;
                               font-size: 14px;
                               color: #202124;
                               outline: none;
                               transition: border-color 0.2s;
                               box-sizing: border-box;
                           "
                           onFocus="this.style.borderColor='#1a73e8'"
                           onBlur="this.style.borderColor='#dadce0'"
                    >
                `}
            </div>
        `;

        const twitterSection = `
            <div style="margin-bottom: 24px;">
                        <div style="color: #5f6368; font-size: 14px; margin-bottom: 8px;">Twitter Profile</div>
                        ${userData.twitterId ? `
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <a href="${userData.twitterId}" 
                                   target="_blank" 
                                   style="
                                       color: #1a73e8;
                                       text-decoration: none;
                                       font-size: 15px;
                                       flex: 1;
                                       white-space: nowrap;
                                       overflow: hidden;
                                       text-overflow: ellipsis;
                                   "
                                >${userData.twitterId}</a>
                                 ${getTwitterButtonContent()}
                            </div>
                        ` : `
                            <input type="text" 
                                   id="twitterId" 
                                   placeholder="Enter your Twitter profile URL"
                                   style="
                                       width: 100%;
                                       padding: 10px;
                                       border: 1px solid #dadce0;
                                       border-radius: 4px;
                                       font-size: 14px;
                                       color: #202124;
                                       outline: none;
                                       transition: border-color 0.2s;
                                       box-sizing: border-box;
                                   "
                                   onFocus="this.style.borderColor='#1a73e8'"
                                   onBlur="this.style.borderColor='#dadce0'"
                            >
                        `}
                    </div>
        `;


        // Add CSS for the spinner animation
        const styleSheet = document.createElement("style");
        styleSheet.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(styleSheet);

        // Common header that stays constant
        const headerContent = `
            <div class="profile-header" style="text-align: center; margin-bottom: 40px; position: relative;">
                <div style="position: absolute; top: 0; right: 0;">
                    <button class="sign-out-btn" style="
                        display: flex;
                        align-items: center;
                        background: transparent;
                        border: 1px solid #e0e0e0;
                        padding: 8px 16px;
                        border-radius: 20px;
                        cursor: pointer;
                        color: #5f6368;
                        transition: all 0.2s ease;
                        font-family: 'Google Sans', sans-serif;
                    ">
                        <span style="display: flex; margin-right: 8px;">
                            <svg focusable="false" height="20" viewBox="0 0 24 24" width="20" fill="currentColor">
                                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"></path>
                            </svg>
                        </span>
                        <span style="font-size: 14px;">Sign out</span>
                    </button>
                </div>
                <div class="profile-image" style="
                    position: relative;
                    width: 120px;
                    height: 120px;
                    margin: 0 auto 20px;
                    border: 3px solid #fff;
                    border-radius: 50%;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                ">
                    ${userData.photoURL ? 
                        `<img src="${userData.photoURL}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` :
                        `<div style="
                            width: 100%;
                            height: 100%;
                            border-radius: 50%;
                            background: linear-gradient(135deg, #4CAF50, #2E7D32);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 48px;
                            color: white;
                            font-family: 'Google Sans', sans-serif;
                        ">${userData.name.charAt(0).toUpperCase()}</div>`
                    }
                </div>
                <h2 style="margin: 0 0 5px; color: #202124; font-size: 28px; font-family: 'Google Sans', sans-serif;">Hi, ${userData.name.split(' ')[0]}!</h2>
                <p style="margin: 0; color: #5f6368; font-size: 14px;">${userData.phoneNumber}</p>
            </div>
        `;

        // Profile content with LinkedIn and Twitter URLs
        const profileContent = `
            <div class="profile-details" style="
                background: white;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
                transition: all 0.3s cubic-bezier(.25,.8,.25,1);
            ">
                <div style="padding: 24px 28px; border-bottom: 1px solid #e8eaed;">
                    <div style="font-size: 20px; color: #202124; font-weight: 500; font-family: 'Google Sans', sans-serif;">Socials</div>
                </div>
                <div style="padding: 28px;">
                    <div class="info-grid" style="display: flex; flex-direction: column; gap: 32px;">
                        
                        <div class="info-section">
                            <div style="color: #5f6368; font-size: 14px; font-weight: 500; margin-bottom: 12px; text-transform: uppercase;">LinkedIn Profile</div>
                            ${userData.linkedinId ? `
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                                    <a href="${userData.linkedinId}" 
                                       target="_blank" 
                                       style="
                                           color: #1a73e8;
                                           text-decoration: none;
                                           font-size: 15px;
                                           flex: 1;
                                           white-space: nowrap;
                                           overflow: hidden;
                                           text-overflow: ellipsis;
                                       "
                                    >${userData.linkedinId}</a>
                                    ${await getLinkedInButtonContent()}
                                </div>
                            ` : `
                                <input type="text" 
                                       id="linkedinId" 
                                       placeholder="Enter your LinkedIn profile URL"
                                       style="
                                           width: 100%;
                                           padding: 12px;
                                           border: 1px solid #dadce0;
                                           border-radius: 8px;
                                           font-size: 14px;
                                           color: #202124;
                                           outline: none;
                                           transition: border-color 0.2s;
                                           box-sizing: border-box;
                                       "
                                       onFocus="this.style.borderColor='#1a73e8'"
                                       onBlur="this.style.borderColor='#dadce0'"
                                >
                            `}
                        </div>
                        
                        <div class="info-section">
                            <div style="color: #5f6368; font-size: 14px; font-weight: 500; margin-bottom: 12px; text-transform: uppercase;">Twitter Profile</div>
                            ${userData.twitterId ? `
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                                    <a href="${userData.twitterId}" 
                                       target="_blank" 
                                       style="
                                           color: #1a73e8;
                                           text-decoration: none;
                                           font-size: 15px;
                                           flex: 1;
                                           white-space: nowrap;
                                           overflow: hidden;
                                           text-overflow: ellipsis;
                                       "
                                    >${userData.twitterId}</a>
                                    ${getTwitterButtonContent()}
                                </div>
                            ` : `
                                <input type="text" 
                                       id="twitterId" 
                                       placeholder="Enter your Twitter profile URL"
                                       style="
                                           width: 100%;
                                           padding: 12px;
                                           border: 1px solid #dadce0;
                                           border-radius: 8px;
                                           font-size: 14px;
                                           color: #202124;
                                           outline: none;
                                           transition: border-color 0.2s;
                                           box-sizing: border-box;
                                       "
                                       onFocus="this.style.borderColor='#1a73e8'"
                                       onBlur="this.style.borderColor='#dadce0'"
                                >
                            `}
                        </div>
                    </div>
                    
                    ${(!userData.linkedinId || !userData.twitterId) ? `
                        <div style="margin-top: 32px; text-align: right;">
                            <button id="saveProfileBtn" style="
                                background-color: #1a73e8;
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                border-radius: 8px;
                                font-size: 14px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            ">
                                Save Profile
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Add these styles to the stylesheet
        styleSheet.textContent += `
            .sign-out-btn:hover {
                background: #f1f3f4;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .profile-details:hover {
                box-shadow: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23);
            }
            
            #saveProfileBtn:hover {
                background-color: #1557b0;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            
            .info-item {
                transition: all 0.2s ease;
                padding: 16px;
                border-radius: 8px;
            }
            
            .info-item:hover {
                background-color: #f8f9fa;
            }
            
            .start-extraction-btn {
                transition: transform 0.2s ease;
            }
            
            .start-extraction-btn:hover {
                transform: translateY(-1px);
            }
            
            .spinning {
                animation: spin 1s linear infinite;
            }
        `;

        // Combine header and profile content
        optionContent.innerHTML = `
            <div class="profile-container" style="position: relative; max-width: 800px; margin: 20px auto; padding: 20px;">
                ${headerContent}
                ${profileContent}
            </div>
        `;

        // Add event listeners for sign out button
        const signOutBtn = document.querySelector('.sign-out-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                window.logout();
            });

            signOutBtn.addEventListener('mouseover', () => {
                signOutBtn.style.backgroundColor = '#f1f3f4';
            });
            
            signOutBtn.addEventListener('mouseout', () => {
                signOutBtn.style.backgroundColor = 'transparent';
            });
        }

       //button to start extraction for linkedin
       const linkedinBtn = document.querySelector('.linkedin');
       if (linkedinBtn) {
        linkedinBtn.addEventListener('click', () => {
            console.log('Starting extraction... linkedin');
            extractLinkedInData();
        });
       }

       //button to start extraction for twitter
       const twitterBtn = document.querySelector('.twitter');
       if (twitterBtn) {
        twitterBtn.addEventListener('click', () => {
            console.log('Starting extraction... twitter');
            extractTwitterData();   
        });
       }

        const saveProfileBtn = document.getElementById('saveProfileBtn');
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', async () => {
                const linkedinInput = document.getElementById('linkedinId');
                const twitterInput = document.getElementById('twitterId');
                
                const updatedUserData = {
                    ...userData,
                    linkedinId: linkedinInput ? linkedinInput.value : userData.linkedinId,
                    twitterId: twitterInput ? twitterInput.value : userData.twitterId
                };

                console.log('Updated user data:', updatedUserData);

                saveProfileBtn.disabled = true;
                saveProfileBtn.textContent = 'Saving...';
                
                try {
                    await QRAuth.saveProfile(updatedUserData);
                    // Profile will be automatically reloaded after successful save
                } catch (error) {
                    console.error('Error saving profile:', error);
                    saveProfileBtn.disabled = false;
                    saveProfileBtn.textContent = 'Save Profile';
                }
            });
        }
    }

    // Modify the showProfile function to start the step flow
    window.showProfile = (userData = null) => {
        if (!userData) {
            chrome.storage.local.get(['userData'], (result) => {
                if (result.userData) {
                    console.log('User data:', result.userData);
                    showProfileStep(result.userData);
                }
            });
            return;
        }
        showProfileStep(userData);
    };

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
                        console.log('Snapshot data:', data); // Debugging statement
                        if (data.status === 'authenticated' && data.userData) {
                            console.log('User data received:', data.userData); // Debugging statement
                            // Store authentication data
                            chrome.storage.local.set({
                                isAuthenticated: true,
                                userData: data.userData,
                                authTimestamp: Date.now()
                            }, () => {
                                console.log('Authentication successful, data stored');
                                // Update the sidebar with user data
                                updateProfileUI(data.userData); // Call to update the profile UI
                                document.getElementById('userProfile').style.display = 'block'; // Show user profile
                                console.log('User profile displayed'); // Debugging statement
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

    function updateProfileSidebarUI(userData) {
        document.getElementById('userProfile').style.display = 'block';
        const profileItem = document.querySelector('#userProfile');

        // Remove 'active' class from all sidebar items
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add 'active' class to profile item
        if (profileItem) {
            profileItem.classList.add('active');
            profileItem.innerHTML = `
                <div class="profile-wrapper" style="position: relative; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; cursor: pointer;" class="profile-trigger">
                        <div style="display: flex; align-items: center;">
                            <div class="profile-circle" style="width: 30px; height: 30px; border-radius: 50%; background: #e0e0e0; margin-right: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                ${userData.photoURL ? 
                                    `<img src="${userData.photoURL}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                    `<span style="font-size: 18px; color: #666;">${userData.name.charAt(0).toUpperCase()}</span>`
                                }
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 500;">${userData.name}</span>
                                <span style="font-size: 12px; color: #666;">${userData.phoneNumber}</span>
                            </div>
                        </div>
                    </div>
                    
                </div>
            `;
        }
    }