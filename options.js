const DEFAULT_PROMPT_PRESET = {
  id: 'default',
  name: 'Explain command',
  promptFormat: 'Explain <prompt>',
  behavior: 'default',
};
const DEFAULT_CHAT_PROVIDER = 'chatgpt';
const DEFAULT_PROMPT_BEHAVIOR = 'newTab';
const PROMPT_BEHAVIORS = ['default', 'newTab', 'sidechat'];
const GLOBAL_PROMPT_BEHAVIORS = ['newTab', 'sidechat'];
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
  const defaultPromptBehavior = document.getElementById('defaultPromptBehavior');
  const saveButton = document.getElementById('save');
  const currentPromptFormat = document.getElementById('currentPromptFormat');
  const currentChatID = document.getElementById('currentChatID');
  const focusExistingTab = document.getElementById('focusExistingTab');
  const focusExistingTabLabel = document.getElementById('focusExistingTabLabel');
  let saveTimeout;
  let isLoadingSettings = true;

  chrome.storage.local.get(['promptPresets', 'promptFormat', 'chatID', 'chatURL', 'chatProvider', 'focusExistingTab', 'defaultPromptBehavior'], (data) => {
    renderPresets(getPromptPresets(data));
    updateCurrentPromptSummary();
    chatProvider.value = getChatProviderId(data.chatProvider);
    defaultPromptBehavior.value = getGlobalPromptBehavior(data.defaultPromptBehavior);
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

    isLoadingSettings = false;
  });

  chatProvider.addEventListener('change', () => {
    updateProviderUI();
    scheduleSaveSettings();
  });
  defaultPromptBehavior.addEventListener('change', scheduleSaveSettings);
  chatID.addEventListener('input', scheduleSaveSettings);
  focusExistingTab.addEventListener('change', scheduleSaveSettings);

  if (saveButton) {
    saveButton.hidden = true;
  }

  addPresetButton.addEventListener('click', () => {
    addPreset({
      id: createPresetId(),
      name: '',
      promptFormat: 'Explain <prompt>',
      behavior: 'default',
      enabled: false,
    }, { expanded: true });
    scheduleSaveSettings();
  });

  function scheduleSaveSettings() {
    if (isLoadingSettings) {
      return;
    }

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveSettings, 300);
  }

  function saveSettings() {
    const promptPresets = readPresets();
    const storablePresets = promptPresets.filter((preset) => !preset.enabled || isUsablePreset(preset));
    const enabledPresets = storablePresets.filter((preset) => preset.enabled);

    if (!storablePresets.length) {
      return;
    }

    chrome.storage.local.set(
      {
        promptPresets: storablePresets,
        promptFormat: (enabledPresets[0] || storablePresets[0]).promptFormat,
        chatProvider: getChatProviderId(chatProvider.value),
        defaultPromptBehavior: getGlobalPromptBehavior(defaultPromptBehavior.value),
        chatID: chatID.value.trim(),
        chatURL: normalizeChatTarget(chatID.value, chatProvider.value),
        focusExistingTab: focusExistingTab.checked
      },
      () => {
        updateCurrentPromptSummary();
        currentChatID.innerText = chatID.value.trim();
      }
    );
  }

  function renderPresets(presets) {
    presetList.innerHTML = '';
    presets.forEach((preset) => addPreset(preset, { expanded: false }));
  }

  function addPreset(preset, options = {}) {
    const row = document.createElement('div');
    row.className = 'preset';
    row.dataset.id = preset.id || createPresetId();
    row.setAttribute('aria-expanded', options.expanded ? 'true' : 'false');

    const header = document.createElement('div');
    header.className = 'preset-header';

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'preset-chevron';
    toggleButton.setAttribute('aria-label', options.expanded ? 'Collapse preset' : 'Expand preset');
    toggleButton.setAttribute('aria-expanded', options.expanded ? 'true' : 'false');

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'preset-name';
    nameInput.placeholder = 'Preset name';
    nameInput.value = preset.name || '';

    const presetSummary = document.createElement('span');
    presetSummary.className = 'preset-summary';

    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'preset-enabled-label';
    enabledLabel.setAttribute('aria-label', 'Enable preset');

    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.className = 'preset-enabled';
    enabledInput.checked = preset.enabled !== false;
    enabledLabel.append(enabledInput);

    header.append(toggleButton, nameInput, presetSummary, enabledLabel);

    const formatInput = document.createElement('textarea');
    formatInput.className = 'preset-format';
    formatInput.placeholder = 'Explain <prompt>';
    formatInput.value = preset.promptFormat || '';

    const behaviorRow = document.createElement('div');
    behaviorRow.className = 'field preset-toggle-row';

    const behaviorLabel = document.createElement('label');
    behaviorLabel.innerText = 'Behavior';

    const behaviorInput = document.createElement('select');
    behaviorInput.className = 'preset-behavior';
    [
      ['default', 'Default'],
      ['newTab', 'New tab'],
      ['sidechat', 'Sidechat'],
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.innerText = label;
      behaviorInput.append(option);
    });
    behaviorInput.value = getPresetBehavior(preset);

    behaviorRow.append(behaviorLabel, behaviorInput);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-preset';
    removeButton.setAttribute('aria-label', 'Delete preset');
    removeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    removeButton.addEventListener('click', () => {
      if (!confirm('Delete this preset?')) {
        return;
      }

      row.remove();
      updateRemoveButtons();
      updateCurrentPromptSummary();
      scheduleSaveSettings();
    });

    const details = document.createElement('div');
    details.className = 'preset-details';
    details.id = `preset-details-${row.dataset.id}`;
    toggleButton.setAttribute('aria-controls', details.id);
    details.append(formatInput, behaviorRow, removeButton);

    row.append(header, details);
    presetList.append(row);

    function setExpanded(isExpanded) {
      row.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      toggleButton.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      toggleButton.setAttribute('aria-label', isExpanded ? 'Collapse preset' : 'Expand preset');
    }

    function updatePresetSummary() {
      const option = behaviorInput.options[behaviorInput.selectedIndex];
      presetSummary.innerText = behaviorInput.value === 'default' ? '' : option.innerText;
    }

    function updatePresetEnabledState() {
      row.classList.toggle('preset-disabled', !enabledInput.checked);
    }

    toggleButton.addEventListener('click', () => {
      setExpanded(row.getAttribute('aria-expanded') !== 'true');
    });

    nameInput.addEventListener('input', () => {
      updateCurrentPromptSummary();
      scheduleSaveSettings();
    });
    formatInput.addEventListener('input', () => {
      updateCurrentPromptSummary();
      scheduleSaveSettings();
    });
    behaviorInput.addEventListener('change', () => {
      updatePresetSummary();
      scheduleSaveSettings();
    });
    enabledInput.addEventListener('change', () => {
      updatePresetEnabledState();
      updateCurrentPromptSummary();
      scheduleSaveSettings();
    });
    updatePresetSummary();
    updatePresetEnabledState();
    updateRemoveButtons();
  }

  function readPresets() {
    return Array.from(presetList.querySelectorAll('.preset')).map((row, index) => ({
      id: row.dataset.id || `preset-${index}`,
      name: row.querySelector('.preset-name').value.trim(),
      promptFormat: row.querySelector('.preset-format').value.trim(),
      behavior: getPresetBehavior({ behavior: row.querySelector('.preset-behavior').value }),
      enabled: row.querySelector('.preset-enabled').checked,
    }));
  }

  function isUsablePreset(preset) {
    return Boolean(preset.name && preset.promptFormat.includes('<prompt>'));
  }

  function updateRemoveButtons() {
    const removeButtons = presetList.querySelectorAll('.remove-preset');
    removeButtons.forEach((button) => {
      button.disabled = removeButtons.length <= 1;
    });
  }

  function updateCurrentPromptSummary() {
    const presets = readPresets().filter((preset) => preset.enabled && (preset.name || preset.promptFormat));
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
      behavior: getPresetBehavior(preset),
      enabled: preset.enabled !== false,
    }));
  }

  return [{
    ...DEFAULT_PROMPT_PRESET,
    promptFormat: data.promptFormat || DEFAULT_PROMPT_PRESET.promptFormat,
    enabled: true,
  }];
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
