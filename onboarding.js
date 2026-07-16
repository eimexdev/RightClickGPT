const CONSENT_VERSION = 1;
const consent = document.getElementById('consent');
const enable = document.getElementById('enable');
const clearData = document.getElementById('clearData');
const status = document.getElementById('status');
const manifest = chrome.runtime.getManifest();

document.body.dataset.advanced = String(Boolean(manifest.side_panel));

chrome.storage.local.get(['dataConsentVersion'], (data) => {
  if (data.dataConsentVersion === CONSENT_VERSION) {
    consent.checked = true;
    enable.disabled = false;
    enable.innerText = 'Enabled';
    status.innerText = 'Privacy choice saved on this device.';
  }
});

consent.addEventListener('change', () => {
  enable.disabled = !consent.checked;
});

enable.addEventListener('click', () => {
  if (!consent.checked) {
    return;
  }

  chrome.storage.local.set({ dataConsentVersion: CONSENT_VERSION }, () => {
    enable.innerText = 'Enabled';
    status.innerText = 'RightClickGPT is ready. You can close this tab.';
  });
});

clearData.addEventListener('click', () => {
  if (!confirm('Clear all RightClickGPT presets, preferences, side-panel data, and consent from this device?')) {
    return;
  }

  chrome.storage.local.clear(() => {
    chrome.storage.session.clear(() => {
      consent.checked = false;
      enable.disabled = true;
      enable.innerText = 'Agree and enable';
      status.innerText = 'Local extension data cleared. RightClickGPT is disabled until you agree again.';
    });
  });
});
