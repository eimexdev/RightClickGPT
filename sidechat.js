const chatFrame = document.getElementById('chatFrame');
const emptyState = document.getElementById('empty');
const openTab = document.getElementById('openTab');
const reloadFrame = document.getElementById('reloadFrame');
const status = document.getElementById('status');

loadSidechat();

window.addEventListener('message', (event) => {
  if (
    event.source !== chatFrame.contentWindow ||
    event.origin !== 'https://t3.chat' ||
    !event.data ||
    event.data.type !== 'rightclickgpt:t3-bridge-request'
  ) {
    return;
  }

  event.source.postMessage({ type: 'rightclickgpt:t3-bridge-approved' }, event.origin);
});

reloadFrame.addEventListener('click', () => {
  try {
    chatFrame.contentWindow.location.reload();
  } catch (error) {
    status.innerText = 'Sidechat could not reload the embedded page.';
    status.classList.remove('hidden');
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'session' && (changes.sidechatURL || changes.sidechatError || changes.sidechatUpdatedAt)) {
    loadSidechat();
  }
});

function loadSidechat() {
  chrome.storage.session.get(['sidechatURL', 'sidechatError'], (data) => {
    const sidechatURL = data.sidechatURL || '';
    const sidechatError = data.sidechatError || '';

    if (!sidechatURL) {
      chatFrame.classList.add('hidden');
      emptyState.classList.remove('hidden');
      emptyState.innerText = 'Use a Sidechat preset from the right-click menu.';
      status.classList.add('hidden');
      openTab.href = 'https://chatgpt.com/';
      return;
    }

    openTab.href = sidechatURL;
    if (sidechatError) {
      status.innerText = `Sidechat could not open automatically: ${sidechatError}`;
      status.classList.remove('hidden');
    } else {
      status.classList.add('hidden');
    }

    chatFrame.src = sidechatURL;
    emptyState.classList.add('hidden');
    chatFrame.classList.remove('hidden');
  });
}
