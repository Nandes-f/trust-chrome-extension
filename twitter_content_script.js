async function extractTwitterData(twitterUrl)   {
    try {
        console.log('Extracting Twitter data from URL:', twitterUrl);
        //twitter url
        // Extract data for main profile
        const mainProfile = await extractProfileData(twitterUrl);
        console.log('Extracted main profile data:', mainProfile);

        // Extract following profiles
        const followingProfiles = await extractFollowingProfiles();
        console.log('Extracted following profiles:', followingProfiles);

        // // Extract followers URLs (you might want to update this similarly)
        // const followerProfiles = await extractFollowersUrls();
        // console.log('Extracted follower URLs:', followerProfiles);

        return {
            success: true,
            data: {
                mainProfile,
                followingProfiles,
            }
        };
    } catch (error) {
        console.error('Error in extractTwitterData:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function extractFollowingProfiles() {
    try {
        const followingProfiles = new Set();
        const followingLink = document.querySelector('a[href$="/following"]');
        
        if (!followingLink) {
            console.log('Following link not found, might be on a different page');
            return [];
        }

        // Get the total number of following
        const followingCount = parseInt(document.querySelector('[data-testid="primaryColumn"] a[href$="/following"] span')?.textContent.replace(/,/g, '') || '0');
        console.log(`Target following count: ${followingCount}`);

        // Click and wait longer initially
        followingLink.click();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 5 seconds

        let lastProfilesCount = 0;
        let noNewProfilesCount = 0;
        const maxNoNewProfilesAttempts = 3; // Changed from 15 to 3
        
        while (true) {
            // More aggressive scrolling pattern
            for (let i = 0; i < 3; i++) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, 1000));
                window.scrollBy(0, -500); // Scroll up a bit
                await new Promise(resolve => setTimeout(resolve, 500));
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Extract profiles with improved selector
            const followingElements = document.querySelectorAll('[data-testid="UserCell"], [data-testid="TypeaheadUser"]');
            
            followingElements.forEach(el => {
                const profileLink = el.querySelector('a[role="link"], a[data-testid="UserCell-link"]')?.href;
                if (profileLink && !profileLink.includes('/status/')) {
                    followingProfiles.add(profileLink);
                }
            });

            console.log(`Found ${followingProfiles.size} of ${followingCount} following profiles`);

            // Check if we're stuck
            if (followingProfiles.size === lastProfilesCount) {
                noNewProfilesCount++;
                console.log(`No new profiles found, attempt ${noNewProfilesCount} of ${maxNoNewProfilesAttempts}`);
                
                if (noNewProfilesCount >= maxNoNewProfilesAttempts) {
                    // Try one last aggressive scroll before giving up
                    for (let i = 0; i < 5; i++) {
                        window.scrollTo(0, 0);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        window.scrollTo(0, document.body.scrollHeight);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    // Check if this last attempt found any new profiles
                    const finalCheck = document.querySelectorAll('[data-testid="UserCell"], [data-testid="TypeaheadUser"]');
                    let foundNew = false;
                    finalCheck.forEach(el => {
                        const profileLink = el.querySelector('a[role="link"], a[data-testid="UserCell-link"]')?.href;
                        if (profileLink && !profileLink.includes('/status/') && !followingProfiles.has(profileLink)) {
                            followingProfiles.add(profileLink);
                            foundNew = true;
                        }
                    });
                    
                    if (!foundNew) {
                        console.log('Maximum retry attempts reached, stopping');
                        break;
                    }
                }
            } else {
                noNewProfilesCount = 0;
                lastProfilesCount = followingProfiles.size;
            }

            // Break if we've found all profiles or hit Twitter's limit
            if (followingProfiles.size >= followingCount) {
                console.log('Reached target count');
                break;
            }
        }

        return Array.from(followingProfiles);
    } catch (error) {
        console.error('Error extracting following profiles:', error);
        return [];
    }
}


async function extractProfileData(url) {
    try {
        // Try to get data from schema first
        const schemaScript = document.querySelector('script[data-testid="UserProfileSchema-test"]');
        if (schemaScript) {
            console.log('Schema script found, extracting profile data');
            return extractFromSchema(schemaScript, url);
        }

        // Fallback to DOM extraction if schema not available
        console.log('Schema script not found, falling back to DOM extraction');
        return extractFromDOM(url);
    } catch (error) {
        console.error('Error in extractProfileData:', error);
        throw error;
    }
}

function extractFromSchema(schemaScript, url) {
    try {
        const schemaData = JSON.parse(schemaScript.textContent);
        
        // Extract main entity data
        const mainEntity = schemaData?.mainEntity || {};
        
        const profileData = {
            name: mainEntity?.givenName || '',
            handle: mainEntity?.additionalName || '',
            profileImageUrl: mainEntity?.image?.contentUrl || '',
            bio: mainEntity?.description || '',
            location: mainEntity?.homeLocation?.name || '',
            website: mainEntity?.url || '',
            joinDate: schemaData?.dateCreated || '',
            followers: '0',
            following: '0',
            tweets: '0',
            contentRating: schemaData?.contentRating || '',
            context: schemaData['@context'] || '',
            identifier: mainEntity?.identifier || '',
            relatedLinks: schemaData?.relatedLink || []
        };

        // Extract interaction statistics
        if (Array.isArray(mainEntity?.interactionStatistic)) {
            mainEntity.interactionStatistic.forEach(stat => {
                if (stat?.userInteractionCount) {
                    switch(stat.name) {
                        case 'Friends':
                            profileData.following = String(stat.userInteractionCount);
                            break;
                        case 'Tweets':
                            profileData.tweets = String(stat.userInteractionCount);
                            break;
                        case 'Follows':
                            profileData.followers = String(stat.userInteractionCount);
                            break;
                    }
                }
            });
        }

        // Clean up profile image URL if it exists
        if (profileData.profileImageUrl) {
            profileData.profileImageUrl = profileData.profileImageUrl
                .replace('_normal.', '_400x400.')
                .replace('_200x200.', '_400x400.');
        }

        return profileData;
    } catch (error) {
        console.log('Error parsing schema data:', error);
        return extractFromDOM(url);
    }
}

async function extractFromDOM(url) {
    // Improved DOM extraction for name and handle
    const nameElement = document.querySelector('[data-testid="primaryColumn"] [data-testid="UserName"]');
    let name = '';
    let handle = url.split('/')[3];

    if (nameElement) {
        // Try XPath first for more precise selection
        const xpath = '/html/body/div[1]/div/div/div[2]/main/div/div/div/div/div/div[3]/div/div/div/div[1]/div[2]/div/div/div/div[1]/div/div/span/span[1]';
        const nameSpanXPath = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        
        // Fallback to previous selector if XPath fails
        const nameSpan = nameSpanXPath || nameElement.querySelector('span:first-child');
        name = nameSpan?.textContent?.trim() || '';
    }
    // Add photo extraction
    const profileImage = document.querySelector('[data-testid="UserAvatar"] img')?.src || '';
    
    return {
        name: name,
        handle: handle,
        url: url,
        profileImageUrl: profileImage,
        bio: document.querySelector('[data-testid="UserDescription"]')?.textContent?.trim() || '',
        location: document.querySelector('[data-testid="UserLocation"]')?.textContent?.trim() || '',
        followers: (() => {
            const followersXPath = '/html/body/div[1]/div/div/div[2]/main/div/div/div/div/div/div[3]/div/div/div/div/div[5]/div[2]/a/span[1]/span';
            const followersByXPath = document.evaluate(followersXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return (followersByXPath?.textContent || document.querySelector('[data-testid="primaryColumn"] a[href$="/followers"] span span')?.textContent || '0').replace(/,/g, '');
        })(),
        following: document.querySelector('[data-testid="primaryColumn"] a[href$="/following"] span span')?.textContent?.replace(/,/g, '') || '0',
        category: document.querySelector('[data-testid="primaryColumn"] [data-testid="UserProfileHeader_Items"] span')?.textContent || '0'
    };
}

// Message listener for communication with options.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractTwitterData") {
        console.log(request.url);
        console.log(request.id);
        if (request.url && request.id!=1) {
            console.log('Extracting Twitter data from URL: ' + request.url);
            // If URL is provided, just extract profile data
            extractProfileData(request.url)
                .then(profileData => {
                    console.log(profileData);
                    sendResponse({
                        success: true,
                        data: {
                            mainProfile: profileData,
                            followingProfiles: [] // Empty array since we're only getting profile data
                        }
                    });
                })
                .catch(error => {
                    sendResponse({
                        success: false,
                        error: error.message
                    });
                });
        } else {
            // Original behavior for current page
            extractTwitterData(request.url)
                .then(response => {
                    sendResponse(response);
                })
                .catch(error => {
                    sendResponse({
                        success: false,
                        error: error.message
                    });
                });
        }
        return true; // Keep the message channel open for async response
    }
});

console.log("Twitter content script loaded");