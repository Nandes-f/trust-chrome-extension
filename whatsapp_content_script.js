(function() {
  if (window.whatsappContentScriptLoaded) return;
  window.whatsappContentScriptLoaded = true;

  console.log("WhatsApp content script is running");

  let MEMBERS_QUEUE = {};
  let extractionInProgress = false;
  let SCROLL_INTERVAL = 600;
  let SCROLL_INCREMENT = 450;
  let AUTO_SCROLL = true;
  let NAME_PREFIX = '';
  let UNKNOWN_CONTACTS_ONLY = false;
  let TOTAL_MEMBERS;

  let scrollInterval, observer, membersList, header;

  function addMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Received message:", request);
      if (request.action === "extractContacts") {
        console.log("Extraction request received");
        if (!extractionInProgress) {
          extractionInProgress = true;
          sendResponse({status: "started"});
          start();
        } else {
          sendResponse({status: "inProgress"});
        }
      } else if (request.action === "ping") {
        sendResponse({status: "ready"});
      }
      return true;
    });
  }

  function checkForGroupChange() {
    try {
      const currentGroup = getCurrentGroup();
      if (currentGroup) {
        chrome.runtime.sendMessage({type: "groupChanged", groupName: currentGroup});
      }
    } catch (error) {
      console.error("Error in checkForGroupChange:", error);
      // If the extension context is invalidated, re-add the message listener
      if (error.message.includes("Extension context invalidated")) {
        addMessageListener();
      }
    }
  }

  let groupChangeInterval = setInterval(checkForGroupChange, 1000);

  async function start() {
    console.log("Starting WhatsApp data extraction");
    
    try {
      // Wait for the main content to load
      await waitForElement('#main');
      
      membersList = document.querySelector('div[data-testid="chat-list"]');
      header = document.querySelector('header');

      if (!membersList) {
        console.log("Chat list not found, trying to open it");
        const menuButton = await waitForElement('div[data-testid="menu-bar-menu"]');
        if (menuButton) {
          menuButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          const newChatButton = await waitForElement('div[aria-label="New chat"]');
          if (newChatButton) {
            newChatButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        membersList = await waitForElement('div[data-testid="chat-list"]');
      }

      if (!membersList) {
        console.error("Unable to find the chat list");
        chrome.runtime.sendMessage({
          action: "extractionError",
          error: "Unable to find the chat list. Please make sure you're on the WhatsApp Web page and try again."
        });
        return;
      }

      observer = new MutationObserver(function (mutations, observer) {   
        scrapeData();
      });

      observer.observe(membersList, {
        childList: true,
        subtree: true
      });

      TOTAL_MEMBERS = await getTotalMembers();
      
      console.log(`Total members found: ${TOTAL_MEMBERS}`);

      scrapeData();

      if (AUTO_SCROLL) scrollInterval = setInterval(autoScroll, SCROLL_INTERVAL);    
    } catch (error) {
      console.error("Error in start function:", error);
      chrome.runtime.sendMessage({
        action: "extractionError",
        error: "An error occurred while starting the extraction process."
      });
    }
  }

  async function waitForElement(selector, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return null;
  }

  async function getTotalMembers() {
    // This is a placeholder. You might need to adjust this based on the actual WhatsApp Web structure
    const chatItems = await waitForElement('div[data-testid="chat-list"] > div');
    return chatItems ? chatItems.children.length : 0;
  }

  function autoScroll() {
    if (!utils.scrollEndReached(header.nextSibling)) 
      header.nextSibling.scrollTop += SCROLL_INCREMENT;
    else
      stop();
  }

  function stop() {
    console.log("Stopping extraction process");
    window.clearInterval(scrollInterval);
    observer.disconnect();
    console.log(`Extracted [${utils.queueLength()} / ${TOTAL_MEMBERS}] Members. Starting Download..`);
    downloadAsCSV(['Name','Phone','Status']);
  }

  function scrapeData() {
    console.log("Scraping data started");
    var contact, status, name;
    var memberCard = membersList.querySelectorAll(':scope > div');

    console.log(`Found ${memberCard.length} member cards`);

    for (let i = 0; i < memberCard.length; i++) {
      console.log(`Processing member card ${i + 1}`);
      status = memberCard[i].querySelectorAll('span[title]')[1] ? memberCard[i].querySelectorAll('span[title]')[1].title : "";
      contact = scrapePhoneNum(memberCard[i]);
      name = scrapeName(memberCard[i]);

      if (contact.phone != 'NIL' && !MEMBERS_QUEUE[contact.phone]) {
        if (contact.isUnsaved) {
          MEMBERS_QUEUE[contact.phone] = { 'Name': NAME_PREFIX + name, 'Status': status };
          continue;
        } else if (!UNKNOWN_CONTACTS_ONLY) {
          MEMBERS_QUEUE[contact.phone] = { 'Name': name, 'Status': status };
        }
      } else if (MEMBERS_QUEUE[contact.phone]) {
        MEMBERS_QUEUE[contact.phone].Status = status;
      }

      if (utils.queueLength() >= TOTAL_MEMBERS) {
        stop();
        break;
      }
    }

    console.log(`Finished scraping. MEMBERS_QUEUE size: ${utils.queueLength()}`);
  }

  function scrapePhoneNum(el) {
    var phone, isUnsaved = false;
    if (el.querySelector('img') && el.querySelector('img').src.match(/u=[0-9]*/)) {
      phone = el.querySelector('img').src.match(/u=[0-9]*/)[0].substring(2).replace(/[+\s]/g, '');
    } else {
      var temp = el.querySelector('span[title]').getAttribute('title').match(/(.?)*[0-9]{3}$/);
      if (temp) {
        phone = temp[0].replace(/\D/g,'');
        isUnsaved = true;
      } else {
        phone = 'NIL';
      }
    }
    return { 'phone': phone, 'isUnsaved': isUnsaved };
  }

  function scrapeName(el) {
    var expectedName;
    expectedName = el.firstChild.firstChild.childNodes[1].childNodes[1].childNodes[1].querySelector('span').innerText;
    if (expectedName == "") {
      return el.querySelector('span[title]').getAttribute('title');
    }
    return expectedName;
  }

  function downloadAsCSV(header) {
    console.log("Starting CSV download");
    var groupName = document.querySelectorAll("#main > header span")[1].title;
    var fileName = groupName.replace(/[^\d\w\s]/g,'') ? groupName.replace(/[^\d\w\s]/g,'') : 'WAXP-group-members';

    var name = `${fileName}.csv`, data = `${header.join(',')}\n`;

    if (utils.queueLength() > 0) {
      console.log(`Creating CSV with ${utils.queueLength()} contacts`);
      for (key in MEMBERS_QUEUE) {
        if (header.includes('Status'))
          data += `"${MEMBERS_QUEUE[key]['Name']}","${key}","${MEMBERS_QUEUE[key]['Status'].replace(/\"/g,"'")}"\n`;
        else
          data += `"${MEMBERS_QUEUE[key]['Name']}","${key}"\n`;
      }
      utils.createDownloadLink(data, name);
    } else {
      console.log("No contacts found to download");
      alert("Couldn't find any contacts with the given options");
    }
  }

  function quickExport() {
    var members = document.querySelectorAll("#main > header span")[2].title.replace(/ /g,'').split(',');
    var groupName = document.querySelectorAll("#main > header span")[1].title;
    var fileName = groupName.replace(/[^\d\w\s]/g,'') ? groupName.replace(/[^\d\w\s]/g,'') : 'WAXP-group-members';
    
    fileName = `${fileName}.csv`;
    members.pop();

    MEMBERS_QUEUE = {};

    for (i = 0; i < members.length; ++i) {
      if (members[i].match(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)) {
        MEMBERS_QUEUE[members[i]] = {
          'Name': NAME_PREFIX + members[i]
        };
        continue;
      } else if (!UNKNOWN_CONTACTS_ONLY) {
        MEMBERS_QUEUE[members[i]] = {
          'Name': members[i]
        };
      }
    }
    
    downloadAsCSV(['Name','Phone']);
  }

  var utils = (function(){
    return {
      scrollEndReached: function(el){
        if ((el.scrollHeight - (el.clientHeight + el.scrollTop)) == 0)
          return true;
        return false;
      },
      queueLength: function() {
        var size = 0, key;
        for (key in MEMBERS_QUEUE) {
          if (MEMBERS_QUEUE.hasOwnProperty(key)) size++;
        }
        return size;
      },
      createDownloadLink: function (data, fileName) {
        console.log(`Creating download link for ${fileName}`);
        var a = document.createElement('a');
        a.style.display = "none";

        var url = window.URL.createObjectURL(new Blob([data], {
          type: "data:attachment/text"
        }));
        a.setAttribute("href", url);
        a.setAttribute("download", fileName);
        document.body.append(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        console.log("Download link clicked");
      }
    }
  })();

  function getCurrentGroup() {
    const groupNameElement = document.querySelector('#main > header span[title]');
    return groupNameElement ? groupNameElement.title : null;
  }

  console.log("WhatsApp content script loaded and ready");
  addMessageListener();
})();