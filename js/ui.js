/**
 * ui.js - Core UI Rendering Functions
 * Handles main DOM rendering and user interface updates
 *
 * Related files:
 * - ui-animations.js - Birthday & holiday animations
 * - ui-editors.js - Day editor & month picker
 * - ui-fridag.js - Fridagsnyckel functions
 */

// Current date state
let currentDate = new Date();

// Month view state
let viewMonth = new Date().getMonth();
let viewYear = new Date().getFullYear();
let selectedEmployeeId = null;
let currentScheduleView = 'calendar';

// DOM Elements (initialized in initUI)
let menuBtn, sidebar, sidebarOverlay, closeSidebarBtn;
let prevDayBtn, nextDayBtn, currentDateEl, workingCountEl, employeeListEl, showLedigaCheckbox;
let schedulePage, uploadPage, monthlyPage, headerTitle, menuLinks;
let personListView, personScheduleView, personList;
let monthDisplay, prevMonthBtn, nextMonthBtn, monthlyScheduleList;
let uploadZone, fileInput, filePreview, fileNameEl, fileSizeEl, removeFileBtn, processBtn;
let processingState, processingText;
let exportCalBtn, holidaysBtn, holidaysModal, holidaysClose, holidaysList;
let darkModeToggle;
let nativeDatePicker, dateDisplayBtn, menuTodayLink;
let deleteDataSection, deleteDataHeader, deleteEmployeeList;
let deleteConfirmModal, deleteModalText, deleteModalCancel, deleteModalConfirm;

let selectedFile = null;
let pendingDeleteEmployeeId = null;

/**
 * Initialize UI elements
 */
function initUI() {
  // Header & Navigation
  menuBtn = document.getElementById('menuBtn');
  sidebar = document.getElementById('sidebar');
  sidebarOverlay = document.getElementById('sidebarOverlay');
  closeSidebarBtn = document.getElementById('closeSidebar');

  // Daily view
  prevDayBtn = document.getElementById('prevDay');
  nextDayBtn = document.getElementById('nextDay');
  currentDateEl = document.getElementById('currentDate');
  workingCountEl = document.getElementById('workingCount');
  employeeListEl = document.getElementById('employeeList');
  showLedigaCheckbox = document.getElementById('showLediga');

  // Pages
  schedulePage = document.getElementById('schedulePage');
  uploadPage = document.getElementById('uploadPage');
  monthlyPage = document.getElementById('monthlyPage');
  headerTitle = document.querySelector('.header-title');
  menuLinks = document.querySelectorAll('.sidebar-menu a[data-page]');

  // Monthly view
  personListView = document.getElementById('personListView');
  personScheduleView = document.getElementById('personScheduleView');
  personList = document.getElementById('personList');
  monthDisplay = document.getElementById('monthDisplay');
  prevMonthBtn = document.getElementById('prevMonth');
  nextMonthBtn = document.getElementById('nextMonth');
  monthlyScheduleList = document.getElementById('monthlyScheduleList');

  // Upload
  uploadZone = document.getElementById('uploadZone');
  fileInput = document.getElementById('fileInput');
  filePreview = document.getElementById('filePreview');
  fileNameEl = document.getElementById('fileName');
  fileSizeEl = document.getElementById('fileSize');
  removeFileBtn = document.getElementById('removeFile');
  processBtn = document.getElementById('processBtn');
  processingState = document.getElementById('processingState');
  processingText = document.getElementById('processingText');

  // Export & Holidays
  exportCalBtn = document.getElementById('exportCalBtn');
  holidaysBtn = document.getElementById('holidaysBtn');
  holidaysModal = document.getElementById('holidaysModal');
  holidaysClose = document.getElementById('holidaysClose');
  holidaysList = document.getElementById('holidaysList');

  // Settings
  darkModeToggle = document.getElementById('darkModeToggle');

  // Date picker
  nativeDatePicker = document.getElementById('nativeDatePicker');
  dateDisplayBtn = document.getElementById('dateDisplayBtn');
  menuTodayLink = document.getElementById('menuTodayLink');

  // Delete data section
  deleteDataSection = document.getElementById('deleteDataSection');
  deleteDataHeader = document.getElementById('deleteDataHeader');
  deleteEmployeeList = document.getElementById('deleteEmployeeList');

  // Delete confirmation modal
  deleteConfirmModal = document.getElementById('deleteConfirmModal');
  deleteModalText = document.getElementById('deleteModalText');
  deleteModalCancel = document.getElementById('deleteModalCancel');
  deleteModalConfirm = document.getElementById('deleteModalConfirm');
}

// ==========================================
// DATE FORMATTING
// ==========================================

function formatDate(date) {
  const day = dayNames[date.getDay()];
  const dayNum = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${dayNum} ${month} ${year}`;
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function isToday(year, month, day) {
  const today = new Date();
  return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
}

// ==========================================
// TURN ICONS (Custom PNG images)
// ==========================================

function getTurnIcons(turnNumber) {
  const icons = [];
  const turnStr = (turnNumber || '').toString().toUpperCase().trim();

  // RESERVSTAM - shows XRES icon
  if (turnStr === 'RESERVSTAM') {
    icons.push({ type: 'x-reserv', src: 'icons/XRES.svg', alt: 'Reservstam' });
    return icons;
  }

  // RESERV (eller RESERV + siffra) - shows XRES icon
  if (turnStr === 'RESERV' || /^RESERV\d+$/.test(turnStr)) {
    icons.push({ type: 'x-reserv', src: 'icons/XRES.svg', alt: 'Reserv' });
    return icons;
  }

  if (turnStr.length >= 5) {
    const char4 = turnStr.charAt(3);
    const isReservTurn = (char4 === '8' || char4 === '9');

    // Check if this is a day A/B turn (position 6)
    const char6 = turnStr.length >= 6 ? turnStr.charAt(5) : '';
    const isDayAB = (char6 === 'A' || char6 === 'B');

    // Only show flag if NOT a day A/B turn
    if (!isReservTurn && !isDayAB) {
      const char3 = turnStr.charAt(2);
      if (/\d/.test(char3)) {
        const digit = parseInt(char3, 10);
        if (digit % 2 === 0) {
          // Even = Denmark
          icons.push({ type: 'flag', src: 'icons/DK.svg', alt: 'Danmark' });
        } else {
          // Odd = Sweden
          icons.push({ type: 'flag', src: 'icons/SE.svg', alt: 'Sverige' });
        }
      }
    }

    // Reserve turn (position 4 = 8 or 9)
    if (isReservTurn) {
      icons.push({ type: 'reserv', src: 'icons/RES.svg', alt: 'Reserv' });
    }

    // Show day indicator for A/B turns
    if (char6 === 'A') {
      icons.push({ type: 'day-1', src: 'icons/A1.svg', alt: 'Dag 1' });
    } else if (char6 === 'B') {
      icons.push({ type: 'day-2', src: 'icons/B2.svg', alt: 'Dag 2' });
    }
  }

  return icons;
}

function renderTurnIcons(turnNumber) {
  const icons = getTurnIcons(turnNumber);
  if (icons.length === 0) return '';

  const iconsHtml = icons.map(icon => {
    return `<img class="turn-icon turn-icon-${icon.type}" src="${icon.src}" alt="${icon.alt}">`;
  }).join('');

  return `<div class="turn-icons">${iconsHtml}</div>`;
}

/**
 * Render badge with icon/turn number toggle
 * For regular shifts: icon shown by default, tap to show turn number badge
 * Returns: { badgeHtml, hasToggle }
 */
function renderBadgeWithToggle(shift) {
  const turnStr = (shift.badgeText || '').toString().trim();
  const icons = getTurnIcons(turnStr);

  // Special badge types - no toggle, just return the badge
  const specialBadges = ['fp', 'fpv', 'semester', 'franvarande', 'foraldraledighet', 'afd', 'vab', 'ffu', 'seko', 'sjuk'];

  if (specialBadges.includes(shift.badge)) {
    let badgeHtml = '';
    switch (shift.badge) {
      case 'fp': badgeHtml = '<span class="badge ledig">FP</span>'; break;
      case 'fpv': badgeHtml = '<span class="badge ledig">FPV</span>'; break;
      case 'semester': badgeHtml = '<span class="badge semester-badge">Semester</span>'; break;
      case 'franvarande': badgeHtml = '<span class="badge franvarande-badge">Frånv.</span>'; break;
      case 'foraldraledighet': badgeHtml = '<span class="badge foraldraledighet-badge">Föräldr.</span>'; break;
      case 'afd': badgeHtml = '<span class="badge afd-badge">AFD</span>'; break;
      case 'vab': badgeHtml = '<span class="badge vab-badge">VAB</span>'; break;
      case 'ffu': badgeHtml = '<span class="badge ffu-badge">FFU</span>'; break;
      case 'seko': badgeHtml = `<span class="badge seko-badge">${shift.badgeText}</span>`; break;
      case 'sjuk': badgeHtml = '<span class="badge sjuk-badge">Sjuk</span>'; break;
    }
    return badgeHtml;
  }

  // Regular turn - check if we have icons
  if (icons.length === 0) {
    // No icons, just show turn number badge
    if (!turnStr) return '';
    return `<span class="badge dag">${turnStr}</span>`;
  }

  // Has icons - create toggle: icon (default) ↔ badge
  const iconsHtml = icons.map(icon => {
    return `<img class="badge-icon badge-icon-${icon.type}" src="${icon.src}" alt="${icon.alt}">`;
  }).join('');

  return `
    <div class="badge-toggle" onclick="toggleBadgeDisplay(event, this)">
      <div class="badge-icon-view">${iconsHtml}</div>
      <span class="badge dag badge-number-view">${turnStr}</span>
    </div>
  `;
}

/**
 * Toggle between icon and turn number badge
 */
function toggleBadgeDisplay(event, element) {
  event.stopPropagation(); // Don't trigger card click
  element.classList.toggle('show-number');
}

// ==========================================
// DAILY VIEW RENDERING
// ==========================================

function renderEmployees() {
  const dateKey = getDateKey(currentDate);
  const allShifts = employeesData[dateKey] || [];
  const showLediga = showLedigaCheckbox ? showLedigaCheckbox.checked : false;

  const workingShifts = allShifts.filter(s => !nonWorkingTypes.includes(s.badge));
  const ledigaShifts = allShifts.filter(s => nonWorkingTypes.includes(s.badge));
  let shifts = showLediga ? [...workingShifts, ...ledigaShifts] : workingShifts;

  // Get birthday employees for today
  const birthdayEmployees = getBirthdayEmployees(currentDate);

  // Add birthday employees who are not already in the list
  const shiftEmployeeIds = shifts.map(s => s.employeeId);
  for (const bdayEmp of birthdayEmployees) {
    if (!shiftEmployeeIds.includes(bdayEmp.employeeId)) {
      // Add as "ledig" birthday person
      shifts.push({
        employeeId: bdayEmp.employeeId,
        badge: 'birthday-only',
        badgeText: '',
        time: '-',
        isBirthdayOnly: true
      });
    }
  }

  // Get name day employees for today
  const nameDayEmployees = getNameDayEmployees(currentDate);

  // Add name day employees who are not already in the list
  const currentEmployeeIds = shifts.map(s => s.employeeId);
  for (const ndEmp of nameDayEmployees) {
    if (!currentEmployeeIds.includes(ndEmp.employeeId)) {
      // Add as "ledig" name day person
      shifts.push({
        employeeId: ndEmp.employeeId,
        badge: 'nameday-only',
        badgeText: '',
        time: '-',
        isNameDayOnly: true
      });
    }
  }

  if (currentDateEl) {
    currentDateEl.textContent = formatDate(currentDate);
    currentDateEl.style.transition = 'opacity 0.2s ease';
  }
  if (workingCountEl) workingCountEl.textContent = workingShifts.length;

  // Start holiday animations if applicable
  startHolidayDateDisplay();
  startHolidayAnimations();

  // Update important date cards for current viewing date
  if (typeof renderImportantDateCards === 'function') {
    renderImportantDateCards();
  }

  if (!employeeListEl) return;

  if (shifts.length === 0) {
    employeeListEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">😴</div>
        <p>Ingen arbetar denna dag</p>
      </div>
    `;
    return;
  }

  // Sort: birthday people first, then name day people, then by time
  const sortedShifts = [...shifts].sort((a, b) => {
    const empA = registeredEmployees[a.employeeId];
    const empB = registeredEmployees[b.employeeId];
    const bdayA = empA ? getBirthdayInfo(empA.name, currentDate) : null;
    const bdayB = empB ? getBirthdayInfo(empB.name, currentDate) : null;
    const ndayA = empA ? getNameDayInfo(empA.name, currentDate) : null;
    const ndayB = empB ? getNameDayInfo(empB.name, currentDate) : null;

    // Birthday people first
    if (bdayA && !bdayB) return -1;
    if (!bdayA && bdayB) return 1;

    // Then name day people
    if (ndayA && !ndayB) return -1;
    if (!ndayA && ndayB) return 1;

    // Then by time
    const timeA = a.time?.split('-')[0] || '99:99';
    const timeB = b.time?.split('-')[0] || '99:99';
    return timeA.localeCompare(timeB);
  });

  employeeListEl.innerHTML = sortedShifts.map((shift, index) => {
    const emp = registeredEmployees[shift.employeeId] || {
      name: 'Okänd',
      initials: '??',
      color: 'blue'
    };

    // Check if birthday
    const birthdayInfo = getBirthdayInfo(emp.name, currentDate);
    const isBirthday = !!birthdayInfo;
    const firstName = emp.name.split(' ')[0];

    // Check if name day
    const nameDayInfo = getNameDayInfo(emp.name, currentDate);
    const isNameDay = !!nameDayInfo;

    // Build combined card class
    const cardClasses = [];
    if (isBirthday) cardClasses.push('birthday');
    if (isNameDay) cardClasses.push('nameday');
    const extraClasses = cardClasses.join(' ');

    // Birthday cake icon (clickable)
    const cakeHtml = isBirthday
      ? `<span class="birthday-cake" onclick="event.stopPropagation(); showBirthdayPopup('${firstName}', ${birthdayInfo.age})">🎂</span>`
      : '';

    // Name day crown icon (clickable)
    const todaysNames = getNameDayNames(currentDate);
    const allNamesStr = todaysNames.join(', ');
    const crownHtml = isNameDay
      ? `<span class="nameday-crown" onclick="event.stopPropagation(); showNameDayPopup('${firstName}', '${allNamesStr.replace(/'/g, "\\'")}')">👑</span>`
      : '';

    // Determine time display
    let timeDisplay = shift.time || '-';
    if (shift.isBirthdayOnly || shift.isNameDayOnly) {
      timeDisplay = 'Ledig';
    } else if (nonWorkingTypes.includes(shift.badge)) {
      timeDisplay = 'Ledig';
    }

    // Build badge HTML with icon toggle support
    const badgeHtml = (shift.isBirthdayOnly || shift.isNameDayOnly) ? '' : renderBadgeWithToggle(shift);

    return `
      <div class="employee-card ${extraClasses}" style="animation-delay: ${index * 0.05}s" onclick="showDagvyPopup('${shift.employeeId}')">
        <div class="employee-info">
          <div class="employee-name">${emp.name}${cakeHtml}${crownHtml}</div>
          <div class="employee-time">${timeDisplay}</div>
        </div>
        <div class="employee-badge">
          ${badgeHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// NAVIGATION
// ==========================================

function goToPrevDay() {
  currentDate.setDate(currentDate.getDate() - 1);
  renderEmployees();
  updateNativeDatePicker();
}

function goToNextDay() {
  currentDate.setDate(currentDate.getDate() + 1);
  renderEmployees();
  updateNativeDatePicker();
}

/**
 * Go to today's date
 */
function goToToday() {
  currentDate = new Date();
  renderEmployees();
  updateNativeDatePicker();

  // Visual feedback - briefly highlight the date
  if (currentDateEl) {
    currentDateEl.style.transition = 'color 0.2s';
    currentDateEl.style.color = 'var(--accent-blue)';
    setTimeout(() => {
      currentDateEl.style.color = '';
    }, 500);
  }
}

/**
 * Go to specific date from date picker
 */
function goToDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  currentDate = new Date(year, month - 1, day);
  renderEmployees();
}

/**
 * Update native date picker value to match current date
 */
function updateNativeDatePicker() {
  if (nativeDatePicker) {
    nativeDatePicker.value = getDateKey(currentDate);
  }
}

function openSidebar() {
  sidebar.classList.add('active');
  sidebarOverlay.classList.add('active');
}

function closeSidebarMenu() {
  sidebar.classList.remove('active');
  sidebarOverlay.classList.remove('active');
}

// ==========================================
// PAGE NAVIGATION
// ==========================================

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  if (pageId === 'schedule') {
    schedulePage.classList.add('active');
    headerTitle.textContent = 'Vem jobbar idag?';
  } else if (pageId === 'upload') {
    uploadPage.classList.add('active');
    headerTitle.textContent = 'Ladda upp schema';
  } else if (pageId === 'monthly') {
    monthlyPage.classList.add('active');
    headerTitle.textContent = 'Schema';
    showPersonListView();
    renderPersonList();
  } else if (pageId === 'shadow') {
    document.getElementById('shadowPage').classList.add('active');
    headerTitle.textContent = 'Skuggschema';
    showShadowPersonSelect();
    renderShadowPersonList();
  } else if (pageId === 'settings') {
    document.getElementById('settingsPage').classList.add('active');
    headerTitle.textContent = 'Inställningar';
    resetSettingsCollapse();
  }

  closeSidebarMenu();
}

/**
 * Reset all collapsible sections in settings to collapsed state
 */
function resetSettingsCollapse() {
  const collapsibleSections = document.querySelectorAll('.settings-section.collapsible');
  collapsibleSections.forEach(section => {
    section.classList.remove('expanded');
  });
}

// ==========================================
// MONTHLY VIEW
// ==========================================

function getSortedEmployees() {
  return Object.values(registeredEmployees).sort((a, b) => {
    const nameA = a.name.split(' ')[0].toLowerCase();
    const nameB = b.name.split(' ')[0].toLowerCase();
    return nameA.localeCompare(nameB, 'sv');
  });
}

function showPersonListView() {
  personListView.style.display = 'block';
  personScheduleView.style.display = 'none';
  selectedEmployeeId = null;
}

function showPersonScheduleView(employeeId) {
  selectedEmployeeId = employeeId;
  personListView.style.display = 'none';
  personScheduleView.style.display = 'block';
  renderPersonSchedule();
}

function goToPersonSchedule(employeeId) {
  currentScheduleView = 'list';

  // Set view to the same month/year as currentDate (from daily view)
  viewMonth = currentDate.getMonth();
  viewYear = currentDate.getFullYear();

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  monthlyPage.classList.add('active');
  headerTitle.textContent = 'Schema';
  closeSidebarMenu();
  showPersonScheduleView(employeeId);
}

// ==========================================
// DAGVY (DAY VIEW) - DETAILED SHIFT INFO
// ==========================================

// Cache for dagvy data per employee
const dagvyCache = {};

/**
 * Parse Firestore REST API response value into plain JS object
 */
function parseFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in val) {
    const obj = {};
    const fields = val.mapValue.fields || {};
    for (const key of Object.keys(fields)) {
      obj[key] = parseFirestoreValue(fields[key]);
    }
    return obj;
  }
  return null;
}

/**
 * Parse full Firestore REST document into plain JS object
 */
function parseFirestoreDoc(doc) {
  const result = {};
  const fields = doc.fields || {};
  for (const key of Object.keys(fields)) {
    result[key] = parseFirestoreValue(fields[key]);
  }
  return result;
}

/**
 * Fetch dagvy data from Firestore REST API with retry on 429
 */
async function fetchDagvyREST(employeeName) {
  const encoded = encodeURIComponent(employeeName);
  const url = 'https://firestore.googleapis.com/v1/projects/vemjobbaridag/databases/(default)/documents/dagvy/' + encoded;

  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      return parseFirestoreDoc(json);
    }
    if (resp.status === 404) return null;
    if (resp.status === 429) {
      // Rate limited, wait and retry
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    throw new Error('REST ' + resp.status + ': ' + resp.statusText);
  }
  throw new Error('REST 429: rate limited efter 3 försök');
}

/**
 * Fetch dagvy data for a given employee name
 * Uses REST API first (most reliable), falls back to SDK
 */
async function fetchDagvy(employeeName) {
  // Check cache first (cache for 5 minutes)
  const cached = dagvyCache[employeeName];
  if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
    return cached.data;
  }

  const debug = [];

  // Method 1: REST API (bypasses SDK/security rules)
  try {
    debug.push('REST: försöker...');
    const restData = await fetchDagvyREST(employeeName);
    if (restData) {
      debug.push('REST: hittade data!');
      dagvyCache[employeeName] = { data: restData, timestamp: Date.now() };
      return { ...restData, _debug: debug };
    }
    debug.push('REST: 404 (ej hittad)');
  } catch (restErr) {
    debug.push('REST-fel: ' + restErr.message);
  }

  // Method 2: Firestore SDK direct doc
  try {
    debug.push('SDK: försöker doc...');
    const doc = await db.collection('dagvy').doc(employeeName).get();
    debug.push('SDK doc.exists: ' + doc.exists);
    if (doc.exists) {
      const data = doc.data();
      dagvyCache[employeeName] = { data, timestamp: Date.now() };
      return { ...data, _debug: debug };
    }
  } catch (sdkErr) {
    debug.push('SDK-fel: ' + (sdkErr.code || '') + ' ' + sdkErr.message);
  }

  // Method 3: SDK list ALL dagvy docs and match
  try {
    debug.push('SDK: hämtar alla dagvy-docs...');
    const allDocs = await db.collection('dagvy').get();
    debug.push('Antal docs: ' + allDocs.size);
    const lowerName = employeeName.toLowerCase();
    let foundData = null;
    allDocs.forEach(function(d) {
      const docId = d.id;
      debug.push('Doc: "' + docId + '" (len=' + docId.length + ')');
      if (!foundData) {
        if (docId === employeeName || docId.toLowerCase() === lowerName) {
          foundData = d.data();
          debug.push('MATCH på doc.id!');
        } else {
          const dData = d.data();
          if (dData.personName && dData.personName.toLowerCase() === lowerName) {
            foundData = dData;
            debug.push('MATCH på personName!');
          }
        }
      }
    });
    if (foundData) {
      dagvyCache[employeeName] = { data: foundData, timestamp: Date.now() };
      return { ...foundData, _debug: debug };
    }
    debug.push('Ingen match bland ' + allDocs.size + ' docs');
  } catch (listErr) {
    debug.push('List-fel: ' + (listErr.code || '') + ' ' + listErr.message);
  }

  return { _notFound: true, _debug: debug };
}

/**
 * Show dagvy popup when clicking on an employee card
 */
async function showDagvyPopup(employeeId) {
  const emp = registeredEmployees[employeeId];
  if (!emp) return;

  // Create loading modal
  const overlay = document.createElement('div');
  overlay.className = 'dagvy-overlay';
  overlay.id = 'dagvyOverlay';
  overlay.innerHTML = `
    <div class="dagvy-modal">
      <div class="dagvy-header">
        <div class="dagvy-header-info">
          <h2 class="dagvy-name">${emp.name}</h2>
          <div class="dagvy-loading">Hämtar dagvy... (v4.10.5)</div>
        </div>
        <button class="dagvy-close" onclick="closeDagvy()">✕</button>
      </div>
      <div class="dagvy-body" id="dagvyBody">
        <div class="dagvy-spinner"></div>
        <p style="text-align:center;font-size:11px;color:#999;margin-top:8px;">Laddar från Firestore REST API...</p>
      </div>
      <div class="dagvy-footer">
        <button class="dagvy-btn dagvy-btn-schedule" onclick="closeDagvy(); goToPersonSchedule('${employeeId}')">
          📅 Visa schema
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDagvy();
  });

  // Fetch data using fetchDagvy (REST API first, then SDK fallback)
  const data = await fetchDagvy(emp.name);

  const body = document.getElementById('dagvyBody');
  const loadingEl = overlay.querySelector('.dagvy-loading');
  if (!body) return;

  // Get debug info from fetchDagvy
  const debugLines = (data && data._debug) ? data._debug : ['ingen debug'];
  debugLines.unshift('v4.10.5 | Namn: "' + emp.name + '"');

  if (!data || data._notFound || !data.days || data.days.length === 0) {
    if (loadingEl) loadingEl.textContent = 'Dagvy debug';
    body.innerHTML = `
      <div class="dagvy-empty">
        <div class="dagvy-empty-icon">🔍</div>
        <p><strong>Debug-info (v4.10.5):</strong></p>
        <div style="font-size:12px;color:#333;margin-top:8px;text-align:left;padding:12px;background:#ffffcc;border:2px solid #cc0;border-radius:8px;line-height:1.8;">
          ${debugLines.map(function(l) { return '• ' + l; }).join('<br>')}
        </div>
        <p style="margin-top:12px;font-size:11px;color:#999;">Om du ser "v4.10.5" ovan fungerar cachen rätt.</p>
      </div>
    `;
    return;
  }

  // Find today's dagvy (match currentDate)
  const dateKey = getDateKey(currentDate);
  const todayDagvy = data.days.find(d => d.date === dateKey);

  if (!todayDagvy || todayDagvy.notFound) {
    if (loadingEl) loadingEl.textContent = todayDagvy ? 'Turdatan saknas' : 'Ingen tur idag';
    const availDates = data.days ? data.days.map(d => d.date).join(', ') : 'inga';
    body.innerHTML = `
      <div class="dagvy-empty">
        <div class="dagvy-empty-icon">📋</div>
        <p>Ingen turdata för ${formatDate(currentDate)}</p>
        <p style="font-size:11px;color:#999;margin-top:8px;">Sökte: ${dateKey}<br>Tillgängliga: ${availDates}</p>
      </div>
    `;
    return;
  }

  // Update header with turn info
  if (loadingEl) {
    loadingEl.innerHTML = `Tur <strong>${todayDagvy.turnr}</strong> &nbsp;·&nbsp; ${todayDagvy.start} – ${todayDagvy.end}`;
  }

  // Build the dagvy content
  body.innerHTML = buildDagvyContent(todayDagvy, emp.name);
}

/**
 * Build dagvy HTML content from a day's data
 */
function buildDagvyContent(dayData, employeeName) {
  let html = '';

  // === SEGMENTS TIMELINE ===
  if (dayData.segments && dayData.segments.length > 0) {
    html += '<div class="dagvy-section">';
    html += '<h3 class="dagvy-section-title">🚂 Tidslinje</h3>';
    html += '<div class="dagvy-timeline">';

    for (const seg of dayData.segments) {
      const isTrain = seg.trainNr && seg.trainNr.length > 0;
      const isRast = seg.activity && (seg.activity.includes('Rast') || seg.activity === 'Rasto');
      const isDisp = seg.activity === 'Disponibel';
      const isGang = seg.activity === 'Gångtid';

      let segClass = 'dagvy-seg-activity';
      if (isTrain) segClass = 'dagvy-seg-train';
      else if (isRast) segClass = 'dagvy-seg-rast';
      else if (isDisp) segClass = 'dagvy-seg-disp';
      else if (isGang) segClass = 'dagvy-seg-gang';

      const label = isTrain
        ? `${seg.trainType === 'Växling' ? '🔀' : '🚆'} Tåg ${seg.trainNr}`
        : (seg.activity || '–');

      const route = (seg.fromStation !== seg.toStation)
        ? `${seg.fromStation} → ${seg.toStation}`
        : seg.fromStation;

      const vehicleStr = seg.vehicles && seg.vehicles.length > 0
        ? `<span class="dagvy-seg-vehicle">${seg.vehicles.join(', ')}</span>`
        : '';

      html += `
        <div class="dagvy-seg ${segClass}">
          <div class="dagvy-seg-time">${seg.timeStart}<br><span class="dagvy-seg-time-end">${seg.timeEnd}</span></div>
          <div class="dagvy-seg-dot"></div>
          <div class="dagvy-seg-content">
            <div class="dagvy-seg-label">${label}</div>
            <div class="dagvy-seg-route">${route} ${vehicleStr}</div>
          </div>
        </div>
      `;
    }

    html += '</div></div>';
  }

  // === CREWS PER TRAIN ===
  if (dayData.crews && dayData.crews.length > 0) {
    html += '<div class="dagvy-section">';
    html += '<h3 class="dagvy-section-title">👥 Personal på tågen</h3>';

    for (const trainCrew of dayData.crews) {
      const vehicleStr = trainCrew.vehicles && trainCrew.vehicles.length > 0
        ? `<span class="dagvy-crew-vehicles">${trainCrew.vehicles.join(', ')}</span>`
        : '';

      html += `<div class="dagvy-crew-block">`;
      html += `<div class="dagvy-crew-header" onclick="this.parentElement.classList.toggle('expanded')">`;
      html += `<span class="dagvy-crew-train">🚆 Tåg ${trainCrew.trainNr}</span>`;
      html += vehicleStr;
      html += `<span class="dagvy-crew-chevron">›</span>`;
      html += `</div>`;
      html += `<div class="dagvy-crew-list">`;

      // Group by unique persons
      const personMap = {};
      for (const c of trainCrew.crew) {
        const key = c.name;
        if (!personMap[key]) {
          personMap[key] = { ...c, legs: [] };
        }
        personMap[key].legs.push({ from: c.fromStation, to: c.toStation, start: c.timeStart, end: c.timeEnd });
      }

      for (const person of Object.values(personMap)) {
        const isMe = person.name === employeeName;
        const roleIcon = person.role === 'Lokförare' ? '🚂' : '🎫';
        const legSummary = person.legs.map(l => `${l.from}→${l.to}`).join(', ');
        const timeRange = `${person.legs[0].start}–${person.legs[person.legs.length - 1].end}`;

        html += `
          <div class="dagvy-crew-person ${isMe ? 'dagvy-crew-me' : ''}">
            <div class="dagvy-crew-person-main">
              <span class="dagvy-crew-role">${roleIcon}</span>
              <span class="dagvy-crew-name">${person.name}</span>
            </div>
            <div class="dagvy-crew-person-detail">
              <span class="dagvy-crew-time">${timeRange}</span>
              <span class="dagvy-crew-leg">${legSummary}</span>
            </div>
            ${person.phone ? `<a href="tel:${person.phone}" class="dagvy-crew-phone" onclick="event.stopPropagation()">📞</a>` : ''}
          </div>
        `;
      }

      html += '</div></div>';
    }

    html += '</div>';
  }

  return html;
}

/**
 * Close dagvy popup
 */
function closeDagvy() {
  const overlay = document.getElementById('dagvyOverlay');
  if (overlay) overlay.remove();
}

// Count FP and FPV badges for an employee within the calendar year (Jan 1 - Dec 31)
function countFridagBadges(employeeId) {
  const currentYear = 2026;
  const startDate = new Date(currentYear, 0, 1);  // Jan 1, 2026
  const endDate = new Date(currentYear, 11, 31);  // Dec 31, 2026

  let fpCount = 0;
  let fpvCount = 0;

  // Loop through all dates in employeesData
  Object.entries(employeesData).forEach(([dateKey, dayShifts]) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // Check if date is within calendar year
    if (date >= startDate && date <= endDate) {
      dayShifts.forEach(shift => {
        if (shift.employeeId === employeeId) {
          // Check multiple fields for FP/FPV detection (handles legacy data)
          const badge = (shift.badge || '').toLowerCase();
          const badgeText = (shift.badgeText || '').toUpperCase();
          const service = (shift.service || '').toUpperCase();

          // FPV check first (more specific)
          if (badge === 'fpv' || badgeText === 'FPV' || service === 'FPV' ||
              service.includes('FP-V') || service.includes('FP2')) {
            fpvCount++;
          }
          // FP check (but not if already counted as FPV)
          else if (badge === 'fp' || badgeText === 'FP' || service === 'FP' || service === 'FRIDAG') {
            fpCount++;
          }
        }
      });
    }
  });

  return { fp: fpCount, fpv: fpvCount };
}

// Swedish official holidays for 2026 (shown in helgdagar modal)
function getSwedishHolidays2026() {
  return [
    { date: '2026-01-01', name: 'Nyårsdagen', type: 'newyear' },
    { date: '2026-01-06', name: 'Trettondedag jul', type: 'christmas' },
    { date: '2026-04-03', name: 'Långfredagen', type: 'easter' },
    { date: '2026-04-04', name: 'Påskafton', type: 'easter' },
    { date: '2026-04-05', name: 'Påskdagen', type: 'easter' },
    { date: '2026-04-06', name: 'Annandag påsk', type: 'easter' },
    { date: '2026-05-01', name: 'Första maj', type: 'default' },
    { date: '2026-05-14', name: 'Kristi himmelsfärdsdag', type: 'default' },
    { date: '2026-05-23', name: 'Pingstafton', type: 'default' },
    { date: '2026-05-24', name: 'Pingstdagen', type: 'default' },
    { date: '2026-06-06', name: 'Sveriges nationaldag', type: 'nationalday' },
    { date: '2026-06-19', name: 'Midsommarafton', type: 'midsummer' },
    { date: '2026-06-20', name: 'Midsommardagen', type: 'midsummer' },
    { date: '2026-10-31', name: 'Alla helgons dag', type: 'default' },
    { date: '2026-12-24', name: 'Julafton', type: 'christmas' },
    { date: '2026-12-25', name: 'Juldagen', type: 'christmas' },
    { date: '2026-12-26', name: 'Annandag jul', type: 'christmas' },
    { date: '2026-12-31', name: 'Nyårsafton', type: 'newyear' },
    { date: '2027-01-01', name: 'Nyårsdagen 2027', type: 'newyear' }
  ];
}

// Roliga dagar (fun days) — NOT shown in helgdagar modal, but trigger animations
function getRoligaDagar2026() {
  return [
    { date: '2026-02-14', name: 'Alla hjärtans dag', type: 'valentine' },
    { date: '2026-02-17', name: 'Fettisdagen', type: 'fattuesday' },
    { date: '2026-03-12', name: 'Alla korvars dag', type: 'sausage' },
    { date: '2026-05-11', name: 'Chokladbollens dag', type: 'chocolateball' },
    { date: '2026-05-17', name: 'Norges nationaldag', type: 'norway' },
    { date: '2026-05-31', name: 'Mors dag', type: 'mothersday' },
    { date: '2026-10-04', name: 'Kanelbullens dag', type: 'cinnamonbun' },
    { date: '2026-11-09', name: 'Fars dag', type: 'fathersday' },
    { date: '2026-11-13', name: 'Smörgåstårtans dag', type: 'sandwichcake' },
    { date: '2026-12-13', name: 'Luciadagen', type: 'lucia' }
  ];
}

// All special days combined (used by animation system and date display)
function getAllSpecialDays2026() {
  return [...getSwedishHolidays2026(), ...getRoligaDagar2026()];
}

// Check if employee has FP or FPV on a specific date
function getHolidayBadge(employeeId, dateKey) {
  const dayShifts = employeesData[dateKey] || [];
  for (const shift of dayShifts) {
    if (shift.employeeId === employeeId) {
      const badge = (shift.badge || '').toLowerCase();
      const badgeText = (shift.badgeText || '').toUpperCase();
      const service = (shift.service || '').toUpperCase();

      if (badge === 'fpv' || badgeText === 'FPV' || service === 'FPV' ||
          service.includes('FP-V') || service.includes('FP2')) {
        return 'FPV';
      }
      if (badge === 'fp' || badgeText === 'FP' || service === 'FP' || service === 'FRIDAG') {
        return 'FP';
      }
    }
  }
  return null;
}

// Format date in Swedish
function formatSwedishDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${weekdays[date.getDay()]} ${day} ${months[month - 1]}`;
}

// Toggle holidays modal
function toggleHolidaysModal() {
  if (holidaysModal.classList.contains('active')) {
    holidaysModal.classList.remove('active');
    return;
  }

  const holidays = getSwedishHolidays2026();
  const employeeId = selectedEmployeeId;

  // Render cell-based list
  const html = holidays.map(holiday => {
    const badge = getHolidayBadge(employeeId, holiday.date);
    const badgeHtml = badge
      ? `<span class="holiday-badge ${badge === 'FPV' ? 'fpv' : ''}">${badge}</span>`
      : '';

    // Extract day and month for date box
    const [year, month, day] = holiday.date.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(month) - 1];

    return `
      <div class="holiday-cell">
        <div class="holiday-date-box">
          <span class="holiday-day">${parseInt(day)}</span>
          <span class="holiday-month">${monthName}</span>
        </div>
        <div class="holiday-info">
          <span class="holiday-name">${holiday.name}</span>
          <span class="holiday-weekday">${formatSwedishDate(holiday.date)}</span>
        </div>
        ${badgeHtml}
      </div>
    `;
  }).join('');

  holidaysList.innerHTML = html;
  holidaysModal.classList.add('active');
}

function renderPersonList() {
  const employees = getSortedEmployees();

  if (employees.length === 0) {
    personList.innerHTML = `
      <div class="no-schedules">
        <div class="icon">📋</div>
        <p>Inga scheman uppladdade ännu</p>
        <span class="upload-link" onclick="showPage('upload')">Ladda upp ett schema</span>
      </div>
    `;
    return;
  }

  personList.innerHTML = employees.map((emp, index) => {
    let totalShifts = 0;
    Object.values(employeesData).forEach(dayShifts => {
      if (dayShifts.some(s => s.employeeId === emp.employeeId)) {
        totalShifts++;
      }
    });

    // Count FP/FPV for this employee
    const fridagCount = countFridagBadges(emp.employeeId);
    const fpClass = fridagCount.fp > 104 ? 'over-limit' : '';
    const fpvClass = fridagCount.fpv > 14 ? 'over-limit' : '';

    return `
      <div class="person-list-card" style="animation-delay: ${index * 0.05}s" onclick="showPersonScheduleView('${emp.employeeId}')">
        <div class="avatar ${emp.color}">${emp.initials}</div>
        <div class="person-info">
          <div class="person-name">${emp.name}</div>
          <div class="person-subtitle">${totalShifts} dagar inlästa</div>
        </div>
        <div class="fridag-counters">
          <span class="fridag-count ${fpClass}">FP: ${fridagCount.fp}/104</span>
          <span class="fridag-count ${fpvClass}">FPV: ${fridagCount.fpv}/14</span>
        </div>
        <span class="arrow">›</span>
      </div>
    `;
  }).join('');
}

function getEmployeeMonthSchedule(employeeId, year, month) {
  const schedule = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayShifts = employeesData[dateKey] || [];

    // Find all shifts for this employee on this day
    const employeeShifts = dayShifts.filter(s => s.employeeId === employeeId);

    if (employeeShifts.length > 0) {
      // Check if there's both FP/FPV and a working shift
      const fpShift = employeeShifts.find(s => s.badge === 'fp' || s.badge === 'fpv');
      const workShift = employeeShifts.find(s => s.badge !== 'fp' && s.badge !== 'fpv' && s.time && s.time !== '-');

      if (fpShift && workShift) {
        // Combined: FP/FPV background with work overlay
        schedule[day] = {
          ...fpShift,
          hasOverlay: true,
          overlayTime: workShift.time,
          overlayBadgeText: workShift.badgeText
        };
      } else {
        // Single shift
        schedule[day] = employeeShifts[0];
      }
    }
  }

  return schedule;
}

function getShiftTypeClass(badgeText) {
  const serviceUpper = (badgeText || '').toUpperCase();
  if (serviceUpper === 'FP') return 'fp';
  if (serviceUpper === 'FPV') return 'fpv';
  if (serviceUpper === 'SEMESTER') return 'semester';
  if (serviceUpper === 'FRÅNVARANDE') return 'franvarande';
  if (serviceUpper.includes('FÖRÄLDRALEDIGHET')) return 'foraldraledighet';
  if (serviceUpper === 'AFD') return 'afd';
  if (serviceUpper === 'RESERV' || serviceUpper === 'RESERVSTAM') return 'reserv';
  if (badgeText) return 'working';
  return 'off';
}

function getShiftDisplayText(shift) {
  const serviceUpper = (shift.badgeText || '').toUpperCase();
  if (serviceUpper === 'FP') return 'FP';
  if (serviceUpper === 'FPV') return 'FPV';
  if (serviceUpper === 'SEMESTER') return 'Semester';
  if (serviceUpper === 'FRÅNVARANDE') return 'Frånv.';
  if (serviceUpper.includes('FÖRÄLDRALEDIGHET')) return 'Föräldr.';
  if (serviceUpper === 'AFD') return 'AFD';
  if (serviceUpper === 'RESERV' || serviceUpper === 'RESERVSTAM') {
    return shift.time && shift.time !== '-' ? shift.time : serviceUpper.substring(0, 6);
  }
  return shift.time && shift.time !== '-' ? shift.time : '';
}

function renderPersonSchedule() {
  if (!selectedEmployeeId) return;

  const emp = registeredEmployees[selectedEmployeeId];
  if (!emp) return;

  monthDisplay.textContent = `${monthNamesFull[viewMonth]} ${viewYear}`;

  if (currentScheduleView === 'calendar') {
    renderCalendarView(emp);
  } else {
    renderListView(emp);
  }
}

function getCalendarDayIcon(badgeText) {
  const icons = getTurnIcons(badgeText);
  if (icons.length === 0) return '';

  // Priority: flag > reserv > day indicator
  for (const icon of icons) {
    if (icon.type === 'flag') {
      return `<img class="day-icon day-icon-flag" src="${icon.src}" alt="${icon.alt}">`;
    }
  }
  for (const icon of icons) {
    if (icon.type === 'reserv' || icon.type === 'x-reserv') {
      return `<img class="day-icon day-icon-reserv" src="${icon.src}" alt="${icon.alt}">`;
    }
  }
  for (const icon of icons) {
    if (icon.type === 'day-1' || icon.type === 'day-2') {
      return `<img class="day-icon day-icon-day" src="${icon.src}" alt="${icon.alt}">`;
    }
  }
  return '';
}

function parseTime(timeStr) {
  if (!timeStr || timeStr === '-') return { start: '', end: '' };
  const parts = timeStr.split('-');
  if (parts.length === 2) {
    return { start: parts[0].trim(), end: parts[1].trim() };
  }
  return { start: timeStr, end: '' };
}

function getShortLabel(badgeText) {
  const serviceUpper = (badgeText || '').toUpperCase();
  if (serviceUpper === 'FP') return 'FP';
  if (serviceUpper === 'FPV') return 'FPV';
  if (serviceUpper === 'SEMESTER') return 'Sem';
  if (serviceUpper === 'FRÅNVARANDE') return 'Frånv';
  if (serviceUpper.includes('FÖRÄLDRALEDIGHET')) return 'Föräld';
  if (serviceUpper === 'AFD') return 'AFD';
  if (serviceUpper === 'RESERV' || serviceUpper === 'RESERVSTAM') return 'Res';
  return '';
}

function renderCalendarView(emp) {
  const monthSchedule = getEmployeeMonthSchedule(selectedEmployeeId, viewYear, viewMonth);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  let calendarHTML = '<div class="week-header">v.</div>';
  calendarHTML += dayNamesShort.map(d => `<div class="schedule-grid-header">${d}</div>`).join('');

  let currentDayOfWeek = 0;
  let currentDay = 1;

  const firstDate = new Date(viewYear, viewMonth, 1);
  let weekNum = getWeekNumber(firstDate);
  calendarHTML += `<div class="week-number">${weekNum}</div>`;

  for (let i = 0; i < startDay; i++) {
    calendarHTML += '<div class="schedule-day empty"></div>';
    currentDayOfWeek++;
  }

  while (currentDay <= daysInMonth) {
    if (currentDayOfWeek === 7) {
      currentDayOfWeek = 0;
      const weekDate = new Date(viewYear, viewMonth, currentDay);
      weekNum = getWeekNumber(weekDate);
      calendarHTML += `<div class="week-number">${weekNum}</div>`;
    }

    const shift = monthSchedule[currentDay];
    const typeClass = shift ? getShiftTypeClass(shift.badgeText) : 'off';
    const todayClass = isToday(viewYear, viewMonth, currentDay) ? 'today' : '';
    const iconHtml = shift ? getCalendarDayIcon(shift.hasOverlay ? shift.overlayBadgeText : shift.badgeText) : '';

    let timesHtml = '';
    if (shift && shift.hasOverlay) {
      // FP/FPV with work overlay - show times in small box
      const { start, end } = parseTime(shift.overlayTime);
      timesHtml = `
        <div class="day-overlay-box">
          <span class="overlay-start">${start}</span>
          <span class="overlay-end">${end}</span>
        </div>
      `;
    } else if (shift && shift.time && shift.time !== '-') {
      const { start, end } = parseTime(shift.time);
      timesHtml = `
        <div class="day-times">
          <span class="day-start">${start}</span>
          <span class="day-end">${end}</span>
        </div>
      `;
    } else if (shift) {
      const label = getShortLabel(shift.badgeText);
      if (label) {
        timesHtml = `<div class="day-times"><span class="day-start">${label}</span></div>`;
      }
    }

    // Build data attributes for expand popup
    const badgeStr = shift ? (shift.badgeText || '').toString() : '';
    const timeStr = shift ? (shift.hasOverlay ? shift.overlayTime : (shift.time || '')) : '';
    const overlayBadge = shift && shift.hasOverlay ? (shift.overlayBadgeText || '') : '';
    const shiftBadge = shift ? (shift.badge || '') : '';
    const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

    calendarHTML += `
      <div class="schedule-day ${typeClass} ${todayClass}"
           onclick="expandDayCell(this, ${currentDay}, '${dateKey}', '${badgeStr}', '${timeStr}', '${overlayBadge}', '${shiftBadge}')">
        <div class="day-top">
          <span class="day-num">${currentDay}</span>
          ${iconHtml}
        </div>
        ${timesHtml}
      </div>
    `;

    currentDay++;
    currentDayOfWeek++;
  }

  monthlyScheduleList.innerHTML = `
    <div class="person-schedule-card">
      <div class="person-schedule-header">
        <div class="avatar ${emp.color}">${emp.initials}</div>
        <span class="name">${emp.name}</span>
        <div class="view-toggle-inline">
          <span class="view-label active">Kalender</span>
          <div class="view-switch" id="viewToggleSwitch"></div>
          <span class="view-label">Lista</span>
        </div>
      </div>
      <div class="schedule-grid">
        ${calendarHTML}
      </div>
    </div>
  `;
}

/**
 * Expand a day cell in the calendar view to show full details.
 * Shows a popup overlay anchored to the clicked cell.
 */
function expandDayCell(el, dayNum, dateKey, badgeText, timeStr, overlayBadge, shiftBadge) {
  // Remove any existing popup
  const existing = document.querySelector('.schedule-day-detail');
  if (existing) {
    const wasOnSame = existing.dataset.dateKey === dateKey;
    existing.remove();
    document.querySelectorAll('.schedule-day.expanded').forEach(d => d.classList.remove('expanded'));
    if (wasOnSame) return; // Toggle off
  }

  // Don't expand empty cells
  if (el.classList.contains('empty') || (!badgeText && !shiftBadge)) return;

  el.classList.add('expanded');

  // Build content
  const dateObj = new Date(dateKey + 'T00:00:00');
  const dayName = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'][dateObj.getDay()];
  const monthName = monthNames[dateObj.getMonth()];

  // Icons
  const displayBadge = overlayBadge || badgeText;
  const icons = getTurnIcons(displayBadge);
  let iconsHtml = '';
  if (icons.length > 0) {
    iconsHtml = icons.map(icon =>
      `<img class="detail-icon detail-icon-${icon.type}" src="${icon.src}" alt="${icon.alt}">`
    ).join('');
  }

  // Type label
  let typeLabel = '';
  const specialLabels = {
    fp: 'Fridag (FP)', fpv: 'Fridag Vakanslista (FPV)',
    semester: 'Semester', franvarande: 'Frånvarande',
    foraldraledighet: 'Föräldraledighet', afd: 'AFD', vab: 'VAB', sjuk: 'Sjuk'
  };
  if (specialLabels[shiftBadge]) {
    typeLabel = `<div class="detail-type">${specialLabels[shiftBadge]}</div>`;
  }

  // Time display
  let timeHtml = '';
  if (timeStr && timeStr !== '-') {
    const { start, end } = parseTime(timeStr);
    timeHtml = `<div class="detail-time">${start} – ${end}</div>`;
  }

  // Turn number
  let turnHtml = '';
  if (displayBadge && !specialLabels[shiftBadge]) {
    turnHtml = `<div class="detail-turn">${displayBadge}</div>`;
  }

  // Overlay info (FP + work)
  let overlayHtml = '';
  if (overlayBadge) {
    const fpLabel = shiftBadge === 'fpv' ? 'FPV' : 'FP';
    overlayHtml = `<div class="detail-overlay">${fpLabel} + arbetspass</div>`;
  }

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'schedule-day-detail';
  popup.dataset.dateKey = dateKey;
  popup.innerHTML = `
    <div class="detail-header">
      <span class="detail-date">${dayName} ${dayNum} ${monthName}</span>
      <span class="detail-close" onclick="event.stopPropagation(); closeExpandedDay()">✕</span>
    </div>
    ${typeLabel}
    ${overlayHtml}
    <div class="detail-body">
      ${iconsHtml ? `<div class="detail-icons">${iconsHtml}</div>` : ''}
      ${turnHtml}
      ${timeHtml}
    </div>
  `;

  // Position the popup
  const grid = el.closest('.schedule-grid');
  if (!grid) return;
  grid.style.position = 'relative';

  const gridRect = grid.getBoundingClientRect();
  const cellRect = el.getBoundingClientRect();

  // Center popup horizontally on the cell, clamp to grid bounds
  let left = cellRect.left - gridRect.left + (cellRect.width / 2) - 75;
  left = Math.max(4, Math.min(left, gridRect.width - 154));

  // Position below cell, or above if near bottom
  let top = cellRect.bottom - gridRect.top + 6;
  if (top + 120 > gridRect.height) {
    top = cellRect.top - gridRect.top - 6;
    popup.classList.add('above');
  }

  popup.style.left = `${left}px`;
  popup.style.top = popup.classList.contains('above') ? 'auto' : `${top}px`;
  if (popup.classList.contains('above')) {
    popup.style.bottom = `${gridRect.height - (cellRect.top - gridRect.top)}px`;
  }

  grid.appendChild(popup);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', closeExpandedDayOutside, { once: true });
  }, 10);
}

function closeExpandedDay() {
  const existing = document.querySelector('.schedule-day-detail');
  if (existing) existing.remove();
  document.querySelectorAll('.schedule-day.expanded').forEach(d => d.classList.remove('expanded'));
}

function closeExpandedDayOutside(e) {
  const popup = document.querySelector('.schedule-day-detail');
  if (popup && !popup.contains(e.target) && !e.target.closest('.schedule-day.expanded')) {
    closeExpandedDay();
  }
}

function renderListIcons(turnNumber) {
  const icons = getTurnIcons(turnNumber);
  if (icons.length === 0) return '<div class="list-icons"></div>';

  const iconsHtml = icons.map(icon => {
    return `<img class="list-icon list-icon-${icon.type}" src="${icon.src}" alt="${icon.alt}">`;
  }).join('');

  return `<div class="list-icons">${iconsHtml}</div>`;
}

function renderListView(emp) {
  const monthSchedule = getEmployeeMonthSchedule(selectedEmployeeId, viewYear, viewMonth);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const weeks = [];
  let currentWeek = null;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewYear, viewMonth, day);
    const weekNum = getWeekNumber(date);

    if (!currentWeek || currentWeek.weekNum !== weekNum) {
      currentWeek = { weekNum, days: [] };
      weeks.push(currentWeek);
    }

    const dayOfWeek = date.getDay();
    const weekdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekdayName = dayNamesShort[weekdayIndex];
    const shift = monthSchedule[day];

    currentWeek.days.push({
      day,
      weekdayName,
      shift,
      isToday: isToday(viewYear, viewMonth, day)
    });
  }

  let listHTML = '';

  for (const week of weeks) {
    let daysHTML = '';

    for (const d of week.days) {
      const typeClass = d.shift ? getShiftTypeClass(d.shift.badgeText) : 'off';
      const todayClass = d.isToday ? 'today' : '';

      let timeText = '-';
      let serviceText = '-';
      let iconsHtml = '<div class="list-icons"></div>';

      let isEdited = false;
      if (d.shift) {
        isEdited = d.shift.edited === true;
        if (d.shift.hasOverlay) {
          // FP/FPV + work: show work time with (FP) label
          timeText = d.shift.overlayTime || '-';
          serviceText = `${d.shift.overlayBadgeText} <span class="fp-label">(${d.shift.badgeText})</span>`;
          iconsHtml = renderListIcons(d.shift.overlayBadgeText);
        } else {
          timeText = d.shift.time && d.shift.time !== '-' ? d.shift.time : '-';
          serviceText = d.shift.badgeText;
          iconsHtml = renderListIcons(d.shift.badgeText);
        }
      }

      // Build date key for this day
      const dayDateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
      const editedClass = isEdited ? 'edited' : '';

      daysHTML += `
        <div class="schedule-list-item ${typeClass} ${todayClass} ${editedClass} clickable"
             onclick="openDayEditor('${dayDateKey}', '${selectedEmployeeId}')">
          <div class="list-date">
            <span>${d.weekdayName} ${d.day}</span>
          </div>
          <span class="list-time">${timeText}</span>
          ${iconsHtml}
          <span class="list-service">${serviceText}</span>
        </div>
      `;
    }

    listHTML += `
      <div class="week-block">
        <div class="week-num-vertical">${week.weekNum}</div>
        <div class="week-days">${daysHTML}</div>
      </div>
    `;
  }

  monthlyScheduleList.innerHTML = `
    <div class="person-schedule-card">
      <div class="person-schedule-header">
        <div class="avatar ${emp.color}">${emp.initials}</div>
        <span class="name">${emp.name}</span>
        <div class="view-toggle-inline">
          <span class="view-label">Kalender</span>
          <div class="view-switch list-active" id="viewToggleSwitch"></div>
          <span class="view-label active">Lista</span>
        </div>
      </div>
      <div class="schedule-list">
        ${listHTML}
      </div>
    </div>
  `;
}

// ==========================================
// SHADOW SCHEDULE (Skuggschema) - Navigation
// ==========================================

// Shadow schedule state
let selectedShadowEmployeeId = null;

/**
 * Show the person selector, hide the schedule view
 */
function showShadowPersonSelect() {
  const selectEl = document.getElementById('shadowPersonSelect');
  const viewEl = document.getElementById('shadowScheduleView');
  if (selectEl) selectEl.style.display = 'block';
  if (viewEl) viewEl.style.display = 'none';
  selectedShadowEmployeeId = null;
}

/**
 * Render person list for shadow schedule selection
 * Only shows employees that have a fridagsnyckel assigned
 */
function renderShadowPersonList() {
  const listEl = document.getElementById('shadowPersonList');
  if (!listEl) return;

  const employees = getSortedEmployees();

  // Filter to only employees with fridagsnyckel
  const employeesWithKey = employees.filter(emp => emp.fridagsnyckel && emp.fridagsrad);

  if (employeesWithKey.length === 0) {
    listEl.innerHTML = `
      <div class="no-schedules">
        <div class="icon">👻</div>
        <p>Inga skuggscheman tillgängliga</p>
        <span class="shadow-hint">Tilldela fridagsnyckel i Inställningar först</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = employeesWithKey.map((emp, index) => {
    const keyData = FRIDAG_KEYS[emp.fridagsnyckel];
    const cycleBadge = keyData ? `${keyData.cycle}v cykel` : '';

    return `
      <div class="person-list-card" style="animation-delay: ${index * 0.05}s" onclick="showShadowScheduleView('${emp.employeeId}')">
        <div class="avatar ${emp.color}">${emp.initials}</div>
        <div class="person-info">
          <div class="person-name">${emp.name}</div>
          <div class="person-subtitle">${emp.fridagsnyckel} Rad ${emp.fridagsrad}</div>
        </div>
        <div class="shadow-cycle-info">
          <span class="shadow-cycle-tag">${cycleBadge}</span>
        </div>
        <span class="arrow">›</span>
      </div>
    `;
  }).join('');
}

/**
 * Show shadow schedule view for a selected employee
 */
function showShadowScheduleView(employeeId) {
  selectedShadowEmployeeId = employeeId;

  const selectEl = document.getElementById('shadowPersonSelect');
  const viewEl = document.getElementById('shadowScheduleView');
  if (selectEl) selectEl.style.display = 'none';
  if (viewEl) viewEl.style.display = 'block';

  const emp = registeredEmployees[employeeId];
  if (!emp) return;

  // Update header info
  const nameEl = document.getElementById('shadowPersonName');
  const cycleEl = document.getElementById('shadowCycleBadge');
  if (nameEl) nameEl.textContent = emp.name;

  const keyData = emp.fridagsnyckel ? FRIDAG_KEYS[emp.fridagsnyckel] : null;
  if (cycleEl && keyData) {
    cycleEl.textContent = `${emp.fridagsnyckel} · ${keyData.cycle}v cykel · Rad ${emp.fridagsrad}`;
  }

  // Render shadow schedule (placeholder - will be filled in Del 3/4)
  renderShadowSchedule(employeeId);
}

// ==========================================
// SHADOW SCHEDULE - Cycle Logic (Del 3)
// ==========================================

/**
 * Get the Monday of the ISO week containing a given date
 */
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate which cycle week a given date falls in
 * Cycle starts from FRIDAG_START_DATE (2026-03-01)
 * Returns 1-based week number within the cycle (1 to cycleLength)
 */
function getCycleWeekNumber(date, cycleLength) {
  // Reference: first Monday on or after FRIDAG_START_DATE
  // 2026-03-01 is a Sunday, so first Monday is 2026-03-02
  const cycleStart = new Date(2026, 2, 2); // March 2, 2026 (Monday)
  cycleStart.setHours(0, 0, 0, 0);

  const targetMonday = getMondayOfWeek(date);
  const diffMs = targetMonday.getTime() - cycleStart.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

  // Handle dates before cycle start
  if (diffWeeks < 0) {
    // Wrap backwards
    const mod = ((diffWeeks % cycleLength) + cycleLength) % cycleLength;
    return mod + 1;
  }

  return (diffWeeks % cycleLength) + 1;
}

/**
 * Get all weeks in the display range for shadow schedule
 * Shows from FRIDAG_START_DATE to end of current + next full cycle
 * Returns array of { mondayDate, weekNum (ISO), cycleWeek }
 */
function getShadowWeeks(cycleLength) {
  const weeks = [];
  const startDate = new Date(2026, 2, 2); // March 2, 2026 (first Monday)
  startDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate how many complete cycles from start to today
  const todayMonday = getMondayOfWeek(today);
  const diffMs = todayMonday.getTime() - startDate.getTime();
  const diffWeeks = Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)));
  const currentCycleIndex = Math.floor(diffWeeks / cycleLength);

  // Show from start, through current cycle + 1 more full cycle
  const totalWeeksToShow = (currentCycleIndex + 2) * cycleLength;

  // But cap at a reasonable max (e.g., 52 weeks / 1 year)
  const maxWeeks = Math.min(totalWeeksToShow, 52);

  for (let i = 0; i < maxWeeks; i++) {
    const monday = new Date(startDate);
    monday.setDate(monday.getDate() + (i * 7));

    const isoWeekNum = getWeekNumber(monday);
    const cycleWeek = (i % cycleLength) + 1;

    weeks.push({
      mondayDate: monday,
      weekNum: isoWeekNum,
      cycleWeek: cycleWeek,
      weekIndex: i
    });
  }

  return weeks;
}

/**
 * Extract shift data for a specific employee for a given week (Mon-Sun)
 * Returns array of 7 objects (index 0=Mon, 6=Sun), each with { turn, time, badge }
 */
function getEmployeeWeekShifts(employeeId, mondayDate) {
  const shifts = [];

  for (let d = 0; d < 7; d++) {
    const date = new Date(mondayDate);
    date.setDate(date.getDate() + d);
    const dateKey = getDateKey(date);
    const dayShifts = employeesData[dateKey] || [];

    // Find shifts for this employee
    const empShifts = dayShifts.filter(s => s.employeeId === employeeId);

    if (empShifts.length > 0) {
      // Prioritize working shift over FP/FPV
      const workShift = empShifts.find(s => s.badge !== 'fp' && s.badge !== 'fpv'
        && s.badge !== 'semester' && s.badge !== 'franvarande'
        && s.badge !== 'foraldraledighet' && s.badge !== 'afd'
        && s.badge !== 'vab' && s.badge !== 'sjuk');
      const fpShift = empShifts.find(s => s.badge === 'fp' || s.badge === 'fpv');

      if (workShift) {
        shifts.push({
          turn: workShift.badgeText || '',
          time: workShift.time || '-',
          badge: workShift.badge || '',
          hasFP: !!fpShift,
          fpType: fpShift ? fpShift.badge : null,
          hasData: true
        });
      } else if (fpShift) {
        shifts.push({
          turn: fpShift.badgeText || fpShift.badge.toUpperCase(),
          time: '-',
          badge: fpShift.badge,
          hasFP: true,
          fpType: fpShift.badge,
          hasData: true
        });
      } else {
        // Other non-working type (semester, sjuk, etc.)
        const otherShift = empShifts[0];
        shifts.push({
          turn: otherShift.badgeText || otherShift.badge || '',
          time: otherShift.time || '-',
          badge: otherShift.badge || '',
          hasFP: false,
          fpType: null,
          hasData: true
        });
      }
    } else {
      shifts.push({ turn: '', time: '', badge: '', hasFP: false, fpType: null, hasData: false });
    }
  }

  return shifts;
}

/**
 * Build the shadow schedule data structure
 * Collects actual shifts and predicts future ones based on cycle repetition
 */
function buildShadowData(employeeId) {
  const emp = registeredEmployees[employeeId];
  if (!emp || !emp.fridagsnyckel) return null;

  const keyData = FRIDAG_KEYS[emp.fridagsnyckel];
  if (!keyData) return null;

  const cycleLength = keyData.cycle;
  const weeks = getShadowWeeks(cycleLength);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Phase 1: Collect actual data for each week
  const weekData = weeks.map(week => {
    const shifts = getEmployeeWeekShifts(employeeId, week.mondayDate);

    // Determine if this week has any actual data
    const hasActualData = shifts.some(s => s.hasData);

    // Is this week in the past or present?
    const weekEnd = new Date(week.mondayDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const isPast = weekEnd < today;
    const isCurrent = week.mondayDate <= today && today <= weekEnd;

    return {
      ...week,
      shifts: shifts,
      hasActualData: hasActualData,
      isPast: isPast,
      isCurrent: isCurrent,
      isPredicted: false
    };
  });

  // Phase 2: Build a "reference cycle" from the first cycle that has the most data
  // Collect shift patterns per cycleWeek
  const cyclePatterns = {};
  for (let cw = 1; cw <= cycleLength; cw++) {
    cyclePatterns[cw] = [];
  }

  // Gather all weeks with actual data
  for (const wd of weekData) {
    if (wd.hasActualData) {
      cyclePatterns[wd.cycleWeek].push(wd.shifts);
    }
  }

  // Build reference: use the latest data for each cycle week
  const referenceCycle = {};
  for (let cw = 1; cw <= cycleLength; cw++) {
    const candidates = cyclePatterns[cw];
    if (candidates.length > 0) {
      // Use the last (most recent) entry
      referenceCycle[cw] = candidates[candidates.length - 1];
    }
  }

  // Phase 3: Fill in predicted data for future weeks without actual data
  for (const wd of weekData) {
    if (!wd.hasActualData && !wd.isPast) {
      const ref = referenceCycle[wd.cycleWeek];
      if (ref) {
        wd.shifts = ref.map(s => ({ ...s }));
        wd.isPredicted = true;
      }
    }
  }

  return {
    cycleLength: cycleLength,
    keyId: emp.fridagsnyckel,
    keyName: keyData.name,
    row: emp.fridagsrad,
    weeks: weekData,
    referenceCycle: referenceCycle
  };
}

/**
 * Render the full shadow schedule (placeholder render - extended in Del 4)
 */
function renderShadowSchedule(employeeId) {
  const container = document.getElementById('shadowTableContainer');
  if (!container) return;

  const emp = registeredEmployees[employeeId];
  if (!emp || !emp.fridagsnyckel) {
    container.innerHTML = '<p class="shadow-no-data">Ingen fridagsnyckel tilldelad.</p>';
    return;
  }

  const shadowData = buildShadowData(employeeId);
  if (!shadowData || shadowData.weeks.length === 0) {
    container.innerHTML = '<p class="shadow-no-data">Kunde inte bygga skuggschema.</p>';
    return;
  }

  // Build table
  const dayHeaders = dayNamesShort; // Mån, Tis, Ons, Tor, Fre, Lör, Sön

  let tableHTML = `
    <table class="shadow-table">
      <thead>
        <tr>
          <th>V.</th>
          ${dayHeaders.map(d => `<th>${d}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  for (let i = 0; i < shadowData.weeks.length; i++) {
    const week = shadowData.weeks[i];
    const isCurrentWeek = week.isCurrent;
    const isCycleLast = week.cycleWeek === shadowData.cycleLength;
    const trClass = [
      isCurrentWeek ? 'shadow-current-week' : '',
      isCycleLast ? 'shadow-cycle-separator' : ''
    ].filter(Boolean).join(' ');

    tableHTML += `<tr class="${trClass}">`;

    // Week number cell
    tableHTML += `<td><span class="shadow-week-num">${week.weekNum}</span></td>`;

    // 7 day cells
    for (let d = 0; d < 7; d++) {
      const shift = week.shifts[d];

      if (!shift || (!shift.hasData && !week.isPredicted)) {
        tableHTML += `<td><div class="shadow-cell"><span class="shadow-cell-empty">·</span></div></td>`;
      } else {
        const isFP = shift.badge === 'fp' || shift.badge === 'fpv';
        const cellClass = [
          'shadow-cell',
          week.isPredicted ? 'shadow-cell-predicted' : '',
          isFP ? 'shadow-cell-fp' : ''
        ].filter(Boolean).join(' ');

        // Display turn (shortened if needed)
        let turnDisplay = shift.turn || '';
        if (turnDisplay.length > 8) {
          turnDisplay = turnDisplay.substring(0, 7) + '…';
        }

        // Display time
        const timeDisplay = shift.time && shift.time !== '-' ? shift.time : '';

        if (turnDisplay || timeDisplay) {
          tableHTML += `<td><div class="${cellClass}">`;
          if (turnDisplay) {
            tableHTML += `<span class="shadow-cell-turn">${turnDisplay}</span>`;
          }
          if (timeDisplay) {
            tableHTML += `<span class="shadow-cell-time">${timeDisplay}</span>`;
          }
          tableHTML += `</div></td>`;
        } else {
          tableHTML += `<td><div class="shadow-cell"><span class="shadow-cell-empty">·</span></div></td>`;
        }
      }
    }

    tableHTML += '</tr>';
  }

  tableHTML += '</tbody></table>';

  // Legend
  tableHTML += `
    <div class="shadow-legend">
      <div class="shadow-legend-item">
        <span class="shadow-legend-dot actual"></span>
        <span>Faktisk tur</span>
      </div>
      <div class="shadow-legend-item">
        <span class="shadow-legend-dot predicted"></span>
        <span>Förutsagd tur</span>
      </div>
      <div class="shadow-legend-item">
        <span class="shadow-legend-dot fp"></span>
        <span>FP / FPV</span>
      </div>
    </div>
  `;

  container.innerHTML = tableHTML;
}

// ==========================================
// TOAST & POPUPS
// ==========================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColor = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6';
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${bgColor};
    color: white;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showSuccessPopup() {
  const overlay = document.createElement('div');
  overlay.className = 'success-popup-overlay';
  overlay.innerHTML = `
    <div class="success-popup">
      <span class="success-icon">✓</span>
      <p class="success-text">Uppladdningen lyckades!</p>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', () => overlay.remove());
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
  }, 2000);
}

// ==========================================
// FILE UPLOAD HELPERS
// ==========================================

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function handleFile(file) {
  if (!file) return;

  const validTypes = ['application/pdf', 'text/csv', 'application/json'];
  const validExtensions = ['.pdf', '.csv', '.json'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

  if (!validTypes.includes(file.type) && !hasValidExtension) {
    showToast('Vänligen välj en PDF, CSV eller JSON-fil', 'error');
    return;
  }

  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatFileSize(file.size);

  uploadZone.style.display = 'none';
  filePreview.classList.add('active');
  processBtn.classList.add('active');
}

function removeFile() {
  selectedFile = null;
  fileInput.value = '';
  uploadZone.style.display = 'block';
  filePreview.classList.remove('active');
  processBtn.classList.remove('active');
}

// ==========================================
// DELETE DATA FUNCTIONS
// ==========================================

/**
 * Toggle the collapsible delete data section
 */
function toggleDeleteDataSection() {
  if (deleteDataSection) {
    deleteDataSection.classList.toggle('expanded');
    if (deleteDataSection.classList.contains('expanded')) {
      renderDeleteEmployeeList();
    }
  }
}

/**
 * Render the list of employees that can be deleted
 */
function renderDeleteEmployeeList() {
  if (!deleteEmployeeList) return;

  const employees = getSortedEmployees();

  if (employees.length === 0) {
    deleteEmployeeList.innerHTML = `
      <div class="delete-list-empty">
        <p>Ingen data att radera</p>
      </div>
    `;
    return;
  }

  deleteEmployeeList.innerHTML = employees.map(emp => {
    // Escape name for safe use in data attribute
    const safeName = emp.name.replace(/"/g, '&quot;');
    return `
      <div class="delete-list-item">
        <div class="employee-info">
          <div class="avatar ${emp.color}">${emp.initials}</div>
          <span class="employee-name">${emp.name}</span>
        </div>
        <button class="delete-btn" data-employee-id="${emp.employeeId}" data-employee-name="${safeName}">🗑️</button>
      </div>
    `;
  }).join('');

  // Add click handlers for delete buttons
  deleteEmployeeList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const employeeId = btn.dataset.employeeId;
      const employeeName = btn.dataset.employeeName;
      showDeleteConfirmModal(employeeId, employeeName);
    });
  });
}

/**
 * Show the delete confirmation modal
 */
function showDeleteConfirmModal(employeeId, employeeName) {
  pendingDeleteEmployeeId = employeeId;
  if (deleteModalText) {
    deleteModalText.textContent = `Vill du radera all data för ${employeeName}?`;
  }
  if (deleteConfirmModal) {
    deleteConfirmModal.classList.add('active');
  }
}

/**
 * Hide the delete confirmation modal
 */
function hideDeleteConfirmModal() {
  pendingDeleteEmployeeId = null;
  if (deleteConfirmModal) {
    deleteConfirmModal.classList.remove('active');
  }
}

/**
 * Confirm and execute the deletion
 */
async function confirmDeleteEmployee() {
  if (!pendingDeleteEmployeeId) return;

  const employeeId = pendingDeleteEmployeeId;
  hideDeleteConfirmModal();

  // Show immediate feedback - remove from UI first
  showToast('Raderar data...', 'info');

  // Delete from local data immediately for instant UI update
  delete registeredEmployees[employeeId];

  // Remove from all local schedule data
  for (const dateStr of Object.keys(employeesData)) {
    if (employeesData[dateStr]) {
      employeesData[dateStr] = employeesData[dateStr].filter(s => s.employeeId !== employeeId);
      if (employeesData[dateStr].length === 0) {
        delete employeesData[dateStr];
      }
    }
  }

  // Update UI immediately
  renderDeleteEmployeeList();
  renderEmployees();
  renderPersonList();

  // Now sync to Firebase in background
  try {
    await deleteEmployeeFromFirebase(employeeId);
    showToast('Data raderad', 'success');
  } catch (error) {
    console.error('Error deleting employee:', error);
    showToast('Kunde inte radera data', 'error');
  }
}
