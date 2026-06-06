/**
 * ui-github-pat-settings.js
 * UI for GitHub PAT (Personal Access Token) management
 */

let githubPATSettingsInitialized = false;

function initGitHubPATSettings() {
  if (githubPATSettingsInitialized) return;
  githubPATSettingsInitialized = true;

  const tokenInput = document.getElementById('githubTokenInput');
  const saveBtn = document.getElementById('saveGithubTokenBtn');
  const testBtn = document.getElementById('testGithubTokenBtn');

  if (!tokenInput || !saveBtn || !testBtn) {
    console.log('[PAT-SETTINGS] GitHub PAT settings elements not found');
    return;
  }

  // Load existing token (masked) on init
  loadAndDisplayGitHubPAT();

  // Save token
  saveBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      showGitHubPATStatus('⚠️ Mata in en GitHub token', 'error');
      return;
    }

    saveBtn.disabled = true;
    showGitHubPATStatus('💾 Sparar token...', 'loading');

    try {
      const result = await saveGitHubPAT(token);
      showGitHubPATStatus('✓ ' + result.message, 'success');
      tokenInput.value = ''; // Clear input
      console.log('[PAT-SETTINGS] Token saved successfully');
    } catch (error) {
      showGitHubPATStatus('✗ Fel: ' + error.message, 'error');
      console.error('[PAT-SETTINGS] Error saving token:', error);
    } finally {
      saveBtn.disabled = false;
    }
  });

  // Test token
  testBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      showGitHubPATStatus('⚠️ Mata in en GitHub token först', 'error');
      return;
    }

    testBtn.disabled = true;
    showGitHubPATStatus('🔍 Testar token...', 'loading');

    try {
      const result = await testGitHubPAT(token);
      showGitHubPATStatus(result.message, 'success');
      console.log('[PAT-SETTINGS] Token test successful');
    } catch (error) {
      showGitHubPATStatus('✗ Token fungerar inte: ' + error.message, 'error');
      console.error('[PAT-SETTINGS] Token test failed:', error);
    } finally {
      testBtn.disabled = false;
    }
  });

  console.log('[PAT-SETTINGS] GitHub PAT settings initialized');
}

/**
 * Load and display GitHub PAT (masked)
 */
async function loadAndDisplayGitHubPAT() {
  try {
    if (!window.db) return;

    const user = firebase.auth().currentUser;
    if (!user) return;

    const doc = await window.db.collection('settings').doc(user.uid).get();
    if (!doc.exists || !doc.data().githubPAT) {
      showGitHubPATStatus('⚠️ Ingen GitHub token sparad ännu', 'info');
      return;
    }

    const token = doc.data().githubPAT;
    const masked = token.substring(0, 5) + '...' + token.substring(token.length - 5);
    showGitHubPATStatus(`✓ Token sparad: ${masked}`, 'success');
  } catch (error) {
    console.error('[PAT-SETTINGS] Error loading token:', error);
  }
}

/**
 * Show GitHub PAT status message
 */
function showGitHubPATStatus(message, type) {
  const el = document.getElementById('githubTokenStatus');
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
  setTimeout(initGitHubPATSettings, 500);
});

// Also try to initialize when settings page becomes visible
document.addEventListener('pagechange', (e) => {
  if (e.detail === 'settings') {
    initGitHubPATSettings();
  }
});
