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
 * Bookmarklet POSTs localStorage to Worker, gets ID, opens main app with ID in URL
 */
function copyBookmarkletCode() {
  const bookmarkletCode = `javascript:(async function(){const d={};for(let k in localStorage){if(localStorage.hasOwnProperty(k))d[k]=localStorage[k];}try{const r=await fetch('https://vemjobbar-onevr-handler.kenny-eriksson1986.workers.dev/api/store-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const result=await r.json();if(result.success){window.open('https://ke86.github.io/vemjobbaridag/?onevr_id='+result.id);alert('✓ localStorage skickat! Appen öppnas nu...');}else{alert('✗ Fel: '+result.error);}}catch(err){alert('✗ Fel vid sändning: '+err.message);}})();`;

  navigator.clipboard.writeText(bookmarkletCode).then(() => {
    console.log('[ONEVR] Bookmarklet code copied to clipboard');
    showStatus('bookmarkletStatus', '✓ Bookmarklet-kod kopierad! Spara som bokmärke i din browser.', 'success');
  }).catch(err => {
    console.error('[ONEVR] Error copying to clipboard:', err);
    showStatus('bookmarkletStatus', '✗ Kunde inte kopiera. Försök manuellt eller använd F12-metoden.', 'error');
  });
}

/**
 * Check URL for onevr_id parameter and fetch localStorage from Worker
 * Called when bookmarklet opens main app with ID in URL
 */
function processOneVRDataFromURL() {
  const params = new URLSearchParams(window.location.search);
  const dataId = params.get('onevr_id');

  if (!dataId) {
    return; // No OneVR data ID in URL
  }

  console.log('[ONEVR] Found onevr_id in URL, fetching from Worker...');

  // Fetch data from Worker
  fetch('https://vemjobbar-onevr-handler.kenny-eriksson1986.workers.dev/api/get-data?id=' + dataId)
    .then(response => response.json())
    .then(result => {
      if (!result.success) {
        throw new Error(result.error || 'Okänt fel');
      }

      const storageData = result.data;
      const keyCount = Object.keys(storageData).length;

      if (keyCount === 0) {
        throw new Error('localStorage var tom');
      }

      console.log('[ONEVR] ✓ Successfully retrieved localStorage with ' + keyCount + ' keys');

      // Convert to JSON string
      const jsonString = JSON.stringify(storageData);

      // Fill textarea
      const storageInput = document.getElementById('storageDataInput');
      if (storageInput) {
        storageInput.value = jsonString;
        console.log('[ONEVR] ✓ Textarea filled with localStorage data');
      }

      // Show loading status while uploading
      showStatus('loginStatus', '⏳ Laddar upp till GitHub...', 'loading');

      // Automatically upload to GitHub
      console.log('[ONEVR] Auto-uploading to GitHub...');
      uploadLocalStorageToGitHub(jsonString)
        .then(result => {
          console.log('[ONEVR] ✓ Auto-upload successful:', result);
          showStatus('loginStatus', '✓ localStorage hämtad och uppladdat till GitHub!', 'success');

          // Update last upload info
          updateLastUploadInfo();

          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(error => {
          console.error('[ONEVR] Auto-upload failed:', error);
          // Show partial success - data was retrieved but upload failed
          showStatus('loginStatus', '⚠ localStorage hämtad men upload misslyckades: ' + error.message, 'error');

          // Clean URL anyway
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    })
    .catch(error => {
      console.error('[ONEVR] Error fetching onevr_data:', error);
      showStatus('loginStatus', '✗ Fel vid hämtning av OneVR-data: ' + error.message, 'error');
    });
}

// Process OneVR data from URL when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(processOneVRDataFromURL, 100);
});
