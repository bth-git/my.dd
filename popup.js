document.addEventListener('DOMContentLoaded', function() {
  const targetInput = document.getElementById('targetInput');
  const intensityInput = document.getElementById('intensityInput');
  const proxyInput = document.getElementById('proxyInput');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusText = document.getElementById('statusText');
  const requestCount = document.getElementById('requestCount');
  const workerCount = document.getElementById('workerCount');
  const targetDisplay = document.getElementById('targetDisplay');

  // Load saved config
  chrome.storage.sync.get(['target', 'intensity', 'proxies'], (data) => {
    if (data.target) targetInput.value = data.target;
    if (data.intensity) intensityInput.value = data.intensity;
    if (data.proxies) proxyInput.value = data.proxies;
  });

  // Get current status
  updateStatus();

  // Start button
  startBtn.addEventListener('click', function() {
    const target = targetInput.value.trim();
    if (!target) {
      alert('Please enter a target URL');
      return;
    }

    const intensity = parseInt(intensityInput.value) || 50;
    const proxies = proxyInput.value;

    // Save config
    chrome.storage.sync.set({ target, intensity, proxies });

    // Send message to background
    chrome.runtime.sendMessage({
      action: 'start',
      target: target,
      intensity: intensity,
      proxies: proxies
    }, (response) => {
      if (response && response.status === 'started') {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        statusText.textContent = 'RUNNING';
        statusText.className = 'value running';
        targetDisplay.textContent = target;
        updateStatus();
      }
    });
  });

  // Stop button
  stopBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'stop' }, (response) => {
      if (response && response.status === 'stopped') {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusText.textContent = 'Stopped';
        statusText.className = 'value stopped';
        updateStatus();
      }
    });
  });

  // Update status periodically
  function updateStatus() {
    chrome.runtime.sendMessage({ action: 'status' }, (response) => {
      if (!response) return;
      if (response.running) {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        statusText.textContent = 'RUNNING';
        statusText.className = 'value running';
        targetDisplay.textContent = response.target || 'None';
      } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusText.textContent = 'Stopped';
        statusText.className = 'value stopped';
      }
      requestCount.textContent = response.requests || 0;
      workerCount.textContent = response.workers || 0;
    });
  }

  // Update every 2 seconds
  setInterval(updateStatus, 2000);
});