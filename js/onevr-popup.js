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

  // Open popup
  onevrPopup = window.open(
    ONEVR_LOGIN_URL,
    'OneVRLogin',
    'width=600,height=700,menubar=no,toolbar=no,location=yes'
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
 * Handle postMessage from Worker callback
 */
function handleOneVRCallback(event) {
  // Verify message is from our Worker
  if (event.data && event.data.type === 'ONEVR_LOCALSTORAGE') {
    clearTimeout(onevrCallbackTimer);

    console.log('[ONEVR] Received callback from Worker');

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
