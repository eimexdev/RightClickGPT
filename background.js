const CHATGPT_HOME_URL = 'https://chatgpt.com/';
const CHATGPT_QUERY_URL_MAX_LENGTH = 1800;
const CHATGPT_TAB_URLS = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'chatgpt',
    title: 'Ask ChatGPT',
    contexts: ['selection'],
  });
});

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'logToBackground') {
    console.log.apply(null, request.data);
  }
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'chatgpt' || !info.selectionText) {
    return;
  }

  chrome.storage.local.get(['promptFormat', 'chatID', 'chatURL', 'focusExistingTab'], (data) => {
    const promptFormat = data.promptFormat || 'Explain <prompt>';
    const formattedPrompt = promptFormat.replace('<prompt>', info.selectionText);
    const configuredChatURL = normalizeChatURL(data.chatURL || data.chatID || '');

    if (data.focusExistingTab) {
      sendToExistingChatGPTTab(formattedPrompt, (sentToExistingTab) => {
        if (sentToExistingTab) {
          return;
        }

        openPromptTarget(configuredChatURL, formattedPrompt);
      });
      return;
    }

    openPromptTarget(configuredChatURL, formattedPrompt);
  });
});

function sendToExistingChatGPTTab(prompt, callback) {
  chrome.tabs.query({ url: CHATGPT_TAB_URLS }, (tabs) => {
    if (!tabs.length) {
      callback(false);
      return;
    }

    const existingTab = tabs[0];
    chrome.tabs.update(existingTab.id, { active: true }, () => {
      injectPromptIntoTab(existingTab.id, { action: 'sendToChatGPT', prompt });
      callback(true);
    });
  });
}

function openPromptTarget(configuredChatURL, prompt) {
  if (configuredChatURL) {
    createNewTabAndInject(configuredChatURL, prompt);
    return;
  }

  const queryURL = buildPromptQueryURL(prompt);
  if (queryURL.length <= CHATGPT_QUERY_URL_MAX_LENGTH) {
    createNewTabAndEnsureQueryPromptSubmitted(queryURL, prompt);
    return;
  }

  createNewTabAndInject(CHATGPT_HOME_URL, prompt);
}

function buildPromptQueryURL(prompt) {
  const url = new URL(CHATGPT_HOME_URL);
  url.searchParams.set('q', prompt);
  return url.toString();
}

function normalizeChatURL(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    if (url.hostname === 'chatgpt.com' || url.hostname === 'chat.openai.com') {
      return url.toString();
    }
  } catch (error) {
    // Treat non-URL values as legacy bare chat IDs.
  }

  const legacyChatID = value.replace(/^\/+|\/+$/g, '');
  return legacyChatID ? `https://chatgpt.com/c/${encodeURIComponent(legacyChatID)}` : '';
}

function createNewTabAndInject(url, prompt) {
  createNewTabAndSendMessage(url, { action: 'sendToChatGPT', prompt });
}

function createNewTabAndEnsureQueryPromptSubmitted(url, prompt) {
  createNewTabAndSendMessage(url, { action: 'ensureChatGPTPromptSubmitted', prompt });
}

function createNewTabAndSendMessage(url, message) {
  chrome.tabs.create({ url }, (newTab) => {
    const listener = (tabId, changeInfo) => {
      if (tabId !== newTab.id || changeInfo.status !== 'complete') {
        return;
      }

      chrome.tabs.onUpdated.removeListener(listener);
      injectPromptIntoTab(tabId, message);
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function injectPromptIntoTab(tabId, message) {
  chrome.scripting.executeScript(
    {
      target: { tabId },
      files: ['content.js'],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        return;
      }

      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          return;
        }

        if (!response || !response.ok) {
          console.error(response && response.error ? response.error : 'Unable to send prompt to ChatGPT.');
        }
      });
    }
  );
}
