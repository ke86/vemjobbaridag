/**
 * auth.js - Authentication Handling
 * Manages login screen, password verification, and persistent login with IndexedDB
 */

// Login state
let isLoggedIn = false;

// DOM Elements for login
const loginScreen = document.getElementById('loginScreen');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const loginLoading = document.getElementById('loginLoading');
const passwordInput = document.getElementById('passwordInput');

// ==========================================
// INDEXEDDB FUNCTIONS
// ==========================================

/**
 * Open IndexedDB connection
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Save login state to IndexedDB
 */
async function saveLoginState() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put({
      id: 'loginState',
      loggedIn: true,
      timestamp: new Date().toISOString()
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    db.close();
  } catch (error) {
    console.error('Error saving login state:', error);
  }
}

/**
 * Check if user is already logged in
 */
async function checkLoginState() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get('loginState');

      request.onsuccess = () => {
        db.close();
        const data = request.result;
        resolve(data && data.loggedIn === true);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error checking login state:', error);
    return false;
  }
}

/**
 * Clear login state (logout)
 */
async function clearLoginState() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.delete('loginState');

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    db.close();
  } catch (error) {
    console.error('Error clearing login state:', error);
  }
}

// ==========================================
// AUTH FUNCTIONS
// ==========================================

/**
 * Initialize login - check if already logged in
 */
async function initAuth() {
  // Check if already logged in
  const alreadyLoggedIn = await checkLoginState();

  if (alreadyLoggedIn) {
    // Auto-login
    loginScreen.classList.add('hidden');
    loginLoading.classList.remove('active');

    try {
      await loadDataFromFirebase();
      setupRealtimeListeners();
      isLoggedIn = true;
      renderEmployees();
    } catch (error) {
      console.error('Auto-login failed:', error);
      // Clear bad state and show login
      await clearLoginState();
      loginScreen.classList.remove('hidden');
      setupLoginListeners();
    }
  } else {
    // Show login screen
    setupLoginListeners();
  }
}

/**
 * Setup login event listeners
 */
function setupLoginListeners() {
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
    loginError.textContent = '';
    passwordInput.classList.remove('error');
  });

  loginBtn.addEventListener('click', handleLogin);
}

/**
 * Handle login attempt
 */
async function handleLogin() {
  const password = passwordInput.value;

  if (!password) {
    showLoginError('Ange lösenord');
    return;
  }

  if (password !== APP_PASSWORD) {
    showLoginError('Fel lösenord');
    passwordInput.classList.add('error');
    return;
  }

  // Show loading
  loginBtn.style.display = 'none';
  loginLoading.classList.add('active');

  try {
    // Load data from Firebase
    await loadDataFromFirebase();

    // Setup realtime listeners for auto-sync
    setupRealtimeListeners();

    // Save login state to IndexedDB
    await saveLoginState();

    // Hide login screen
    isLoggedIn = true;
    loginScreen.classList.add('hidden');
    loginLoading.classList.remove('active');

    // Render the app
    renderEmployees();

  } catch (error) {
    console.error('Firebase error:', error);
    showLoginError('Kunde inte ansluta till servern');
    loginBtn.style.display = 'block';
    loginLoading.classList.remove('active');
  }
}

/**
 * Display login error message
 */
function showLoginError(message) {
  loginError.textContent = message;
  setTimeout(() => {
    loginError.textContent = '';
  }, 3000);
}
