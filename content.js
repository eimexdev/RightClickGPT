(() => {
  if (window.__rightClickGPTContentScriptLoaded) {
    return;
  }

  window.__rightClickGPTContentScriptLoaded = true;

  const CHATGPT_COMPOSER_SELECTORS = [
    '#prompt-textarea[contenteditable="true"]',
    '[role="textbox"][aria-label="Chat with ChatGPT"]',
    'textarea[aria-label="Chat with ChatGPT"]',
    'textarea',
  ];
  const CHATGPT_SEND_BUTTON_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
  ];
  const T3_COMPOSER_SELECTORS = [
    '[role="textbox"][aria-label="Message input"]',
    'textarea[aria-label="Message input"]',
    '[contenteditable="true"][aria-label="Message input"]',
  ];
  const T3_SEND_BUTTON_SELECTORS = [
    'button[aria-label="Send message"]',
  ];
  const WAIT_TIMEOUT_MS = 15000;
  const WAIT_INTERVAL_MS = 100;
  const SUBMIT_TIMEOUT_MS = 5000;

  function logToBackground(...args) {
    chrome.runtime.sendMessage({
      action: 'logToBackground',
      data: args,
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const supportedActions = [
      'sendToChatGPT',
      'ensureChatGPTPromptSubmitted',
      'sendToChatProvider',
      'ensureChatProviderPromptSubmitted',
    ];
    if (!supportedActions.includes(request.action)) {
      return false;
    }

    if (typeof request.prompt !== 'string' || !request.prompt.trim()) {
      sendResponse({ ok: false, error: 'The prompt was empty.' });
      return false;
    }

    const provider = request.provider || 'chatgpt';
    const task = request.action === 'sendToChatGPT' || request.action === 'sendToChatProvider'
      ? sendPromptToProvider(request.prompt, provider)
      : ensurePromptSubmitted(request.prompt, provider);

    task
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        const message = error && error.message ? error.message : String(error);
        logToBackground('RightClickGPT failed:', message);
        sendResponse({ ok: false, error: message });
      });

    return true;
  });

  if (window.top === window && isSupportedProviderURL()) {
    setTimeout(() => {
      deliverPendingPromptForTab().catch((error) => {
        const message = error && error.message ? error.message : String(error);
        logToBackground('RightClickGPT pending prompt failed:', message);
      });
    }, 250);
  }

  const framedPrompt = window.top !== window && isSupportedProviderURL() ? getPromptParamFromCurrentURL() : '';
  if (framedPrompt) {
    ensurePromptSubmitted(framedPrompt, getCurrentProviderId()).catch((error) => {
      const message = error && error.message ? error.message : String(error);
      logToBackground('RightClickGPT sidechat failed:', message);
    });
  }

  async function sendPromptToProvider(prompt, provider) {
    const composer = await waitForElement(() => findComposer(provider), `${getProviderLabel(provider)} composer`);
    await insertPrompt(composer, prompt);

    await submitPrompt(composer, provider);
  }

  async function deliverPendingPromptForTab() {
    const response = await chrome.runtime.sendMessage({
      action: 'consumePendingPrompt',
    });
    if (!response || !response.ok) {
      if (response && response.retry) {
        setTimeout(() => {
          deliverPendingPromptForTab().catch((error) => {
            const message = error && error.message ? error.message : String(error);
            logToBackground('RightClickGPT pending prompt retry failed:', message);
          });
        }, 500);
      }
      return;
    }

    if (typeof response.prompt !== 'string') {
      throw new Error('The pending prompt was invalid.');
    }

    await sendPromptToProvider(response.prompt, response.provider);
    await chrome.runtime.sendMessage({ action: 'acknowledgePendingPrompt' });
  }

  async function ensurePromptSubmitted(prompt, provider) {
    if (await waitForPromptInConversation(prompt, 2500, provider)) {
      return;
    }

    const composer = await waitForElement(() => findComposer(provider), `${getProviderLabel(provider)} composer`);
    if (!getComposerText(composer) && !currentURLHasPromptParam()) {
      return;
    }

    if (getComposerText(composer) !== prompt) {
      insertPrompt(composer, prompt);
    }

    await submitPrompt(composer, provider);
  }

  function findComposer(provider) {
    for (const selector of getComposerSelectors(provider)) {
      const element = document.querySelector(selector);
      if (element && isVisible(element)) {
        return element;
      }
    }

    return null;
  }

  function findEnabledSendButton(provider) {
    for (const selector of getSendButtonSelectors(provider)) {
      const button = document.querySelector(selector);
      if (button && isVisible(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
        return button;
      }
    }

    return null;
  }

  function findSendButton(provider) {
    for (const selector of getSendButtonSelectors(provider)) {
      const button = document.querySelector(selector);
      if (button && isVisible(button)) {
        return button;
      }
    }

    return null;
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function waitForElement(getElement, label) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        const element = getElement();
        if (element) {
          resolve(element);
          return;
        }

        if (Date.now() - startedAt >= WAIT_TIMEOUT_MS) {
          reject(new Error(`Timed out waiting for ${label}.`));
          return;
        }

        setTimeout(check, WAIT_INTERVAL_MS);
      };

      check();
    });
  }

  async function submitPrompt(composer, provider) {
    const beforeSubmitText = getComposerText(composer);

    if (provider === 't3') {
      pressEnterToSubmit(composer);

      if (await waitForPromptToSubmit(composer, beforeSubmitText, 1200, provider)) {
        return;
      }
    }

    const sendButton = await waitForElement(() => findEnabledSendButton(provider), `enabled ${getProviderLabel(provider)} send button`);

    clickButtonLikeAUser(sendButton);

    if (await waitForPromptToSubmit(composer, beforeSubmitText, 1200, provider)) {
      return;
    }

    requestFormSubmit(sendButton);

    if (await waitForPromptToSubmit(composer, beforeSubmitText, 1200, provider)) {
      return;
    }

    pressEnterToSubmit(composer);

    if (await waitForPromptToSubmit(composer, beforeSubmitText, SUBMIT_TIMEOUT_MS, provider)) {
      return;
    }

    const currentButton = findSendButton(provider);
    if (currentButton && !currentButton.disabled && currentButton.getAttribute('aria-disabled') !== 'true') {
      currentButton.click();
    }

    if (!(await waitForPromptToSubmit(composer, beforeSubmitText, 1500, provider))) {
      throw new Error(`Prompt was inserted, but ${getProviderLabel(provider)} did not submit it.`);
    }
  }

  function insertPrompt(composer, prompt) {
    composer.focus();

    if (composer.isContentEditable) {
      insertIntoContentEditable(composer, prompt);
      return;
    }

    insertIntoTextField(composer, prompt);
  }

  function insertIntoContentEditable(element, text) {
    selectExistingComposerText(element);

    if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
      document.execCommand('insertText', false, text);
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      return;
    }

    element.textContent = text;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }

  function insertIntoTextField(element, text) {
    element.focus();
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickButtonLikeAUser(button) {
    button.scrollIntoView({ block: 'center', inline: 'center' });
    button.focus();

    for (const type of ['pointerdown', 'pointerup']) {
      const EventClass = window.PointerEvent || MouseEvent;
      button.dispatchEvent(new EventClass(type, { bubbles: true, cancelable: true, view: window }));
    }

    for (const type of ['mousedown', 'mouseup', 'click']) {
      button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  }

  function requestFormSubmit(button) {
    const form = button.closest('form');
    if (!form) {
      return;
    }

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit(button);
      return;
    }

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function pressEnterToSubmit(composer) {
    composer.focus();
    for (const type of ['keydown', 'keypress', 'keyup']) {
      composer.dispatchEvent(new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        which: 13,
        keyCode: 13,
      }));
    }
  }

  function waitForPromptToSubmit(composer, submittedText, timeout, provider) {
    const startedAt = Date.now();

    return new Promise((resolve) => {
      const check = () => {
        const sendButton = findSendButton(provider);
        const currentText = getComposerText(composer);
        const submitButtonChanged = sendButton && sendButton.getAttribute('aria-label') !== 'Send prompt';

        if (!currentText || currentText !== submittedText || submitButtonChanged) {
          resolve(true);
          return;
        }

        if (Date.now() - startedAt >= timeout) {
          resolve(false);
          return;
        }

        setTimeout(check, WAIT_INTERVAL_MS);
      };

      check();
    });
  }

  function waitForPromptInConversation(prompt, timeout, provider) {
    const startedAt = Date.now();

    return new Promise((resolve) => {
      const check = () => {
        if (textAppearsOutsideComposer(prompt, provider)) {
          resolve(true);
          return;
        }

        if (Date.now() - startedAt >= timeout) {
          resolve(false);
          return;
        }

        setTimeout(check, WAIT_INTERVAL_MS);
      };

      check();
    });
  }

  function textAppearsOutsideComposer(text, provider) {
    const composer = findComposer(provider);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (composer && composer.contains(node.parentElement)) {
        continue;
      }

      if (node.textContent && node.textContent.includes(text)) {
        return true;
      }
    }

    return false;
  }

  function currentURLHasPromptParam() {
    try {
      return new URL(window.location.href).searchParams.has('q');
    } catch (error) {
      return false;
    }
  }

  function getPromptParamFromCurrentURL() {
    try {
      return new URL(window.location.href).searchParams.get('q') || '';
    } catch (error) {
      return '';
    }
  }

  function getCurrentProviderId() {
    try {
      const hostname = new URL(window.location.href).hostname;
      if (hostname === 't3.chat') {
        return 't3';
      }

      return 'chatgpt';
    } catch (error) {
      return 'chatgpt';
    }
  }

  function isSupportedProviderURL() {
    try {
      const hostname = new URL(window.location.href).hostname;
      return hostname === 'chatgpt.com' || hostname === 'chat.openai.com' || hostname === 't3.chat';
    } catch (error) {
      return false;
    }
  }

  function getComposerSelectors(provider) {
    return provider === 't3' ? T3_COMPOSER_SELECTORS : CHATGPT_COMPOSER_SELECTORS;
  }

  function getSendButtonSelectors(provider) {
    return provider === 't3' ? T3_SEND_BUTTON_SELECTORS : CHATGPT_SEND_BUTTON_SELECTORS;
  }

  function getProviderLabel(provider) {
    return provider === 't3' ? 't3.chat' : 'ChatGPT';
  }

  function getComposerText(element) {
    if (!element) {
      return '';
    }

    return (element.isContentEditable ? element.innerText : element.value || '').trim();
  }

  function selectExistingComposerText(element) {
    const selection = window.getSelection();
    const range = document.createRange();

    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }
})();
