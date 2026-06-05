/**
 * onevr-popup.js
 * Handles OneVR login popup and localStorage extraction via Cloudflare Worker
 */

const ONEVR_LOGIN_URL = 'https://launcher.onevr.vrse.cloud/';
const ONEVR_CALLBACK_URL = 'https://vemjobbar-onevr-handler.kenny-eriksson1986.workers.dev/callback';
const ONEVR_POPUP_TIMEOUT = 180000; // 180 seconds (3 minutes) max wait

let onevrPopup = null;
let onevrCallbackTimer = null;

/**
 * Open OneVR login popup with instruction for next step
 */
function openOneVRLoginPopup() {
  console.log('[ONEVR] Opening OneVR login popup...');

  // Close existing popup if any
  if (onevrPopup && !onevrPopup.closed) {
    onevrPopup.close();
  }

  // Open popup with smaller size (360x600) with visible toolbar and address bar
  // User needs to be able to paste bookmarklet code in address bar
  onevrPopup = window.open(
    ONEVR_LOGIN_URL,
    'OneVRLogin',
    'width=360,height=600,top=50,left=50,menubar=yes,toolbar=yes,location=yes'
  );

  if (!onevrPopup) {
    console.error('[ONEVR] Popup blocked! Tillåt popups för denna sida.');
    throw new Error('Popup blockerad. Tillåt popups i webbläsären.');
  }

  // Try to focus popup
  try {
    onevrPopup.focus();
  } catch (e) {
    // Ignore focus errors
  }

  console.log('[ONEVR] Popup opened, waiting for user to login and click "Nästa steg"...');

  // Show floating "Nästa steg" button
  showOneVRNextStepButton();

  // Wait for user to manually navigate popup to callback
  return waitForOneVRCallback();
}

/**
 * Wait for OneVR callback from Worker
 * User must click "Nästa steg" button in popup to navigate to Worker URL
 */
function waitForOneVRCallback() {
  return new Promise((resolve, reject) => {
    // Store resolve/reject for callback handler
    window._onevrPromiseResolve = resolve;
    window._onevrPromiseReject = reject;

    // Timeout after 3 minutes
    onevrCallbackTimer = setTimeout(() => {
      try {
        onevrPopup.close();
      } catch (e) {
        // Ignore
      }

      // Clean up promise handlers
      delete window._onevrPromiseResolve;
      delete window._onevrPromiseReject;

      reject(new Error('Timeout: Du klickade inte "Nästa steg" inom 3 minuter. Försök igen.'));
    }, ONEVR_POPUP_TIMEOUT);

    console.log('[ONEVR] Waiting for callback from Worker...');
  });
}

/**
 * Handle postMessage from localStorage extraction (popup or Worker)
 */
function handleOneVRCallback(event) {
  // Verify message is from our OneVR extraction
  if (event.data && event.data.type === 'ONEVR_LOCALSTORAGE') {
    clearTimeout(onevrCallbackTimer);

    console.log('[ONEVR] Received localStorage from popup');

    // Hide next step button
    hideOneVRNextStepButton();

    // Close popup
    try {
      if (onevrPopup && !onevrPopup.closed) {
        onevrPopup.close();
      }
    } catch (e) {
      // Ignore
    }

    if (event.data.success) {
      console.log('[ONEVR] ✓ Successfully received localStorage with ' + Object.keys(event.data.data).length + ' keys');
      // Resolve with the data
      if (window._onevrPromiseResolve) {
        window._onevrPromiseResolve(event.data.data);
        delete window._onevrPromiseResolve;
        delete window._onevrPromiseReject;
      }
    } else {
      console.error('[ONEVR] Callback error:', event.data.error);
      if (window._onevrPromiseReject) {
        window._onevrPromiseReject(new Error(event.data.error));
        delete window._onevrPromiseResolve;
        delete window._onevrPromiseReject;
      }
    }
  }
}

// Listen for messages from Worker callback
window.addEventListener('message', handleOneVRCallback);

/**
 * Close OneVR popup if it's open
 */
function closeOneVRPopup() {
  if (onevrCallbackTimer) {
    clearTimeout(onevrCallbackTimer);
    onevrCallbackTimer = null;
  }

  if (onevrPopup && !onevrPopup.closed) {
    try {
      onevrPopup.close();
    } catch (e) {
      // Ignore
    }
  }

  // Clean up promise handlers
  delete window._onevrPromiseResolve;
  delete window._onevrPromiseReject;

  onevrPopup = null;
}

/**
 * Check if OneVR popup is still open
 */
function isOneVRPopupOpen() {
  return onevrPopup && !onevrPopup.closed;
}

/**
 * Show floating "Nästa steg" button over popup
 */
function showOneVRNextStepButton() {
  // Remove existing button if any
  const existing = document.getElementById('onevrNextStepBtn');
  if (existing) {
    existing.remove();
  }

  // Create floating button
  const btn = document.createElement('button');
  btn.id = 'onevrNextStepBtn';
  btn.className = 'onevr-next-step-btn';
  btn.innerHTML = '✓ Nästa steg';
  btn.onclick = executeOneVRNextStep;

  document.body.appendChild(btn);
  console.log('[ONEVR] Next step button shown');
}

/**
 * Execute "Nästa steg" - extract localStorage from popup
 */
function executeOneVRNextStep() {
  if (!onevrPopup || onevrPopup.closed) {
    console.error('[ONEVR] Popup is closed!');
    showStatus('loginStatus', '✗ Popup är stängd. Försök igen.', 'error');
    return;
  }

  console.log('[ONEVR] Extracting localStorage from popup...');

  // Navigate popup to JavaScript URL that extracts localStorage
  const extractCode = `
    (function(){
      const storageData = {};
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          storageData[key] = localStorage[key];
        }
      }

      if (Object.keys(storageData).length === 0) {
        window.opener.postMessage({
          type: 'ONEVR_LOCALSTORAGE',
          success: false,
          error: 'Ingen data hittades i localStorage'
        }, '*');
      } else {
        window.opener.postMessage({
          type: 'ONEVR_LOCALSTORAGE',
          success: true,
          data: storageData,
          timestamp: new Date().toISOString()
        }, '*');
      }

      window.close();
    })();
  `;

  try {
    onevrPopup.location = 'javascript:' + extractCode;
    console.log('[ONEVR] JavaScript URL sent to popup');
  } catch (e) {
    console.error('[ONEVR] Error navigating popup:', e);
    showStatus('loginStatus', '✗ Kunde inte navigera popup: ' + e.message, 'error');
  }
}

/**
 * Hide OneVR next step button
 */
function hideOneVRNextStepButton() {
  const btn = document.getElementById('onevrNextStepBtn');
  if (btn) {
    btn.remove();
  }
}

/**
 * Copy bookmarklet code to clipboard
 * Bookmarklet navigates popup back to main app with base64-encoded localStorage data in URL
 */
function copyBookmarkletCode() {
  const bookmarkletCode = `javascript:(function(){const d={};for(let k in localStorage){if(localStorage.hasOwnProperty(k))d[k]=localStorage[k];}const encoded=btoa(JSON.stringify(d));window.location='https://ke86.github.io/vemjobbaridag/?onevr_data='+encoded;})();`;

  navigator.clipboard.writeText(bookmarkletCode).then(() => {
    console.log('[ONEVR] Bookmarklet code copied to clipboard');
    showStatus('bookmarkletStatus', '✓ Bookmarklet-kod kopierad! Spara som bokmärke i din browser.', 'success');
  }).catch(err => {
    console.error('[ONEVR] Error copying to clipboard:', err);
    showStatus('bookmarkletStatus', '✗ Kunde inte kopiera. Försök manuellt eller använd F12-metoden.', 'error');
  });
}

/**
 * Check URL for onevr_data parameter and extract localStorage from it
 * Called when bookmarklet navigates popup back to main app
 */
function processOneVRDataFromURL() {
  const params = new URLSearchParams(window.location.search);
  const encodedData = params.get('onevr_data');

  if (!encodedData) {
    return; // No OneVR data in URL
  }

  try {
    console.log('[ONEVR] Found onevr_data in URL, decoding...');

    // Decode base64
    const jsonString = atob(encodedData);
    const storageData = JSON.parse(jsonString);

    // Check if data is valid
    const keyCount = Object.keys(storageData).length;
    if (keyCount === 0) {
      throw new Error('localStorage var tom');
    }

    console.log('[ONEVR] ✓ Successfully decoded localStorage with ' + keyCount + ' keys');

    // Fill textarea
    const storageInput = document.getElementById('storageDataInput');
    if (storageInput) {
      storageInput.value = jsonString;
      console.log('[ONEVR] ✓ Textarea filled with localStorage data');
    }

    // Show success status
    showStatus('loginStatus', '✓ localStorage hämtad från OneVR! Klicka "Ladda upp" för att spara.', 'success');

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);

  } catch (error) {
    console.error('[ONEVR] Error processing onevr_data:', error);
    showStatus('loginStatus', '✗ Fel vid dekodning av OneVR-data: ' + error.message, 'error');
  }
}

// Process OneVR data from URL when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(processOneVRDataFromURL, 100);
});
