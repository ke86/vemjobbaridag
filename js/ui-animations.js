/**
 * ui-animations.js - Holiday & Birthday Animations
 * Handles floating animations, birthday features, and holiday displays
 */

// ==========================================
// HOLIDAY ANIMATIONS STATE
// ==========================================

let holidayAnimationsEnabled = true;
let dateDisplayInterval = null;
let showingHolidayName = false;
let animationInterval = null;

// ==========================================
// BIRTHDAY FUNCTIONS
// ==========================================

/**
 * Check if someone has birthday on a given date
 * Returns { name, age } or null
 */
function getBirthdayInfo(employeeName, date) {
  const birthday = BIRTHDAYS[employeeName];
  if (!birthday) return null;

  const [birthYear, birthMonth, birthDay] = birthday.split('-').map(Number);
  const checkMonth = date.getMonth() + 1;
  const checkDay = date.getDate();

  if (birthMonth === checkMonth && birthDay === checkDay) {
    const age = date.getFullYear() - birthYear;
    return { name: employeeName, age };
  }
  return null;
}

/**
 * Get all employees with birthday on a given date
 */
function getBirthdayEmployees(date) {
  const birthdayPeople = [];
  const checkMonth = date.getMonth() + 1;
  const checkDay = date.getDate();

  for (const [name, birthday] of Object.entries(BIRTHDAYS)) {
    const [birthYear, birthMonth, birthDay] = birthday.split('-').map(Number);
    if (birthMonth === checkMonth && birthDay === checkDay) {
      const age = date.getFullYear() - birthYear;
      // Find employee ID by name
      const emp = Object.values(registeredEmployees).find(e => e.name === name);
      if (emp) {
        birthdayPeople.push({ ...emp, birthdayAge: age });
      }
    }
  }
  return birthdayPeople;
}

/**
 * Show birthday popup
 */
function showBirthdayPopup(firstName, age) {
  const modal = document.createElement('div');
  modal.className = 'birthday-modal-overlay';
  modal.innerHTML = `
    <div class="birthday-modal">
      <div class="birthday-modal-content">
        <div class="birthday-emojis">🎉🎂🎉</div>
        <div class="birthday-text">${firstName} fyller</div>
        <div class="birthday-age">${age} år</div>
        <div class="birthday-text">idag!</div>
        <button class="birthday-modal-btn" onclick="this.closest('.birthday-modal-overlay').remove()">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ==========================================
// HOLIDAY DETECTION
// ==========================================

/**
 * Get holiday info for a specific date
 */
function getHolidayForDate(date) {
  const dateKey = getDateKey(date);
  const holidays = getSwedishHolidays2026();
  return holidays.find(h => h.date === dateKey) || null;
}

/**
 * Check if anyone has birthday on date (for animation)
 */
function hasBirthdayOnDate(date) {
  const checkMonth = date.getMonth() + 1;
  const checkDay = date.getDate();

  for (const [name, birthday] of Object.entries(BIRTHDAYS)) {
    const [, birthMonth, birthDay] = birthday.split('-').map(Number);
    if (birthMonth === checkMonth && birthDay === checkDay) {
      return true;
    }
  }
  return false;
}

/**
 * Get animation type for current date
 */
function getAnimationType(date) {
  // Check birthday first
  if (hasBirthdayOnDate(date)) {
    return 'birthday';
  }

  // Check holiday
  const holiday = getHolidayForDate(date);
  if (holiday) {
    return holiday.type;
  }

  return null;
}

// ==========================================
// DATE DISPLAY ALTERNATION
// ==========================================

/**
 * Start date display alternation for holidays
 */
function startHolidayDateDisplay() {
  if (dateDisplayInterval) {
    clearInterval(dateDisplayInterval);
  }

  const holiday = getHolidayForDate(currentDate);
  if (!holiday || !holidayAnimationsEnabled) return;

  // Toggle every 10 seconds
  dateDisplayInterval = setInterval(() => {
    if (!holidayAnimationsEnabled) {
      stopHolidayDateDisplay();
      return;
    }

    showingHolidayName = !showingHolidayName;
    updateDateDisplay();
  }, 10000);
}

/**
 * Stop date display alternation
 */
function stopHolidayDateDisplay() {
  if (dateDisplayInterval) {
    clearInterval(dateDisplayInterval);
    dateDisplayInterval = null;
  }
  showingHolidayName = false;
  updateDateDisplay();
}

/**
 * Update date display (normal or holiday name)
 */
function updateDateDisplay() {
  if (!currentDateEl) return;

  const holiday = getHolidayForDate(currentDate);

  if (showingHolidayName && holiday && holidayAnimationsEnabled) {
    currentDateEl.style.opacity = '0';
    setTimeout(() => {
      currentDateEl.textContent = holiday.name;
      currentDateEl.style.opacity = '1';
    }, 200);
  } else {
    currentDateEl.style.opacity = '0';
    setTimeout(() => {
      currentDateEl.textContent = formatDate(currentDate);
      currentDateEl.style.opacity = '1';
    }, 200);
  }
}

// ==========================================
// FLOATING ANIMATIONS
// ==========================================

/**
 * Start floating animations
 */
function startHolidayAnimations() {
  if (animationInterval) {
    clearInterval(animationInterval);
  }

  if (!holidayAnimationsEnabled) return;

  // Run first animation after 5 seconds, then every 30-60 seconds
  setTimeout(() => {
    triggerFloatingAnimation();
  }, 5000);

  animationInterval = setInterval(() => {
    if (holidayAnimationsEnabled) {
      triggerFloatingAnimation();
    }
  }, 30000 + Math.random() * 30000);
}

/**
 * Stop floating animations
 */
function stopHolidayAnimations() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  // Remove any existing floating elements
  document.querySelectorAll('.floating-animation').forEach(el => el.remove());
}

/**
 * Trigger a floating animation based on current date
 */
function triggerFloatingAnimation() {
  if (!holidayAnimationsEnabled) return;

  const animType = getAnimationType(currentDate);
  if (!animType) return;

  const animations = {
    // Original animations
    birthday: { emoji: '🎈', count: 3, className: 'float-balloon' },
    easter: { emoji: '🥚', count: 2, className: 'float-egg' },
    midsummer: { emoji: '☀️', count: 1, className: 'float-sun' },
    christmas: { emoji: '🎅', count: 1, className: 'float-santa' },
    newyear: { emoji: '🎆', count: 2, className: 'float-firework' },
    nationalday: { emoji: '🇸🇪', count: 2, className: 'float-flag' },
    default: { emoji: '✨', count: 2, className: 'float-sparkle' },
    // Roliga dagar - nya animationer
    valentine: { emoji: '❤️', count: 3, className: 'float-heart' },
    fattuesday: { svg: 'icons/semla.svg', count: 2, className: 'float-semla' },
    sausage: { emoji: '🌭', count: 2, className: 'float-sausage' },
    chocolateball: { svg: 'icons/chokladboll.svg', count: 3, className: 'float-chokladboll' },
    norway: { svg: 'icons/NO.svg', count: 2, className: 'float-flag' },
    mothersday: { emoji: '💐', count: 2, className: 'float-flower' },
    cinnamonbun: { svg: 'icons/kanelbulle.svg', count: 2, className: 'float-kanelbulle' },
    fathersday: { emoji: '👔', count: 2, className: 'float-tie' },
    sandwichcake: { svg: 'icons/smorgastarta.svg', count: 1, className: 'float-smorgastarta' },
    lucia: { emoji: '🕯️', count: 3, className: 'float-candle' }
  };

  const anim = animations[animType] || animations.default;

  for (let i = 0; i < anim.count; i++) {
    setTimeout(() => {
      if (anim.svg) {
        createFloatingSvgElement(anim.svg, anim.className);
      } else {
        createFloatingElement(anim.emoji, anim.className);
      }
    }, i * 500);
  }
}

/**
 * Create a floating animation element (emoji)
 */
function createFloatingElement(emoji, className) {
  const el = document.createElement('div');
  el.className = `floating-animation ${className}`;
  el.textContent = emoji;
  el.style.top = `${20 + Math.random() * 60}%`;

  document.body.appendChild(el);

  // Remove after animation completes
  setTimeout(() => {
    el.remove();
  }, 6000);
}

/**
 * Create a floating animation element (SVG image)
 */
function createFloatingSvgElement(svgPath, className) {
  const el = document.createElement('div');
  el.className = `floating-animation floating-svg ${className}`;
  el.style.top = `${20 + Math.random() * 60}%`;

  const img = document.createElement('img');
  img.src = svgPath;
  img.alt = '';
  el.appendChild(img);

  document.body.appendChild(el);

  // Remove after animation completes
  setTimeout(() => {
    el.remove();
  }, 6000);
}

// ==========================================
// SETTINGS MANAGEMENT
// ==========================================

/**
 * Initialize holiday animations setting from storage
 */
async function initHolidayAnimations() {
  try {
    const stored = await getFromIndexedDB('holidayAnimations');
    if (stored !== null) {
      holidayAnimationsEnabled = stored;
    }
    updateHolidayAnimationsToggle();
  } catch (e) {
    console.log('Could not load holiday animations setting');
  }
}

/**
 * Toggle holiday animations setting
 */
async function toggleHolidayAnimations() {
  holidayAnimationsEnabled = !holidayAnimationsEnabled;
  updateHolidayAnimationsToggle();

  try {
    await saveToIndexedDB('holidayAnimations', holidayAnimationsEnabled);
  } catch (e) {
    console.log('Could not save holiday animations setting');
  }

  if (holidayAnimationsEnabled) {
    startHolidayDateDisplay();
    startHolidayAnimations();
  } else {
    stopHolidayDateDisplay();
    stopHolidayAnimations();
  }
}

/**
 * Update the toggle UI
 */
function updateHolidayAnimationsToggle() {
  const toggle = document.getElementById('holidayAnimationsToggle');
  if (toggle) {
    toggle.checked = holidayAnimationsEnabled;
  }
}
