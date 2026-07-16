const CHATGPT_HOME_URL = 'https://chatgpt.com/';
const T3_HOME_URL = 'https://t3.chat/';
const T3_NEW_CHAT_URL = 'https://t3.chat/new';
const T3_QUERY_URL_MAX_LENGTH = 1800;
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
const CONSENT_VERSION = 1;
const MANIFEST = chrome.runtime.getManifest();
const SUPPORTS_SIDECHAT = Boolean(MANIFEST.side_panel && chrome.sidePanel);
const ADVANCED_FRAME_RULE_IDS = [1001, 1002, 1003];
const PENDING_PROMPT_PREFIX = 'pendingPrompt:';
const PENDING_PROMPT_EXPIRY_ALARM_PREFIX = 'pendingPromptExpiry:';
const PENDING_PROMPT_MAX_AGE_MS = 5 * 60 * 1000;
const LEGACY_SIDECHAT_LOCAL_KEYS = ['sidechatPrompt', 'sidechatURL', 'sidechatError', 'sidechatUpdatedAt'];
const CHAT_PROVIDERS = {
  chatgpt: {
    homeURL: CHATGPT_HOME_URL,
    tabURLs: CHATGPT_TAB_URLS,
    label: 'ChatGPT',
    menuTitle: 'Ask ChatGPT',
    existingTabLabel: 'Use existing ChatGPT tab',
  },
  t3: {
    homeURL: T3_HOME_URL,
    tabURLs: T3_TAB_URLS,
    label: 't3.chat',
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

chrome.runtime.onInstalled.addListener(async () => {
  await clearExpiredPendingPrompts();
  await chrome.storage.local.remove(LEGACY_SIDECHAT_LOCAL_KEYS);
  await configureAdvancedFrameRules();
  const consent = await chrome.storage.local.get(['dataConsentVersion']);
  if (consent.dataConsentVersion !== CONSENT_VERSION) {
    await chrome.contextMenus.removeAll();
    await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
    return;
  }

  updateContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await clearExpiredPendingPrompts();
  await chrome.storage.local.remove(LEGACY_SIDECHAT_LOCAL_KEYS);
  await configureAdvancedFrameRules();
  updateContextMenus();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(PENDING_PROMPT_EXPIRY_ALARM_PREFIX)) {
    return;
  }

  const tabId = alarm.name.slice(PENDING_PROMPT_EXPIRY_ALARM_PREFIX.length);
  chrome.storage.session.remove(`${PENDING_PROMPT_PREFIX}${tabId}`);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`${PENDING_PROMPT_PREFIX}${tabId}`);
  chrome.alarms.clear(`${PENDING_PROMPT_EXPIRY_ALARM_PREFIX}${tabId}`);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (
    changes.promptPresets ||
    changes.promptFormat ||
    changes.chatProvider ||
    changes.defaultPromptBehavior ||
    changes.dataConsentVersion
  )) {
    updateContextMenus();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'logToBackground') {
    console.log.apply(null, request.data);
    return false;
  }

  if (request.action === 'enableT3SidePanelBridge') {
    if (!SUPPORTS_SIDECHAT || !chrome.scripting || !isValidT3SidePanelFrame(sender)) {
      sendResponse({ ok: false });
      return false;
    }

    chrome.scripting.executeScript({
      target: {
        tabId: sender.tab.id,
        frameIds: [sender.frameId],
      },
      files: ['t3-bridge.js'],
      world: 'MAIN',
    }).then(
      () => sendResponse({ ok: true }),
      (error) => {
        console.error('Unable to enable the T3 side-panel bridge.', error);
        sendResponse({ ok: false });
      },
    );
    return true;
  }

  if (request.action === 'consumePendingPrompt') {
    getPendingPromptForTab(sender).then(sendResponse);
    return true;
  }

  if (request.action === 'acknowledgePendingPrompt') {
    acknowledgePendingPrompt(sender).then(sendResponse);
    return true;
  }

  return false;
});

function isValidT3SidePanelFrame(sender) {
  if (!sender.tab || !Number.isInteger(sender.tab.id) || !Number.isInteger(sender.frameId) || sender.frameId <= 0) {
    return false;
  }

  try {
    return new URL(sender.url).hostname === 't3.chat';
  } catch (error) {
    return false;
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText) {
    return;
  }

  chrome.storage.local.get(['dataConsentVersion', 'promptPresets', 'promptFormat', 'chatID', 'chatURL', 'chatProvider', 'focusExistingTab', 'defaultPromptBehavior'], (data) => {
    if (data.dataConsentVersion !== CONSENT_VERSION) {
      chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
      return;
    }

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
      updateSidechatPrompt(formattedPrompt, tab, provider.id, configuredChatURL);
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
    chrome.storage.local.get(['dataConsentVersion', 'promptPresets', 'promptFormat', 'chatProvider', 'defaultPromptBehavior'], (data) => {
      if (data.dataConsentVersion !== CONSENT_VERSION) {
        return;
      }

      const presets = getPromptPresets(data);
      const provider = getChatProvider(data.chatProvider);
      if (!presets.length) {
        return;
      }

      if (presets.length <= 1) {
        chrome.contextMenus.create({
          id: getMenuItemId(presets[0]),
          title: `${presets[0].name || 'Send selection'} → ${provider.label}`,
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
      .filter((preset) => preset.enabled && preset.name && preset.promptFormat.includes('<prompt>'));

    if (presets.length || data.promptPresets.length) {
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
    enabled: preset.enabled !== false,
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
    return preset.behavior === 'sidechat' && !SUPPORTS_SIDECHAT ? 'newTab' : preset.behavior;
  }

  return preset && preset.sidechat && SUPPORTS_SIDECHAT ? 'sidechat' : 'default';
}

function getGlobalPromptBehavior(behavior) {
  if (behavior === 'sidechat' && !SUPPORTS_SIDECHAT) {
    return DEFAULT_PROMPT_BEHAVIOR;
  }

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
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        callback(false);
        return;
      }

      sendPromptMessage(
        existingTab.id,
        { action: 'sendToChatProvider', provider: provider.id, prompt },
        callback,
      );
    });
  });
}

function openPromptTarget(configuredChatURL, prompt, providerId) {
  const provider = getChatProvider(providerId);
  if (configuredChatURL) {
    openTabWithPendingPrompt(configuredChatURL, prompt, provider.id);
    return;
  }

  if (provider.id === 't3') {
    const queryURL = buildPromptQueryURL(prompt, provider.id);
    if (queryURL.length <= T3_QUERY_URL_MAX_LENGTH) {
      chrome.tabs.create({ url: queryURL });
      return;
    }

    // T3 redirects /new during hydration. Open the stable home route for the
    // in-memory handoff used by long prompts.
    openTabWithPendingPrompt(T3_HOME_URL, prompt, provider.id);
    return;
  }

  openTabWithPendingPrompt(provider.homeURL, prompt, provider.id);
}

function openSidechatPanel(tab) {
  if (!chrome.sidePanel || !tab || !Number.isInteger(tab.id)) {
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

function updateSidechatPrompt(prompt, tab, providerId, configuredChatURL = '') {
  const provider = getChatProvider(providerId);
  const chatURL = configuredChatURL ? addPromptQueryParam(configuredChatURL, prompt) : buildPromptQueryURL(prompt, provider.id);

  chrome.storage.session.set({
    sidechatURL: chatURL,
    sidechatProvider: provider.id,
    sidechatError: chrome.sidePanel && tab && Number.isInteger(tab.id) ? '' : 'Chrome side panel is not available for this page.',
    sidechatUpdatedAt: Date.now(),
  });
}

function setSidechatError(message) {
  chrome.storage.session.set({
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

function addPromptQueryParam(rawURL, prompt) {
  const url = new URL(rawURL);
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

function sendPromptMessage(tabId, message, callback = () => {}) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
      callback(false);
      return;
    }

    if (!response || !response.ok) {
      console.error(response && response.error ? response.error : 'Unable to send prompt to the selected provider.');
      callback(false);
      return;
    }

    callback(true);
  });
}

async function openTabWithPendingPrompt(rawURL, prompt, providerId) {
  await clearExpiredPendingPrompts();
  const provider = getChatProvider(providerId);
  const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
  const storageKey = `${PENDING_PROMPT_PREFIX}${tab.id}`;

  await chrome.storage.session.set({
    [storageKey]: {
      prompt,
      providerId: provider.id,
      createdAt: Date.now(),
    },
  });
  await chrome.alarms.create(`${PENDING_PROMPT_EXPIRY_ALARM_PREFIX}${tab.id}`, {
    when: Date.now() + PENDING_PROMPT_MAX_AGE_MS,
  });
  await chrome.tabs.update(tab.id, { url: rawURL });
}

async function getPendingPromptForTab(sender) {
  if (!isValidTopLevelProviderFrame(sender)) {
    return { ok: false };
  }

  const storageKey = `${PENDING_PROMPT_PREFIX}${sender.tab.id}`;
  const stored = await chrome.storage.session.get(storageKey);
  const pending = stored[storageKey];
  if (!pending || Date.now() - pending.createdAt > PENDING_PROMPT_MAX_AGE_MS) {
    await chrome.storage.session.remove(storageKey);
    await chrome.alarms.clear(`${PENDING_PROMPT_EXPIRY_ALARM_PREFIX}${sender.tab.id}`);
    return { ok: false };
  }

  const senderURL = new URL(sender.url);
  const senderHost = senderURL.hostname;
  if (!isProviderHost(senderHost, pending.providerId)) {
    return { ok: false };
  }

  if (
    pending.providerId === 't3' &&
    (senderURL.pathname === '/new' || Date.now() - pending.createdAt < 5000)
  ) {
    return { ok: false, retry: true };
  }

  return {
    ok: true,
    prompt: pending.prompt,
    provider: pending.providerId,
  };
}

async function acknowledgePendingPrompt(sender) {
  if (!isValidTopLevelProviderFrame(sender)) {
    return { ok: false };
  }

  const storageKey = `${PENDING_PROMPT_PREFIX}${sender.tab.id}`;
  await chrome.storage.session.remove(storageKey);
  await chrome.alarms.clear(`${PENDING_PROMPT_EXPIRY_ALARM_PREFIX}${sender.tab.id}`);
  return { ok: true };
}

function isValidTopLevelProviderFrame(sender) {
  if (!sender.tab || !Number.isInteger(sender.tab.id) || sender.frameId !== 0 || !sender.url) {
    return false;
  }

  try {
    const hostname = new URL(sender.url).hostname;
    return hostname === 'chatgpt.com' || hostname === 'chat.openai.com' || hostname === 't3.chat';
  } catch (error) {
    return false;
  }
}

async function clearExpiredPendingPrompts() {
  const stored = await chrome.storage.session.get();
  const now = Date.now();
  const expiredKeys = Object.entries(stored)
    .filter(([key, value]) => (
      key.startsWith(PENDING_PROMPT_PREFIX) &&
      (!value || !value.createdAt || now - value.createdAt > PENDING_PROMPT_MAX_AGE_MS)
    ))
    .map(([key]) => key);

  if (expiredKeys.length) {
    await chrome.storage.session.remove(expiredKeys);
    await Promise.all(expiredKeys.map((key) => (
      chrome.alarms.clear(`${PENDING_PROMPT_EXPIRY_ALARM_PREFIX}${key.slice(PENDING_PROMPT_PREFIX.length)}`)
    )));
  }
}

async function configureAdvancedFrameRules() {
  if (!SUPPORTS_SIDECHAT || !chrome.declarativeNetRequest) {
    return;
  }

  const responseHeaders = [
    { header: 'content-security-policy', operation: 'remove' },
    { header: 'content-security-policy-report-only', operation: 'remove' },
    { header: 'x-frame-options', operation: 'remove' },
  ];
  const providerDomains = ['chatgpt.com', 'chat.openai.com', 't3.chat'];
  const addRules = providerDomains.map((requestDomain, index) => ({
    id: ADVANCED_FRAME_RULE_IDS[index],
    priority: 1,
    action: {
      type: 'modifyHeaders',
      responseHeaders,
    },
    condition: {
      initiatorDomains: [chrome.runtime.id],
      requestDomains: [requestDomain],
      resourceTypes: ['sub_frame'],
    },
  }));

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ADVANCED_FRAME_RULE_IDS,
      addRules,
    });
  } catch (error) {
    console.error('Unable to configure Advanced side-panel frame rules.', error);
  }
}
