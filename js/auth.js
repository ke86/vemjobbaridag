/**
 * auth.js - Authentication Handling
 * Manages login screen and password verification
 */

// Login state
let isLoggedIn = false;

// DOM Elements for login
const loginScreen = document.getElementById('loginScreen');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const loginLoading = document.getElementById('loginLoading');
const passwordInput = document.getElementById('passwordInput');

/**
 * Initialize login event listeners
 */
function initAuth() {
  // Password input handling
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
