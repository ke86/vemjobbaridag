/**
 * ui-github-token.js
 * UI logic for OneVR login, bookmarklet and collapsible subsection
 */

let ghTokenManagerInitialized = false;

function initGitHubTokenUI() {
  if (ghTokenManagerInitialized) return;
  ghTokenManagerInitialized = true;

  const loginBtn = document.getElementById('openOneVRLoginBtn');
  const storageInput = document.getElementById('storageDataInput');
  const bookmarkletBtn = document.getElementById('copyBookmarkletBtn');

  if (!loginBtn) {
    console.log('[UI-GTM] OneVR UI elements not found');
    return;
  }

  // Copy bookmarklet code to clipboard
  if (bookmarkletBtn) {
    bookmarkletBtn.addEventListener('click', () => {
      console.log('[UI-GTM] Copying bookmarklet code...');
      copyBookmarkletCode();
    });
  }

  // Open OneVR login popup
  loginBtn.addEventListener('click', async () => {
    loginBtn.disabled = true;
    showStatus('loginStatus', '⏳ Öppnar OneVR popup... Väntar på login (max 3 minuter)', 'loading');

    try {
      console.log('[UI-GTM] Opening OneVR login popup...');
      const localStorageData = await openOneVRLoginPopup();

      // Convert to JSON string
      const jsonString = JSON.stringify(localStorageData);
      if (storageInput) {
        storageInput.value = jsonString;
      }

      showStatus('loginStatus', '✓ localStorage hämtad! Klicka "Spara till Firebase" för att spara.', 'success');
      console.log('[UI-GTM] localStorage extracted from OneVR popup');
    } catch (error) {
      showStatus('loginStatus', '✗ Fel: ' + error.message, 'error');
      console.error('[UI-GTM] Error opening OneVR popup:', error);
    } finally {
      loginBtn.disabled = false;
    }
  });

  console.log('[UI-GTM] OneVR UI initialized');
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
