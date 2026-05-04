(() => {
  if (window.__rightClickGPTContentScriptLoaded) {
    return;
  }

  window.__rightClickGPTContentScriptLoaded = true;

  const COMPOSER_SELECTORS = [
    '#prompt-textarea[contenteditable="true"]',
    '[role="textbox"][aria-label="Chat with ChatGPT"]',
    'textarea[aria-label="Chat with ChatGPT"]',
    'textarea',
  ];
  const SEND_BUTTON_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
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
    if (request.action !== 'sendToChatGPT' && request.action !== 'ensureChatGPTPromptSubmitted') {
      return false;
    }

    const task = request.action === 'sendToChatGPT'
      ? sendPromptToChatGPT(request.prompt)
      : ensurePromptSubmitted(request.prompt);

    task
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        const message = error && error.message ? error.message : String(error);
        logToBackground('RightClickGPT failed:', message);
        sendResponse({ ok: false, error: message });
      });

    return true;
  });

  async function sendPromptToChatGPT(prompt) {
    const composer = await waitForElement(findComposer, 'ChatGPT composer');
    await insertPrompt(composer, prompt);

    await submitPrompt(composer);
  }

  async function ensurePromptSubmitted(prompt) {
    if (await waitForPromptInConversation(prompt, 2500)) {
      return;
    }

    const composer = await waitForElement(findComposer, 'ChatGPT composer');
    if (!getComposerText(composer) && !currentURLHasPromptParam()) {
      return;
    }

    if (getComposerText(composer) !== prompt) {
      insertPrompt(composer, prompt);
    }

    await submitPrompt(composer);
  }

  function findComposer() {
    for (const selector of COMPOSER_SELECTORS) {
      const element = document.querySelector(selector);
      if (element && isVisible(element)) {
        return element;
      }
    }

    return null;
  }

  function findEnabledSendButton() {
    for (const selector of SEND_BUTTON_SELECTORS) {
      const button = document.querySelector(selector);
      if (button && isVisible(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
        return button;
      }
    }

    return null;
  }

  function findSendButton() {
    for (const selector of SEND_BUTTON_SELECTORS) {
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

  async function submitPrompt(composer) {
    const beforeSubmitText = getComposerText(composer);
    const sendButton = await waitForElement(findEnabledSendButton, 'enabled ChatGPT send button');

    clickButtonLikeAUser(sendButton);

    if (await waitForPromptToSubmit(composer, beforeSubmitText, 1200)) {
      return;
    }

    requestFormSubmit(sendButton);

    if (await waitForPromptToSubmit(composer, beforeSubmitText, 1200)) {
      return;
    }

    pressEnterToSubmit(composer);

    if (await waitForPromptToSubmit(composer, beforeSubmitText, SUBMIT_TIMEOUT_MS)) {
      return;
    }

    const currentButton = findSendButton();
    if (currentButton && !currentButton.disabled && currentButton.getAttribute('aria-disabled') !== 'true') {
      currentButton.click();
    }

    if (!(await waitForPromptToSubmit(composer, beforeSubmitText, 1500))) {
      throw new Error('Prompt was inserted, but ChatGPT did not submit it.');
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

  function waitForPromptToSubmit(composer, submittedText, timeout) {
    const startedAt = Date.now();

    return new Promise((resolve) => {
      const check = () => {
        const sendButton = findSendButton();
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

  function waitForPromptInConversation(prompt, timeout) {
    const startedAt = Date.now();

    return new Promise((resolve) => {
      const check = () => {
        if (textAppearsOutsideComposer(prompt)) {
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

  function textAppearsOutsideComposer(text) {
    const composer = findComposer();
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
