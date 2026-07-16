(() => {
  if (window.top === window) {
    return;
  }

  const extensionOrigin = new URL(chrome.runtime.getURL('')).origin;
  const approvalHandler = (event) => {
    if (
      event.source !== window.parent ||
      event.origin !== extensionOrigin ||
      !event.data ||
      event.data.type !== 'rightclickgpt:t3-bridge-approved'
    ) {
      return;
    }

    window.removeEventListener('message', approvalHandler);
    chrome.runtime.sendMessage({ action: 'enableT3SidePanelBridge' });
  };

  window.addEventListener('message', approvalHandler);
  window.parent.postMessage({ type: 'rightclickgpt:t3-bridge-request' }, '*');
})();
