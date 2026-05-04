document.addEventListener('DOMContentLoaded', () => {
  const promptFormat = document.getElementById('promptFormat');
  const chatID = document.getElementById('chatID');
  const saveButton = document.getElementById('save');
  const currentPromptFormat = document.getElementById('currentPromptFormat');
  const currentChatID = document.getElementById('currentChatID');
  const focusExistingTab = document.getElementById('focusExistingTab');

  // Load saved values
  chrome.storage.local.get(['promptFormat', 'chatID', 'chatURL', 'focusExistingTab'], (data) => {
    if (data.promptFormat) {
      promptFormat.value = data.promptFormat;
      currentPromptFormat.innerText = data.promptFormat;
    } else {
      const defaultPromptFormat = 'Explain <prompt>';  // Default value
      promptFormat.value = defaultPromptFormat;
      currentPromptFormat.innerText = defaultPromptFormat;
    }

    const savedChatTarget = data.chatURL || data.chatID || '';
    if (savedChatTarget) {
      chatID.value = savedChatTarget;
      currentChatID.innerText = savedChatTarget;
    }

    if (data.focusExistingTab !== undefined) {
      focusExistingTab.checked = data.focusExistingTab;
    } else {
      focusExistingTab.checked = false;  // Default value
    }
  });

  // Save the user's choice
  saveButton.addEventListener('click', () => {
    if (!promptFormat.value.includes('<prompt>')) {
      alert('Please include <prompt> in your custom format.');
      return;
    }
    chrome.storage.local.set(
      {
        promptFormat: promptFormat.value,
        chatID: chatID.value.trim(),
        chatURL: normalizeChatTarget(chatID.value),
        focusExistingTab: focusExistingTab.checked
      },
      () => {
        currentPromptFormat.innerText = promptFormat.value;
        currentChatID.innerText = chatID.value.trim();
        alert('Settings saved');
      }
    );
  });
});

function normalizeChatTarget(rawValue) {
  const value = rawValue.trim();
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    if (url.hostname === 'chatgpt.com' || url.hostname === 'chat.openai.com') {
      return url.toString();
    }
  } catch (error) {
    // Bare legacy chat IDs are normalized by the background script.
  }

  return value;
}
