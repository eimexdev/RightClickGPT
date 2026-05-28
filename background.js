const CHATGPT_HOME_URL = 'https://chatgpt.com/';
const T3_HOME_URL = 'https://t3.chat/';
const T3_NEW_CHAT_URL = 'https://t3.chat/new';
const CHATGPT_QUERY_URL_MAX_LENGTH = 1800;
const CHATGPT_TAB_URLS = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
];
const T3_TAB_URLS = ['https://t3.chat/*'];
const ROOT_MENU_ID = 'chatgpt';
const DEFAULT_CHAT_PROVIDER = 'chatgpt';
const DEFAULT_PROMPT_BEHAVIOR = 'newTab';
const PROMPT_BEHAVIORS = ['default', 'newTab', 'sidechat'];
const GLOBAL_PROMPT_BEHAVIORS = ['newTab', 'sidechat'];
const CHAT_PROVIDERS = {
  chatgpt: {
    homeURL: CHATGPT_HOME_URL,
    tabURLs: CHATGPT_TAB_URLS,
    menuTitle: 'Ask ChatGPT',
    existingTabLabel: 'Use existing ChatGPT tab',
  },
  t3: {
    homeURL: T3_HOME_URL,
    tabURLs: T3_TAB_URLS,
    menuTitle: 'Ask t3.chat',
    existingTabLabel: 'Use existing t3.chat tab',
  },
};
const DEFAULT_PROMPT_PRESET = {
  id: 'default',
  name: 'Explain command',
  promptFormat: 'Explain <prompt>',
  behavior: 'default',
};

chrome.runtime.onInstalled.addListener(updateContextMenus);
chrome.runtime.onStartup.addListener(updateContextMenus);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.promptPresets || changes.promptFormat || changes.chatProvider || changes.defaultPromptBehavior)) {
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

  chrome.storage.local.get(['promptPresets', 'promptFormat', 'chatID', 'chatURL', 'chatProvider', 'focusExistingTab', 'defaultPromptBehavior'], (data) => {
    const preset = findPresetForMenuItem(info.menuItemId, data);
    if (!preset) {
      return;
    }

    const provider = getChatProvider(data.chatProvider);
    const promptFormat = preset.promptFormat;
    const formattedPrompt = promptFormat.replace('<prompt>', info.selectionText);
    const configuredChatURL = normalizeChatURL(data.chatURL || data.chatID || '', provider.id);

    if (getEffectivePromptBehavior(preset, data.defaultPromptBehavior) === 'sidechat') {
      openSidechatPanel(tab);
      updateSidechatPrompt(formattedPrompt, tab, provider.id);
      return;
    }

    if (data.focusExistingTab) {
      sendToExistingChatTab(formattedPrompt, provider.id, (sentToExistingTab) => {
        if (sentToExistingTab) {
          return;
        }

        openPromptTarget(configuredChatURL, formattedPrompt, provider.id);
      });
      return;
    }

    openPromptTarget(configuredChatURL, formattedPrompt, provider.id);
  });
});

function updateContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.storage.local.get(['promptPresets', 'promptFormat', 'chatProvider'], (data) => {
      const presets = getPromptPresets(data);
      const provider = getChatProvider(data.chatProvider);
      if (presets.length <= 1) {
        chrome.contextMenus.create({
          id: getMenuItemId(presets[0]),
          title: presets[0].name || provider.menuTitle,
          contexts: ['selection'],
        });
        return;
      }

      chrome.contextMenus.create({
        id: ROOT_MENU_ID,
        title: provider.menuTitle,
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
    behavior: getPresetBehavior(preset),
  };
}

function getMenuItemId(preset) {
  return `chatgpt-preset-${preset.id}`;
}

function getPresetIdFromMenuItem(menuItemId) {
  return String(menuItemId).replace(/^chatgpt-preset-(sidechat|tab)-/, '').replace(/^chatgpt-preset-/, '');
}

function getPresetBehavior(preset) {
  if (PROMPT_BEHAVIORS.includes(preset && preset.behavior)) {
    return preset.behavior;
  }

  return preset && preset.sidechat ? 'sidechat' : 'default';
}

function getGlobalPromptBehavior(behavior) {
  return GLOBAL_PROMPT_BEHAVIORS.includes(behavior) ? behavior : DEFAULT_PROMPT_BEHAVIOR;
}

function getEffectivePromptBehavior(preset, defaultBehavior) {
  return preset.behavior === 'default' ? getGlobalPromptBehavior(defaultBehavior) : preset.behavior;
}

function getChatProvider(providerId) {
  const id = CHAT_PROVIDERS[providerId] ? providerId : DEFAULT_CHAT_PROVIDER;
  return { id, ...CHAT_PROVIDERS[id] };
}

function sendToExistingChatTab(prompt, providerId, callback) {
  const provider = getChatProvider(providerId);
  chrome.tabs.query({ url: provider.tabURLs }, (tabs) => {
    if (!tabs.length) {
      callback(false);
      return;
    }

    const existingTab = tabs[0];
    chrome.tabs.update(existingTab.id, { active: true }, () => {
      injectPromptIntoTab(existingTab.id, { action: 'sendToChatProvider', provider: provider.id, prompt });
      callback(true);
    });
  });
}

function openPromptTarget(configuredChatURL, prompt, providerId) {
  const provider = getChatProvider(providerId);
  if (configuredChatURL) {
    createNewTabAndInject(configuredChatURL, prompt, provider.id);
    return;
  }

  const queryURL = buildPromptQueryURL(prompt, provider.id);
  if (provider.id === 't3') {
    chrome.tabs.create({ url: queryURL });
    return;
  }

  if (queryURL.length <= CHATGPT_QUERY_URL_MAX_LENGTH) {
    createNewTabAndEnsureQueryPromptSubmitted(queryURL, prompt, provider.id);
    return;
  }

  createNewTabAndInject(provider.homeURL, prompt, provider.id);
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

function updateSidechatPrompt(prompt, tab, providerId) {
  const provider = getChatProvider(providerId);
  const chatURL = buildPromptQueryURL(prompt, provider.id);

  chrome.storage.local.set({
    sidechatPrompt: prompt,
    sidechatURL: chatURL,
    sidechatProvider: provider.id,
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

function buildPromptQueryURL(prompt, providerId) {
  const provider = getChatProvider(providerId);
  const url = new URL(provider.id === 't3' ? T3_NEW_CHAT_URL : provider.homeURL);
  url.searchParams.set('q', prompt);
  return url.toString();
}

function normalizeChatURL(rawValue, providerId) {
  const provider = getChatProvider(providerId);
  const value = String(rawValue || '').trim();
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    if (isProviderHost(url.hostname, provider.id)) {
      return url.toString();
    }
  } catch (error) {
    // Treat non-URL values as legacy bare chat IDs.
  }

  const legacyChatID = value.replace(/^\/+|\/+$/g, '');
  if (!legacyChatID) {
    return '';
  }

  return provider.id === 't3'
    ? `https://t3.chat/chat/${encodeURIComponent(legacyChatID)}`
    : `https://chatgpt.com/c/${encodeURIComponent(legacyChatID)}`;
}

function isProviderHost(hostname, providerId) {
  if (providerId === 't3') {
    return hostname === 't3.chat';
  }

  return hostname === 'chatgpt.com' || hostname === 'chat.openai.com';
}

function createNewTabAndInject(url, prompt, providerId) {
  createNewTabAndSendMessage(url, { action: 'sendToChatProvider', provider: getChatProvider(providerId).id, prompt });
}

function createNewTabAndEnsureQueryPromptSubmitted(url, prompt, providerId) {
  createNewTabAndSendMessage(url, { action: 'ensureChatProviderPromptSubmitted', provider: getChatProvider(providerId).id, prompt });
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
