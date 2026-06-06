/**
 * firebase-localStorage-sync.js
 * Saves OneVR localStorage to Firebase Firestore for GitHub Actions scraper
 */

const FIREBASE_PROJECT_ID = 'vemjobbaridag';
const FIRESTORE_API_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const AUTH_WORKER_URL = 'https://onevr-auth.kenny-eriksson1986.workers.dev/auth-token';

let firebaseStorageSyncInitialized = false;

function initFirebaseStorageSync() {
  if (firebaseStorageSyncInitialized) return;

  const saveBtn = document.getElementById('saveToFirebaseBtn');
  if (!saveBtn) {
    console.log('[FIREBASE-SYNC] Save button not found yet, will retry');
    return;
  }

  firebaseStorageSyncInitialized = true;

  // Load last update info
  loadLastFirebaseUpdate();

  // Save to Firebase button
  saveBtn.addEventListener('click', async () => {
    const storageInput = document.getElementById('storageDataInput');
    const data = storageInput ? storageInput.value.trim() : '';

    if (!data) {
      showFirebaseStatus('⚠️ Mata in OneVR localStorage-data först', 'error');
      return;
    }

    saveBtn.disabled = true;
    showFirebaseStatus('⏳ Sparar till Firebase...', 'loading');

    try {
      const result = await saveLocalStorageToFirebase(data);
      showFirebaseStatus('✓ ' + result.message, 'success');
      loadLastFirebaseUpdate();
      console.log('[FIREBASE-SYNC] Save successful');
    } catch (error) {
      showFirebaseStatus('✗ Fel: ' + error.message, 'error');
      console.error('[FIREBASE-SYNC] Save failed:', error);
    } finally {
      saveBtn.disabled = false;
    }
  });

  console.log('[FIREBASE-SYNC] Firebase localStorage sync initialized');
}

/**
 * Save localStorage data to Firebase Firestore
 */
async function saveLocalStorageToFirebase(localStorageJson) {
  try {
    // Validate JSON
    let storageObj;
    try {
      storageObj = JSON.parse(localStorageJson);
    } catch (e) {
      throw new Error('Ogiltig JSON-data');
    }

    // Get auth token from Worker
    console.log('[FIREBASE-SYNC] Getting auth token from Worker...');
    const authResponse = await fetch(AUTH_WORKER_URL);
    if (!authResponse.ok) {
      throw new Error('Kunde inte hämta auth-token från Worker');
    }
    const authData = await authResponse.json();
    const idToken = authData.idToken;

    if (!idToken) {
      throw new Error('Ingen auth-token mottagen från Worker');
    }

    console.log('[FIREBASE-SYNC] Got auth token, saving to Firestore...');

    // Prepare Firestore document
    const firestoreDoc = {
      fields: {
        data: {
          stringValue: localStorageJson
        },
        updatedAt: {
          stringValue: new Date().toISOString()
        }
      }
    };

    // Save to Firestore
    const saveUrl = `${FIRESTORE_API_URL}/config/localStorage?updateMask.fieldPaths=data&updateMask.fieldPaths=updatedAt`;
    const saveResponse = await fetch(saveUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(firestoreDoc)
    });

    if (!saveResponse.ok) {
      const error = await saveResponse.json();
      throw new Error(error.error?.message || `Firestore error: ${saveResponse.status}`);
    }

    const result = await saveResponse.json();
    console.log('[FIREBASE-SYNC] Firestore save successful:', result);

    // Save timestamp locally
    try {
      const user = firebase.auth().currentUser;
      if (user && window.db) {
        await window.db.collection('settings').doc(user.uid).update({
          firebaseLocalStorageSavedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      // Silently fail if Firebase update doesn't work
      console.warn('[FIREBASE-SYNC] Could not save timestamp to Firebase:', e);
    }

    return {
      success: true,
      message: 'Sparat till Firebase! Scraper kan nu läsa uppdaterade tokens.'
    };
  } catch (error) {
    console.error('[FIREBASE-SYNC] Error:', error);
    throw error;
  }
}

/**
 * Load and display last Firebase update time
 */
async function loadLastFirebaseUpdate() {
  try {
    if (!window.db) return;

    const user = firebase.auth().currentUser;
    if (!user) return;

    const doc = await window.db.collection('settings').doc(user.uid).get();
    if (!doc.exists) return;

    const timestamp = doc.data().firebaseLocalStorageSavedAt;
    const el = document.getElementById('lastFirebaseUpdate');

    if (el && timestamp) {
      const age = formatTimestampAge(timestamp);
      const dateStr = new Date(timestamp).toLocaleString('sv-SE');
      el.innerHTML = `<strong>${age}</strong><br><small>${dateStr}</small>`;
    }
  } catch (error) {
    console.error('[FIREBASE-SYNC] Error loading last update:', error);
  }
}

/**
 * Format timestamp for display
 */
function formatTimestampAge(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h sedan`;
  }
  if (diffHours > 0) {
    return `${diffHours}h sedan`;
  }
  return `${diffMins}m sedan`;
}

/**
 * Show Firebase status message
 */
function showFirebaseStatus(message, type) {
  const el = document.getElementById('firebaseStatus');
  if (!el) return;

  el.textContent = message;
  el.className = `settings-status ${type}`;

  // Auto-hide success messages after 4 seconds
  if (type === 'success') {
    setTimeout(() => {
      el.className = 'settings-status';
      el.textContent = '';
    }, 4000);
  }
}

// Initialize when Settings page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initFirebaseStorageSync, 500);
});

// Also try to initialize when settings page becomes visible
document.addEventListener('pagechange', (e) => {
  if (e.detail === 'settings') {
    initFirebaseStorageSync();
  }
});
