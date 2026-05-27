const DEFAULT_PROMPT_PRESET = {
  id: 'default',
  name: 'Explain command',
  promptFormat: 'Explain <prompt>',
  sidechat: false,
};
const DEFAULT_CHAT_PROVIDER = 'chatgpt';
const CHAT_PROVIDERS = {
  chatgpt: {
    chatTargetPlaceholder: 'https://chatgpt.com/c/...',
    existingTabLabel: 'Use existing ChatGPT tab',
  },
  t3: {
    chatTargetPlaceholder: 'https://t3.chat/chat/...',
    existingTabLabel: 'Use existing t3.chat tab',
  },
};

document.addEventListener('DOMContentLoaded', () => {
  const presetList = document.getElementById('presetList');
  const addPresetButton = document.getElementById('addPreset');
  const chatProvider = document.getElementById('chatProvider');
  const chatID = document.getElementById('chatID');
  const saveButton = document.getElementById('save');
  const currentPromptFormat = document.getElementById('currentPromptFormat');
  const currentChatID = document.getElementById('currentChatID');
  const focusExistingTab = document.getElementById('focusExistingTab');
  const focusExistingTabLabel = document.getElementById('focusExistingTabLabel');

  chrome.storage.local.get(['promptPresets', 'promptFormat', 'chatID', 'chatURL', 'chatProvider', 'focusExistingTab'], (data) => {
    renderPresets(getPromptPresets(data));
    updateCurrentPromptSummary();
    chatProvider.value = getChatProviderId(data.chatProvider);
    updateProviderUI();

    const savedChatTarget = data.chatURL || data.chatID || '';
    if (savedChatTarget) {
      chatID.value = savedChatTarget;
      currentChatID.innerText = savedChatTarget;
    }

    if (data.focusExistingTab !== undefined) {
      focusExistingTab.checked = data.focusExistingTab;
    } else {
      focusExistingTab.checked = false;
    }
  });

  chatProvider.addEventListener('change', updateProviderUI);

  addPresetButton.addEventListener('click', () => {
    addPreset({
      id: createPresetId(),
      name: '',
      promptFormat: 'Explain <prompt>',
      sidechat: false,
    });
  });

  saveButton.addEventListener('click', () => {
    const promptPresets = readPresets();
    const invalidPreset = promptPresets.find((preset) => !preset.name || !preset.promptFormat.includes('<prompt>'));

    if (invalidPreset) {
      alert('Each preset needs a name and a prompt format that includes <prompt>.');
      return;
    }

    if (!promptPresets.length) {
      alert('Add at least one preset.');
      return;
    }

    chrome.storage.local.set(
      {
        promptPresets,
        promptFormat: promptPresets[0].promptFormat,
        chatProvider: getChatProviderId(chatProvider.value),
        chatID: chatID.value.trim(),
        chatURL: normalizeChatTarget(chatID.value, chatProvider.value),
        focusExistingTab: focusExistingTab.checked
      },
      () => {
        updateCurrentPromptSummary();
        currentChatID.innerText = chatID.value.trim();
        alert('Settings saved');
      }
    );
  });

  function renderPresets(presets) {
    presetList.innerHTML = '';
    presets.forEach(addPreset);
  }

  function addPreset(preset) {
    const row = document.createElement('div');
    row.className = 'preset';
    row.dataset.id = preset.id || createPresetId();

    const header = document.createElement('div');
    header.className = 'preset-header';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'preset-name';
    nameInput.placeholder = 'Preset name';
    nameInput.value = preset.name || '';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'secondary remove-preset';
    removeButton.innerText = 'Remove';
    removeButton.addEventListener('click', () => {
      row.remove();
      updateRemoveButtons();
      updateCurrentPromptSummary();
    });

    header.append(nameInput, removeButton);

    const formatInput = document.createElement('textarea');
    formatInput.className = 'preset-format';
    formatInput.placeholder = 'Explain <prompt>';
    formatInput.value = preset.promptFormat || '';

    const sidechatRow = document.createElement('div');
    sidechatRow.className = 'toggle-row preset-toggle-row';

    const sidechatLabel = document.createElement('label');
    sidechatLabel.innerText = 'Sidechat';

    const sidechatInput = document.createElement('input');
    sidechatInput.type = 'checkbox';
    sidechatInput.className = 'preset-sidechat';
    sidechatInput.checked = Boolean(preset.sidechat);

    sidechatRow.append(sidechatLabel, sidechatInput);
    row.append(header, formatInput, sidechatRow);
    presetList.append(row);

    nameInput.addEventListener('input', updateCurrentPromptSummary);
    formatInput.addEventListener('input', updateCurrentPromptSummary);
    updateRemoveButtons();
  }

  function readPresets() {
    return Array.from(presetList.querySelectorAll('.preset')).map((row, index) => ({
      id: row.dataset.id || `preset-${index}`,
      name: row.querySelector('.preset-name').value.trim(),
      promptFormat: row.querySelector('.preset-format').value.trim(),
      sidechat: row.querySelector('.preset-sidechat').checked,
    }));
  }

  function updateRemoveButtons() {
    const removeButtons = presetList.querySelectorAll('.remove-preset');
    removeButtons.forEach((button) => {
      button.disabled = removeButtons.length <= 1;
    });
  }

  function updateCurrentPromptSummary() {
    const presets = readPresets().filter((preset) => preset.name || preset.promptFormat);
    currentPromptFormat.innerText = presets
      .map((preset) => `${preset.name || 'Untitled'}: ${preset.promptFormat || 'No prompt format'}`)
      .join(' | ');
  }

  function updateProviderUI() {
    const provider = getChatProvider(chatProvider.value);
    chatID.placeholder = provider.chatTargetPlaceholder;
    focusExistingTabLabel.innerText = provider.existingTabLabel;
  }
});

function getPromptPresets(data) {
  if (Array.isArray(data.promptPresets) && data.promptPresets.length) {
    return data.promptPresets.map((preset, index) => ({
      id: String(preset.id || `preset-${index}`),
      name: String(preset.name || '').trim(),
      promptFormat: String(preset.promptFormat || ''),
      sidechat: Boolean(preset.sidechat),
    }));
  }

  return [{
    ...DEFAULT_PROMPT_PRESET,
    promptFormat: data.promptFormat || DEFAULT_PROMPT_PRESET.promptFormat,
  }];
}

function createPresetId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getChatProviderId(providerId) {
  return CHAT_PROVIDERS[providerId] ? providerId : DEFAULT_CHAT_PROVIDER;
}

function getChatProvider(providerId) {
  return CHAT_PROVIDERS[getChatProviderId(providerId)];
}

function normalizeChatTarget(rawValue, providerId) {
  const value = rawValue.trim();
  if (!value) {
    return '';
  }

  const provider = getChatProviderId(providerId);

  try {
    const url = new URL(value);
    if (
      (provider === 't3' && url.hostname === 't3.chat') ||
      (provider === 'chatgpt' && (url.hostname === 'chatgpt.com' || url.hostname === 'chat.openai.com'))
    ) {
      return url.toString();
    }
  } catch (error) {
    // Bare legacy chat IDs are normalized by the background script.
  }

  return value;
}
