/**
 * ui-github-token.js
 * UI logic for GitHub token manager
 */

let ghTokenManagerInitialized = false;

function initGitHubTokenUI() {
  if (ghTokenManagerInitialized) return;
  ghTokenManagerInitialized = true;

  const loginBtn = document.getElementById('openOneVRLoginBtn');
  const uploadBtn = document.getElementById('uploadStorageBtn');
  const storageInput = document.getElementById('storageDataInput');

  if (!uploadBtn || !loginBtn) {
    console.log('[UI-GTM] GitHub token UI elements not found');
    return;
  }

  // Update last upload info on init
  updateLastUploadInfo();

  // Open OneVR login popup
  loginBtn.addEventListener('click', async () => {
    loginBtn.disabled = true;
    showStatus('loginStatus', 'Öppnar OneVR...', 'loading');

    try {
      console.log('[UI-GTM] Opening OneVR login popup...');
      const localStorageData = await openOneVRLoginPopup();

      // Convert to JSON string
      const jsonString = JSON.stringify(localStorageData);
      storageInput.value = jsonString;

      showStatus('loginStatus', '✓ localStorage hämtad! Klicka "Ladda upp" för att spara.', 'success');
      console.log('[UI-GTM] localStorage extracted from OneVR popup');
    } catch (error) {
      showStatus('loginStatus', '✗ Fel: ' + error.message, 'error');
      console.error('[UI-GTM] Error opening OneVR popup:', error);
    } finally {
      loginBtn.disabled = false;
    }
  });

  // Upload localStorage to GitHub
  uploadBtn.addEventListener('click', async () => {
    const data = storageInput.value.trim();
    if (!data) {
      showStatus('uploadStatus', 'Logga in på OneVR först eller klistra in localStorage-data', 'error');
      return;
    }

    uploadBtn.disabled = true;
    showStatus('uploadStatus', 'Laddar upp...', 'loading');

    try {
      const result = await uploadLocalStorageToGitHub(data);
      showStatus('uploadStatus', '✓ ' + result.message, 'success');
      storageInput.value = '';

      // Update last upload info
      await updateLastUploadInfo();

      console.log('[UI-GTM] Upload successful:', result);
    } catch (error) {
      showStatus('uploadStatus', '✗ Fel: ' + error.message, 'error');
      console.error('[UI-GTM] Error uploading:', error);
    } finally {
      uploadBtn.disabled = false;
    }
  });

  console.log('[UI-GTM] GitHub token UI initialized');
}

/**
 * Show status message
 */
function showStatus(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.textContent = message;
  el.className = `settings-status ${type}`;

  // Auto-hide success messages after 4 seconds
  if (type === 'success') {
    setTimeout(() => {
      el.className = 'settings-status';
    }, 4000);
  }
}

/**
 * Update last upload info
 */
async function updateLastUploadInfo() {
  try {
    const timestamp = await getLastUploadTimestamp();
    const infoEl = document.getElementById('lastUploadTime');

    if (infoEl) {
      if (timestamp) {
        const age = formatTokenAge(timestamp);
        const dateStr = new Date(timestamp).toLocaleString('sv-SE');
        infoEl.innerHTML = `<strong>${age}</strong><br><small>${dateStr}</small>`;
      } else {
        infoEl.textContent = 'Aldrig uppladdad';
      }
    }
  } catch (error) {
    console.error('[UI-GTM] Error updating last upload info:', error);
  }
}

// Initialize when Settings page loads
document.addEventListener('DOMContentLoaded', () => {
  // Initialize after a short delay to ensure Firebase is ready
  setTimeout(initGitHubTokenUI, 500);

  // Set up OneVR subsection collapsing
  setupOneVRCollapsible();
});

// Also try to initialize when settings page becomes visible
document.addEventListener('pagechange', (e) => {
  if (e.detail === 'settings') {
    initGitHubTokenUI();
  }
});

/**
 * Setup collapsible for OneVR subsection
 */
function setupOneVRCollapsible() {
  const header = document.getElementById('onevrSubHeader');
  const content = document.getElementById('onevrSubsection');

  if (!header || !content) return;

  header.addEventListener('click', () => {
    content.classList.toggle('expanded');
  });

  console.log('[UI-GTM] OneVR collapsible setup complete');
}
