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
// NAME DAY (NAMNSDAG) FUNCTIONS
// ==========================================

/**
 * Get today's name day names for a specific date
 * @param {Date} date
 * @returns {string[]} Array of names for today's namnsdag
 */
function getNameDayNames(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const key = `${month}-${day}`;
  return SWEDISH_NAME_DAYS[key] || [];
}

/**
 * Check if an employee has namnsdag on a given date
 * Matches employee's FIRST name against the name day list (case-insensitive)
 * @param {string} employeeName - Full employee name
 * @param {Date} date
 * @returns {{ matchedName: string }|null}
 */
function getNameDayInfo(employeeName, date) {
  if (!employeeName) return null;
  const todaysNames = getNameDayNames(date);
  if (todaysNames.length === 0) return null;

  // Get employee's first name
  const firstName = employeeName.split(' ')[0];

  // Check if first name matches any name day name (case-insensitive)
  const lowerFirst = firstName.toLowerCase();
  for (const ndName of todaysNames) {
    if (ndName.toLowerCase() === lowerFirst) {
      return { matchedName: ndName };
    }
  }
  return null;
}

/**
 * Get all employees who have namnsdag on a given date
 * @param {Date} date
 * @returns {Array} Array of employee objects with namnsdag info
 */
function getNameDayEmployees(date) {
  const nameDayPeople = [];
  const todaysNames = getNameDayNames(date);
  if (todaysNames.length === 0) return nameDayPeople;

  // Build a set of lowercase name day names for fast lookup
  const nameSet = new Set(todaysNames.map(n => n.toLowerCase()));

  for (const emp of Object.values(registeredEmployees)) {
    if (!emp.name) continue;
    const firstName = emp.name.split(' ')[0].toLowerCase();
    if (nameSet.has(firstName)) {
      nameDayPeople.push({ ...emp, nameDayName: todaysNames.find(n => n.toLowerCase() === firstName) });
    }
  }
  return nameDayPeople;
}

/**
 * Show name day popup with crown
 */
function showNameDayPopup(firstName, allNames) {
  const modal = document.createElement('div');
  modal.className = 'birthday-modal-overlay';
  modal.innerHTML = `
    <div class="birthday-modal nameday-modal">
      <div class="birthday-modal-content">
        <div class="birthday-emojis">👑</div>
        <div class="birthday-text">Grattis på namnsdagen</div>
        <div class="birthday-age nameday-name">${firstName}!</div>
        <div class="nameday-all-names">${allNames}</div>
        <button class="birthday-modal-btn nameday-modal-btn" onclick="this.closest('.birthday-modal-overlay').remove()">OK</button>
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
  const allDays = getAllSpecialDays2026();
  return allDays.find(h => h.date === dateKey) || null;
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

  // style: 'across' (left→right), 'rain' (top→down), 'rise' (bottom→up), 'bounce' (bottom bounce), 'jump' (in-place jump), 'spin' (across+spin)
  const animations = {
    // Original animations
    birthday: { emoji: '🎈', count: 4, className: 'float-balloon', style: 'rise' },
    easter: { emoji: '🥚', count: 3, className: 'float-egg', style: 'bounce' },
    midsummer: { emoji: '☀️', count: 1, className: 'float-sun', style: 'across' },
    christmas: { emoji: '🎅', count: 2, className: 'float-santa', style: 'across' },
    newyear: { emoji: '🎆', count: 5, className: 'float-firework', style: 'jump' },
    nationalday: { emoji: '🇸🇪', count: 3, className: 'float-flag', style: 'across' },
    default: { emoji: '✨', count: 2, className: 'float-sparkle', style: 'across' },
    // Roliga dagar - unika animationer
    valentine: { emoji: '❤️', count: 5, className: 'float-heart', style: 'rain' },
    fattuesday: { svg: 'icons/semla.svg', count: 2, className: 'float-semla', style: 'bounce' },
    sausage: { emoji: '🌭', count: 3, className: 'float-sausage', style: 'bounce' },
    chocolateball: { svg: 'icons/chokladboll.svg', count: 4, className: 'float-chokladboll', style: 'bounce' },
    norway: { svg: 'icons/NO.svg', count: 3, className: 'float-flag', style: 'across' },
    mothersday: { emoji: '💐', count: 4, className: 'float-flower', style: 'spin' },
    cinnamonbun: { svg: 'icons/kanelbulle.svg', count: 3, className: 'float-kanelbulle', style: 'spin' },
    fathersday: { emoji: '👔', count: 2, className: 'float-tie', style: 'jump' },
    sandwichcake: { svg: 'icons/smorgastarta.svg', count: 1, className: 'float-smorgastarta', style: 'across' },
    lucia: { emoji: '🕯️', count: 5, className: 'float-candle', style: 'rise' }
  };

  const anim = animations[animType] || animations.default;

  for (let i = 0; i < anim.count; i++) {
    setTimeout(() => {
      if (anim.svg) {
        createFloatingSvgElement(anim.svg, anim.className, anim.style, i);
      } else {
        createFloatingElement(anim.emoji, anim.className, anim.style, i);
      }
    }, i * 400 + Math.random() * 200);
  }
}

/**
 * Position element based on animation style
 */
function positionForStyle(el, style, index) {
  switch (style) {
    case 'rain':
      // Rain from top — spread horizontally
      el.style.left = `${10 + Math.random() * 80}%`;
      el.style.top = '-60px';
      break;
    case 'rise':
      // Rise from bottom — spread horizontally
      el.style.left = `${10 + Math.random() * 80}%`;
      el.style.top = 'auto';
      el.style.bottom = '-60px';
      break;
    case 'bounce':
      // Bounce at bottom — spread horizontally
      el.style.left = `${15 + (index * 20) + Math.random() * 10}%`;
      el.style.top = 'auto';
      el.style.bottom = '5%';
      break;
    case 'jump':
      // Jump in-place — spread across screen
      el.style.left = `${10 + (index * 18) + Math.random() * 8}%`;
      el.style.top = `${40 + Math.random() * 30}%`;
      break;
    case 'spin':
      // Spin across — start left, varied height
      el.style.left = '-60px';
      el.style.top = `${15 + Math.random() * 65}%`;
      break;
    case 'across':
    default:
      // Classic float across
      el.style.left = '-60px';
      el.style.top = `${20 + Math.random() * 60}%`;
      break;
  }
  // Add style class for CSS targeting
  if (style && style !== 'across') {
    el.classList.add('anim-' + style);
  }
}

/**
 * Create a floating animation element (emoji)
 */
function createFloatingElement(emoji, className, style, index) {
  const el = document.createElement('div');
  el.className = `floating-animation ${className}`;
  el.textContent = emoji;
  positionForStyle(el, style, index);

  document.body.appendChild(el);

  // Remove after animation completes
  const duration = (style === 'jump' || style === 'bounce') ? 4000 : 7000;
  setTimeout(() => {
    el.remove();
  }, duration);
}

/**
 * Create a floating animation element (SVG image)
 */
function createFloatingSvgElement(svgPath, className, style, index) {
  const el = document.createElement('div');
  el.className = `floating-animation floating-svg ${className}`;
  positionForStyle(el, style, index);

  const img = document.createElement('img');
  img.src = svgPath;
  img.alt = '';
  el.appendChild(img);

  document.body.appendChild(el);

  const duration = (style === 'jump' || style === 'bounce') ? 4000 : 7000;
  setTimeout(() => {
    el.remove();
  }, duration);
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
