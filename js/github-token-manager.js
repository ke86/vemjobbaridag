/**
 * github-token-manager.js
 * Handles GitHub PAT storage and OneVR localStorage token uploads
 */

const GITHUB_TOKEN_KEY = 'github_pat_onevr';
const GITHUB_REPO = 'ke86/snok';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE_PATH = 'scripts/localStorage.js';
const GITHUB_API_URL = 'https://api.github.com/repos/ke86/snok/contents/scripts/localStorage.js';

/**
 * Get GitHub PAT from Firestore
 */
async function getGitHubPAT() {
  try {
    if (!window.db) {
      throw new Error('Firestore inte initierad');
    }

    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('Du är inte inloggad');
    }

    const doc = await window.db.collection('settings').doc(user.uid).get();
    if (!doc.exists) {
      throw new Error('Inställningar inte funna. Spara din GitHub token först.');
    }

    const token = doc.data().githubPAT;
    if (!token) {
      throw new Error('GitHub PAT är inte sparat. Mata in din token i inställningar.');
    }

    return token;
  } catch (error) {
    console.error('[GTM] Error getting GitHub PAT:', error);
    throw error;
  }
}

/**
 * Upload localStorage data to GitHub
 * @param {string} localStorageJson - JSON string of localStorage data
 */
async function uploadLocalStorageToGitHub(localStorageJson) {
  try {
    // Get GitHub PAT
    const ghPat = await getGitHubPAT();
    if (!ghPat) {
      throw new Error('GitHub PAT not configured. Spara din GitHub PAT först i inställningar.');
    }

    // Validate localStorage data
    let storageObj;
    try {
      storageObj = JSON.parse(localStorageJson);
    } catch (e) {
      throw new Error('Ogiltig JSON-data. Kontrollera att du kopierade rätt.');
    }

    // Get current file SHA (needed for update)
    const getShaResponse = await fetch(GITHUB_API_URL, {
      headers: {
        'Authorization': `token ${ghPat}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!getShaResponse.ok) {
      throw new Error(`GitHub API error: ${getShaResponse.status} ${getShaResponse.statusText}`);
    }

    const fileData = await getShaResponse.json();
    const currentSha = fileData.sha;

    // Create new file content (JavaScript module that exports the data)
    const fileContent = `/**
 * Auto-generated OneVR localStorage tokens
 * Last updated: ${new Date().toISOString()}
 */

const localStorageTokens = ${JSON.stringify(storageObj, null, 2)};

module.exports = localStorageTokens;
`;

    // Encode content to base64
    const encodedContent = btoa(unescape(encodeURIComponent(fileContent)));

    // Upload to GitHub
    const uploadResponse = await fetch(GITHUB_API_URL, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${ghPat}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Update OneVR localStorage tokens - ${new Date().toISOString()}`,
        content: encodedContent,
        sha: currentSha,
        branch: GITHUB_BRANCH
      })
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(`GitHub upload failed: ${error.message}`);
    }

    const result = await uploadResponse.json();

    console.log('[GTM] Successfully uploaded to GitHub:', result);

    // Save timestamp of last successful upload
    const user = firebase.auth().currentUser;
    if (user && window.db) {
      await window.db.collection('settings').doc(user.uid).update({
        localStorageTokensLastUploadedAt: new Date().toISOString()
      });
    }

    return {
      success: true,
      message: 'localStorage uppladdat till GitHub!',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[GTM] Upload failed:', error);
    throw error;
  }
}

/**
 * Get last upload timestamp
 */
async function getLastUploadTimestamp() {
  try {
    if (!window.db) return null;

    const user = firebase.auth().currentUser;
    if (!user) return null;

    const doc = await window.db.collection('settings').doc(user.uid).get();
    if (!doc.exists) return null;

    return doc.data().localStorageTokensLastUploadedAt || null;
  } catch (error) {
    console.error('[GTM] Error getting last upload timestamp:', error);
    return null;
  }
}

/**
 * Format timestamp for display
 */
function formatTokenAge(timestamp) {
  if (!timestamp) return 'Aldrig uppladdad';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h sedan`;
  }
  if (diffHours > 0) {
    return `${diffHours}h sedan`;
  }

  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffMins}m sedan`;
}

/**
 * Save GitHub PAT to Firestore
 */
async function saveGitHubPAT(token) {
  try {
    if (!window.db) {
      throw new Error('Firestore inte initierad');
    }

    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('Du är inte inloggad');
    }

    if (!token || !token.startsWith('ghp_')) {
      throw new Error('Ogiltig token format. Token måste börja med ghp_');
    }

    // Mask token for display (show only first and last 5 chars)
    const masked = token.substring(0, 5) + '...' + token.substring(token.length - 5);
    console.log('[GTM] Saving GitHub PAT:', masked);

    // Save to Firestore
    await window.db.collection('settings').doc(user.uid).set({
      githubPAT: token,
      githubPATSavedAt: new Date().toISOString()
    }, { merge: true });

    console.log('[GTM] GitHub PAT saved successfully');
    return {
      success: true,
      message: 'GitHub PAT sparad! (' + masked + ')'
    };
  } catch (error) {
    console.error('[GTM] Error saving GitHub PAT:', error);
    throw error;
  }
}

/**
 * Test GitHub PAT
 */
async function testGitHubPAT(token) {
  try {
    console.log('[GTM] Testing GitHub PAT...');

    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Token test failed');
    }

    const user = await response.json();
    console.log('[GTM] Token test successful:', user.login);

    return {
      success: true,
      message: `✓ Token fungerar! (GitHub user: ${user.login})`
    };
  } catch (error) {
    console.error('[GTM] Token test failed:', error);
    throw error;
  }
}
