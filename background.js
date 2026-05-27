const CHATGPT_HOME_URL = 'https://chatgpt.com/';
const CHATGPT_QUERY_URL_MAX_LENGTH = 1800;
const CHATGPT_TAB_URLS = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
];
const ROOT_MENU_ID = 'chatgpt';
const DEFAULT_PROMPT_PRESET = {
  id: 'default',
  name: 'Explain command',
  promptFormat: 'Explain <prompt>',
  sidechat: false,
};

chrome.runtime.onInstalled.addListener(updateContextMenus);
chrome.runtime.onStartup.addListener(updateContextMenus);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.promptPresets || changes.promptFormat)) {
    updateContextMenus();
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'logToBackground') {
    console.log.apply(null, request.data);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText) {
    return;
  }

  if (isSidechatMenuItem(info.menuItemId)) {
    openSidechatPanel(tab);
  }

  chrome.storage.local.get(['promptPresets', 'promptFormat', 'chatID', 'chatURL', 'focusExistingTab'], (data) => {
    const preset = findPresetForMenuItem(info.menuItemId, data);
    if (!preset) {
      return;
    }

    const promptFormat = preset.promptFormat;
    const formattedPrompt = promptFormat.replace('<prompt>', info.selectionText);
    const configuredChatURL = normalizeChatURL(data.chatURL || data.chatID || '');

    if (preset.sidechat) {
      updateSidechatPrompt(formattedPrompt, tab);
      return;
    }

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

function updateContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.storage.local.get(['promptPresets', 'promptFormat'], (data) => {
      const presets = getPromptPresets(data);
      if (presets.length <= 1) {
        chrome.contextMenus.create({
          id: getMenuItemId(presets[0]),
          title: presets[0].name || 'Ask ChatGPT',
          contexts: ['selection'],
        });
        return;
      }

      chrome.contextMenus.create({
        id: ROOT_MENU_ID,
        title: 'Ask ChatGPT',
        contexts: ['selection'],
      });

      presets.forEach((preset) => {
        chrome.contextMenus.create({
          id: getMenuItemId(preset),
          parentId: ROOT_MENU_ID,
          title: preset.name,
          contexts: ['selection'],
        });
      });
    });
  });
}

function findPresetForMenuItem(menuItemId, data) {
  const presets = getPromptPresets(data);
  if (menuItemId === ROOT_MENU_ID && presets.length === 1) {
    return presets[0];
  }

  const presetId = getPresetIdFromMenuItem(menuItemId);
  return presets.find((preset) => preset.id === presetId);
}

function getPromptPresets(data) {
  if (Array.isArray(data.promptPresets)) {
    const presets = data.promptPresets
      .map(normalizePromptPreset)
      .filter((preset) => preset.name && preset.promptFormat.includes('<prompt>'));

    if (presets.length) {
      return presets;
    }
  }

  return [{
    ...DEFAULT_PROMPT_PRESET,
    promptFormat: data.promptFormat || DEFAULT_PROMPT_PRESET.promptFormat,
  }];
}

function normalizePromptPreset(preset, index) {
  return {
    id: String(preset.id || `preset-${index}`),
    name: String(preset.name || '').trim(),
    promptFormat: String(preset.promptFormat || ''),
    sidechat: Boolean(preset.sidechat),
  };
}

function getMenuItemId(preset) {
  return `chatgpt-preset-${preset.sidechat ? 'sidechat' : 'tab'}-${preset.id}`;
}

function isSidechatMenuItem(menuItemId) {
  return String(menuItemId).startsWith('chatgpt-preset-sidechat-');
}

function getPresetIdFromMenuItem(menuItemId) {
  return String(menuItemId).replace(/^chatgpt-preset-(sidechat|tab)-/, '').replace(/^chatgpt-preset-/, '');
}

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

function openSidechatPanel(tab) {
  if (!chrome.sidePanel || !tab || !tab.id) {
    setSidechatError('Chrome side panel is not available for this page.');
    return;
  }

  try {
    const openPanel = chrome.sidePanel.open({ tabId: tab.id });
    if (openPanel && typeof openPanel.catch === 'function') {
      openPanel.catch((error) => {
        console.error(error);
        setSidechatError(error && error.message ? error.message : String(error));
      });
    }
  } catch (error) {
    console.error(error);
    setSidechatError(error && error.message ? error.message : String(error));
  }
}

function updateSidechatPrompt(prompt, tab) {
  const chatURL = buildPromptQueryURL(prompt);

  chrome.storage.local.set({
    sidechatPrompt: prompt,
    sidechatURL: chatURL,
    sidechatError: chrome.sidePanel && tab && tab.id ? '' : 'Chrome side panel is not available for this page.',
    sidechatUpdatedAt: Date.now(),
  });
}

function setSidechatError(message) {
  chrome.storage.local.set({
    sidechatError: message,
    sidechatUpdatedAt: Date.now(),
  });
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
