/**
 * onevr-popup.js
 * Handles OneVR login popup and localStorage extraction
 */

const ONEVR_LOGIN_URL = 'https://launcher.onevr.vrse.cloud/';
const ONEVR_POPUP_CHECK_INTERVAL = 2000; // 2 seconds
const ONEVR_POPUP_TIMEOUT = 180000; // 180 seconds (3 minutes) max wait

let onevrPopup = null;
let onevrCheckInterval = null;

/**
 * Open OneVR login popup and wait for localStorage
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
    throw new Error('Popup blockerad. Tillåt popups i webbläsaren.');
  }

  // Try to focus popup
  try {
    onevrPopup.focus();
  } catch (e) {
    // Ignore focus errors
  }

  console.log('[ONEVR] Popup opened, listening for localStorage...');

  // Start checking for localStorage in popup
  return waitForOneVRLocalStorage();
}

/**
 * Wait for OneVR popup to have localStorage data
 */
function waitForOneVRLocalStorage() {
  return new Promise((resolve, reject) => {
    let elapsedTime = 0;

    onevrCheckInterval = setInterval(() => {
      elapsedTime += ONEVR_POPUP_CHECK_INTERVAL;

      try {
        // Try to access popup's localStorage
        // This will only work if popup is same-origin (it is: launcher.onevr.vrse.cloud)
        if (onevrPopup && !onevrPopup.closed) {
          // Try to read localStorage from popup
          // We use a try-catch because of potential security restrictions
          try {
            const popupLocalStorage = onevrPopup.localStorage;

            // Debug logging every 30 seconds
            if (elapsedTime % 30000 === 0 && elapsedTime > 0) {
              console.log('[ONEVR] Debug check: popup exists=' + !!onevrPopup + ', localStorage=' + (popupLocalStorage ? 'YES' : 'NO') + ', length=' + (popupLocalStorage ? popupLocalStorage.length : 'N/A'));
            }

            // Check if user appears to be logged in
            // Look for typical OneVR session tokens
            if (popupLocalStorage && popupLocalStorage.length > 0) {
              console.log('[ONEVR] ✓ Found localStorage in popup! Length: ' + popupLocalStorage.length);

              // Extract localStorage as JSON
              const storageData = {};
              const keys = [];
              for (let i = 0; i < popupLocalStorage.length; i++) {
                const key = popupLocalStorage.key(i);
                keys.push(key);
                storageData[key] = popupLocalStorage.getItem(key);
              }

              console.log('[ONEVR] Keys found:', keys.join(', '));

              // Check if it looks like valid OneVR data
              const hasAuthData =
                storageData['auth_token'] ||
                storageData['access_token'] ||
                storageData['session'] ||
                storageData['token'] ||
                Object.keys(storageData).length > 5; // At least some data

              if (hasAuthData || Object.keys(storageData).length > 0) {
                clearInterval(onevrCheckInterval);
                console.log('[ONEVR] ✓ Successfully extracted localStorage with ' + Object.keys(storageData).length + ' keys');

                // Close popup
                try {
                  onevrPopup.close();
                } catch (e) {
                  // Ignore close errors
                }

                resolve(storageData);
                return;
              }
            }
          } catch (e) {
            // Same-origin error or other issue - log it
            if (elapsedTime % 30000 === 0 && elapsedTime > 0) {
              console.log('[ONEVR] Error accessing popup localStorage:', e.message);
            } else if (elapsedTime > 5000 && elapsedTime < 10000) {
              console.log('[ONEVR] Waiting for login... (popup may show login form)');
            }
          }
        } else {
          // Popup closed
          if (elapsedTime < 5000) {
            console.log('[ONEVR] Popup closed before login');
            clearInterval(onevrCheckInterval);
            reject(new Error('Popup stängdes innan login var klar'));
          }
        }

        // Timeout after 180 seconds
        if (elapsedTime > ONEVR_POPUP_TIMEOUT) {
          clearInterval(onevrCheckInterval);
          try {
            onevrPopup.close();
          } catch (e) {
            // Ignore
          }
          reject(new Error('Timeout: Kunde inte läsa localStorage inom 3 minuter. Stängde popup. Försök igen.'));
        }

        // Log progress every 10 seconds
        if (elapsedTime % 10000 === 0 && elapsedTime > 0) {
          console.log('[ONEVR] Waiting... ' + (elapsedTime / 1000) + 's elapsed');
        }
      } catch (error) {
        console.error('[ONEVR] Error checking popup:', error.message);
        // Continue trying
      }
    }, ONEVR_POPUP_CHECK_INTERVAL);
  });
}

/**
 * Close OneVR popup if it's open
 */
function closeOneVRPopup() {
  if (onevrCheckInterval) {
    clearInterval(onevrCheckInterval);
    onevrCheckInterval = null;
  }

  if (onevrPopup && !onevrPopup.closed) {
    try {
      onevrPopup.close();
    } catch (e) {
      // Ignore
    }
  }

  onevrPopup = null;
}

/**
 * Check if OneVR popup is still open
 */
function isOneVRPopupOpen() {
  return onevrPopup && !onevrPopup.closed;
}
