/**
 * ui.js - UI Rendering Functions
 * Handles all DOM rendering and user interface updates
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
    icons.push({ type: 'x-reserv', src: 'icons/XRES.png', alt: 'Reservstam' });
    return icons;
  }

  // RESERV - shows RES icon
  if (turnStr === 'RESERV') {
    icons.push({ type: 'reserv', src: 'icons/RES.png', alt: 'Reserv' });
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
          icons.push({ type: 'flag', src: 'icons/DK.png', alt: 'Danmark' });
        } else {
          // Odd = Sweden
          icons.push({ type: 'flag', src: 'icons/SE.png', alt: 'Sverige' });
        }
      }
    }

    // Reserve turn (position 4 = 8 or 9)
    if (isReservTurn) {
      icons.push({ type: 'reserv', src: 'icons/RES.png', alt: 'Reserv' });
    }

    // Show day indicator for A/B turns
    if (char6 === 'A') {
      icons.push({ type: 'day-1', src: 'icons/A1.png', alt: 'Dag 1' });
    } else if (char6 === 'B') {
      icons.push({ type: 'day-2', src: 'icons/B2.png', alt: 'Dag 2' });
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
  const shifts = showLediga ? [...workingShifts, ...ledigaShifts] : workingShifts;

  if (currentDateEl) currentDateEl.textContent = formatDate(currentDate);
  if (workingCountEl) workingCountEl.textContent = workingShifts.length;

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

  const sortedShifts = [...shifts].sort((a, b) => {
    const timeA = a.time.split('-')[0] || '99:99';
    const timeB = b.time.split('-')[0] || '99:99';
    return timeA.localeCompare(timeB);
  });

  employeeListEl.innerHTML = sortedShifts.map((shift, index) => {
    const emp = registeredEmployees[shift.employeeId] || {
      name: 'Okänd',
      initials: '??',
      color: 'blue'
    };

    // Determine time display: "Ledig" for non-working types, actual time otherwise
    let timeDisplay = shift.time || '-';
    if (nonWorkingTypes.includes(shift.badge)) {
      timeDisplay = 'Ledig';
    }

    // Build badge HTML with icon toggle support
    const badgeHtml = renderBadgeWithToggle(shift);

    return `
      <div class="employee-card" style="animation-delay: ${index * 0.05}s" onclick="goToPersonSchedule('${shift.employeeId}')">
        <div class="employee-info">
          <div class="employee-name">${emp.name}</div>
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
  } else if (pageId === 'settings') {
    document.getElementById('settingsPage').classList.add('active');
    headerTitle.textContent = 'Inställningar';
  }

  closeSidebarMenu();
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
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  monthlyPage.classList.add('active');
  headerTitle.textContent = 'Schema';
  closeSidebarMenu();
  showPersonScheduleView(employeeId);
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

// Swedish holidays for 2026
function getSwedishHolidays2026() {
  return [
    { date: '2026-01-01', name: 'Nyårsdagen' },
    { date: '2026-01-06', name: 'Trettondedag jul' },
    { date: '2026-04-03', name: 'Långfredagen' },
    { date: '2026-04-04', name: 'Påskafton' },
    { date: '2026-04-05', name: 'Påskdagen' },
    { date: '2026-04-06', name: 'Annandag påsk' },
    { date: '2026-05-01', name: 'Första maj' },
    { date: '2026-05-14', name: 'Kristi himmelsfärdsdag' },
    { date: '2026-05-23', name: 'Pingstafton' },
    { date: '2026-05-24', name: 'Pingstdagen' },
    { date: '2026-06-06', name: 'Sveriges nationaldag' },
    { date: '2026-06-19', name: 'Midsommarafton' },
    { date: '2026-06-20', name: 'Midsommardagen' },
    { date: '2026-10-31', name: 'Alla helgons dag' },
    { date: '2026-12-24', name: 'Julafton' },
    { date: '2026-12-25', name: 'Juldagen' },
    { date: '2026-12-26', name: 'Annandag jul' },
    { date: '2026-12-31', name: 'Nyårsafton' }
  ];
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

  holidaysList.innerHTML = holidays.map(holiday => {
    const badge = getHolidayBadge(employeeId, holiday.date);
    const badgeHtml = badge
      ? `<span class="holiday-badge ${badge === 'FPV' ? 'fpv' : ''}">${badge}</span>`
      : '';

    return `
      <div class="holiday-item">
        <div class="holiday-info">
          <span class="holiday-name">${holiday.name}</span>
          <span class="holiday-date">${formatSwedishDate(holiday.date)}</span>
        </div>
        ${badgeHtml}
      </div>
    `;
  }).join('');

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

    calendarHTML += `
      <div class="schedule-day ${typeClass} ${todayClass}">
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

      if (d.shift) {
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

      daysHTML += `
        <div class="schedule-list-item ${typeClass} ${todayClass}">
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

// ==========================================
// FRIDAGSNYCKEL FUNCTIONS
// ==========================================

let fridagsSection, fridagsHeader, fridagEmployeeList;

/**
 * Initialize Fridagsnyckel UI elements
 */
function initFridagsUI() {
  fridagsSection = document.getElementById('fridagsSection');
  fridagsHeader = document.getElementById('fridagsHeader');
  fridagEmployeeList = document.getElementById('fridagEmployeeList');
}

/**
 * Toggle the collapsible fridagsnyckel section
 */
function toggleFridagsSection() {
  if (fridagsSection) {
    fridagsSection.classList.toggle('expanded');
    if (fridagsSection.classList.contains('expanded')) {
      renderFridagEmployeeList();
    }
  }
}

/**
 * Build dropdown options for fridagsnycklar
 * Grouped by type (TV/LF) and sorted
 */
function buildFridagKeyOptions() {
  const tvKeys = [];
  const lfKeys = [];

  for (const [key, data] of Object.entries(FRIDAG_KEYS)) {
    const option = { key, name: data.name, cycle: data.cycle };
    if (key.startsWith('TV')) {
      tvKeys.push(option);
    } else {
      lfKeys.push(option);
    }
  }

  // Sort by key name
  tvKeys.sort((a, b) => a.key.localeCompare(b.key));
  lfKeys.sort((a, b) => a.key.localeCompare(b.key));

  let options = '<option value="">-- Välj nyckel --</option>';
  options += '<optgroup label="Tågvärdar (TV)">';
  for (const opt of tvKeys) {
    options += `<option value="${opt.key}">${opt.key} - ${opt.name} (${opt.cycle}v)</option>`;
  }
  options += '</optgroup>';
  options += '<optgroup label="Lokförare (LF)">';
  for (const opt of lfKeys) {
    options += `<option value="${opt.key}">${opt.key} - ${opt.name} (${opt.cycle}v)</option>`;
  }
  options += '</optgroup>';

  return options;
}

/**
 * Build dropdown options for row numbers based on selected key
 */
function buildRowOptions(cycleSize) {
  let options = '<option value="">-- Välj rad --</option>';
  for (let i = 1; i <= cycleSize; i++) {
    options += `<option value="${i}">Rad ${i}</option>`;
  }
  return options;
}

/**
 * Handle fridagnyckel selection change - update row dropdown
 */
function onFridagKeyChange(employeeId, selectElement) {
  const selectedKey = selectElement.value;
  const rowSelect = document.getElementById(`fridag-row-${employeeId}`);

  if (!rowSelect) return;

  if (!selectedKey) {
    rowSelect.innerHTML = '<option value="">-- Välj nyckel först --</option>';
    rowSelect.disabled = true;
    return;
  }

  const keyData = FRIDAG_KEYS[selectedKey];
  if (keyData) {
    rowSelect.innerHTML = buildRowOptions(keyData.cycle);
    rowSelect.disabled = false;
  }
}

/**
 * Render the list of employees with fridagsnyckel controls (compact design)
 */
function renderFridagEmployeeList() {
  if (!fridagEmployeeList) return;

  const employees = getSortedEmployees();

  if (employees.length === 0) {
    fridagEmployeeList.innerHTML = `
      <div class="fridag-empty">
        <p>Inga anställda registrerade ännu.</p>
        <p>Ladda upp ett schema först.</p>
      </div>
    `;
    return;
  }

  const keyOptions = buildFridagKeyOptions();

  fridagEmployeeList.innerHTML = employees.map(emp => {
    // Get saved fridagsnyckel if any
    const savedKey = emp.fridagsnyckel || '';
    const savedRow = emp.fridagsrad || '';
    const keyData = savedKey ? FRIDAG_KEYS[savedKey] : null;
    const rowOptions = keyData ? buildRowOptions(keyData.cycle) : '<option value="">-- Välj nyckel först --</option>';
    const hasKey = savedKey && savedRow;

    // Status text - either "Välj fridagsnyckel" or "LFMC12 Rad 4"
    const statusText = hasKey
      ? `${savedKey} Rad ${savedRow}`
      : 'Välj fridagsnyckel';

    // If hasKey, row is locked (can't expand) - must remove first
    const rowClickable = !hasKey;
    const rowClass = hasKey ? 'fridag-employee-row locked' : 'fridag-employee-row';
    const rowOnClick = rowClickable ? `onclick="toggleFridagExpand('${emp.employeeId}')"` : '';

    return `
      <div class="fridag-employee-item compact ${hasKey ? '' : ''}" id="fridag-item-${emp.employeeId}">
        <div class="${rowClass}" ${rowOnClick}>
          <div class="fridag-employee-left">
            <div class="avatar ${emp.color}">${emp.initials}</div>
            <div class="fridag-employee-info">
              <span class="name">${emp.name}</span>
              <span class="fridag-key-status ${hasKey ? 'has-key' : 'no-key'}">
                ${statusText}
                ${!hasKey ? '<span class="expand-icon">▼</span>' : ''}
              </span>
            </div>
          </div>
          ${hasKey ? `
            <button class="fridag-remove-btn" onclick="event.stopPropagation(); confirmRemoveFridagsnyckel('${emp.employeeId}', '${emp.name}')" title="Ta bort fridagsnyckel">
              ✕
            </button>
          ` : ''}
        </div>
        ${!hasKey ? `
        <div class="fridag-expand-content" id="fridag-expand-${emp.employeeId}">
          <div class="fridag-selects">
            <div class="fridag-select-row">
              <label>Nyckel:</label>
              <select id="fridag-key-${emp.employeeId}" onchange="onFridagKeyChange('${emp.employeeId}', this)">
                ${keyOptions}
              </select>
            </div>
            <div class="fridag-select-row">
              <label>Rad:</label>
              <select id="fridag-row-${emp.employeeId}" disabled>
                <option value="">-- Välj nyckel först --</option>
              </select>
            </div>
          </div>
          <div class="fridag-actions">
            <button class="fridag-apply-btn" id="fridag-btn-${emp.employeeId}" onclick="applyFridagsnyckel('${emp.employeeId}')">
              Applicera
            </button>
          </div>
          <div class="fridag-status" id="fridag-status-${emp.employeeId}"></div>
        </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Toggle expand/collapse for a fridagsnyckel item
 */
function toggleFridagExpand(employeeId) {
  const item = document.getElementById(`fridag-item-${employeeId}`);
  if (item) {
    item.classList.toggle('expanded');
  }
}

/**
 * Show confirmation modal to remove fridagsnyckel
 */
function confirmRemoveFridagsnyckel(employeeId, employeeName) {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'fridag-modal-overlay';
  modal.id = 'fridagRemoveModal';
  modal.innerHTML = `
    <div class="fridag-modal">
      <div class="fridag-modal-header">
        <h3>Ta bort fridagsnyckel</h3>
      </div>
      <div class="fridag-modal-body">
        <p>Är du säker på att du vill ta bort <strong>${employeeName}s</strong> fridagsnyckel?</p>
        <p class="fridag-modal-note">FP/FPV-dagar från fridagsnyckeln tas bort. Uppladdade scheman bevaras.</p>
      </div>
      <div class="fridag-modal-footer">
        <button class="fridag-modal-btn cancel" onclick="closeFridagModal()">Avbryt</button>
        <button class="fridag-modal-btn confirm" onclick="removeFridagsnyckel('${employeeId}')">Ta bort</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeFridagModal();
  });
}

/**
 * Close the fridagsnyckel removal modal
 */
function closeFridagModal() {
  const modal = document.getElementById('fridagRemoveModal');
  if (modal) modal.remove();
}

/**
 * Remove fridagsnyckel from an employee
 */
async function removeFridagsnyckel(employeeId) {
  // Don't close modal - update it to show progress
  const modal = document.getElementById('fridagRemoveModal');
  const modalBody = modal?.querySelector('.fridag-modal-body');
  const modalFooter = modal?.querySelector('.fridag-modal-footer');

  try {
    // Get the employee's current fridagsnyckel to know which shifts to remove
    const employee = registeredEmployees[employeeId];
    if (!employee || !employee.fridagsnyckel) {
      throw new Error('Ingen fridagsnyckel att ta bort');
    }

    // Update modal to show progress
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="fridag-remove-progress">
          <p>Tar bort fridagar...</p>
          <div class="fridag-progress-bar">
            <div class="fridag-progress-fill" id="removeProgressFill"></div>
          </div>
          <p class="fridag-progress-text" id="removeProgressText">Förbereder...</p>
        </div>
      `;
    }
    if (modalFooter) {
      modalFooter.style.display = 'none';
    }

    // Progress callback to update modal
    const onProgress = (processed, total) => {
      const percent = Math.round((processed / total) * 100);
      const progressFill = document.getElementById('removeProgressFill');
      const progressText = document.getElementById('removeProgressText');
      if (progressFill) {
        progressFill.style.width = `${percent}%`;
      }
      if (progressText) {
        progressText.textContent = `${processed}/${total} (${percent}%)`;
      }
    };

    // Remove from Firebase and local data with progress
    await removeFridagShiftsFromFirebase(employeeId, onProgress);

    // Update local employee record
    delete registeredEmployees[employeeId].fridagsnyckel;
    delete registeredEmployees[employeeId].fridagsrad;

    // Show success briefly then close
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="fridag-remove-success">
          <p>✓ Fridagsnyckel borttagen!</p>
        </div>
      `;
    }

    // Close modal after short delay and refresh UI
    setTimeout(() => {
      closeFridagModal();
      renderEmployees();
      renderFridagEmployeeList();
    }, 800);

    console.log(`Fridagsnyckel removed for ${employeeId}`);
  } catch (error) {
    console.error('Error removing fridagsnyckel:', error);
    // Show error in modal
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="fridag-remove-error">
          <p>Ett fel uppstod: ${error.message}</p>
        </div>
      `;
    }
    if (modalFooter) {
      modalFooter.innerHTML = `
        <button class="fridag-modal-btn cancel" onclick="closeFridagModal()">Stäng</button>
      `;
      modalFooter.style.display = 'flex';
    }
  }
}

/**
 * Apply fridagsnyckel for an employee
 * Generates FP/FPV shifts from March 1, 2026 to Feb 28, 2027
 */
async function applyFridagsnyckel(employeeId) {
  const keySelect = document.getElementById(`fridag-key-${employeeId}`);
  const rowSelect = document.getElementById(`fridag-row-${employeeId}`);
  const btn = document.getElementById(`fridag-btn-${employeeId}`);
  const statusEl = document.getElementById(`fridag-status-${employeeId}`);

  const selectedKey = keySelect?.value;
  const selectedRow = parseInt(rowSelect?.value, 10);

  // Validate
  if (!selectedKey) {
    showFridagStatus(statusEl, 'Välj en fridagsnyckel', 'error');
    return;
  }
  if (!selectedRow) {
    showFridagStatus(statusEl, 'Välj en startrad', 'error');
    return;
  }

  const keyData = FRIDAG_KEYS[selectedKey];
  if (!keyData) {
    showFridagStatus(statusEl, 'Ogiltig nyckel', 'error');
    return;
  }

  // Show loading state
  btn.classList.add('loading');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.innerHTML = '<span class="progress-text">Förbereder...</span>';

  try {
    // Generate FP/FPV shifts
    const shifts = generateFridagShifts(employeeId, selectedKey, selectedRow);

    // Progress callback to update button text
    const onProgress = (processed, total) => {
      const percent = Math.round((processed / total) * 100);
      btn.innerHTML = `<span class="progress-text">${processed}/${total} (${percent}%)</span>`;
    };

    // Save to Firebase with progress updates
    await saveFridagShiftsToFirebase(employeeId, selectedKey, selectedRow, shifts, onProgress);

    // Update local data
    for (const shift of shifts) {
      if (!employeesData[shift.date]) {
        employeesData[shift.date] = [];
      }
      // Remove any existing FP/FPV for this employee on this date
      employeesData[shift.date] = employeesData[shift.date].filter(
        s => !(s.employeeId === employeeId && (s.badge === 'fp' || s.badge === 'fpv'))
      );
      // Add new shift
      employeesData[shift.date].push({
        employeeId,
        badge: shift.type.toLowerCase(),
        badgeText: shift.type,
        time: '-'
      });
    }

    // Update employee record
    if (registeredEmployees[employeeId]) {
      registeredEmployees[employeeId].fridagsnyckel = selectedKey;
      registeredEmployees[employeeId].fridagsrad = selectedRow;
    }

    // Refresh UI
    renderEmployees();
    renderFridagEmployeeList();

    showFridagStatus(statusEl, `${shifts.length} fridagar inlagda!`, 'success');
  } catch (error) {
    console.error('Error applying fridagsnyckel:', error);
    const errorMsg = error.message || error.toString();
    showFridagStatus(statusEl, `Fel: ${errorMsg}`, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Show status message for fridagsnyckel action
 */
function showFridagStatus(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.className = `fridag-status ${type}`;
  setTimeout(() => {
    element.className = 'fridag-status';
    element.textContent = '';
  }, 4000);
}

/**
 * Generate FP/FPV shifts based on fridagsnyckel
 * Note: FPV is excluded during summer months (June, July, August)
 * @returns Array of { date: 'YYYY-MM-DD', type: 'FP'|'FPV' }
 */
function generateFridagShifts(employeeId, keyId, startRow) {
  const keyData = FRIDAG_KEYS[keyId];
  if (!keyData) return [];

  const shifts = [];
  const startDate = new Date(FRIDAG_START_DATE);
  const endDate = new Date(FRIDAG_END_DATE);
  const cycle = keyData.cycle;

  // Summer months where FPV is excluded (June=5, July=6, August=7 in JS)
  const summerMonths = [5, 6, 7];

  // Day name mapping (JS getDay(): 0=Sun, 1=Mon, ... 6=Sat)
  const dayMap = {
    0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
  };

  // Find which week we start in (based on start date being week 1)
  let currentDate = new Date(startDate);
  let currentRow = startRow;

  // Calculate the Monday of the week containing startDate
  const startDayOfWeek = startDate.getDay();
  const daysToMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const weekStartDate = new Date(startDate);
  weekStartDate.setDate(weekStartDate.getDate() - daysToMonday);

  // Process week by week
  let weekStart = new Date(weekStartDate);

  while (weekStart <= endDate) {
    const pattern = keyData.pattern[currentRow];

    if (pattern) {
      // Go through each day of the week
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + dayOffset);

        // Check if date is within our range
        if (dayDate >= startDate && dayDate <= endDate) {
          const dayName = dayMap[dayDate.getDay()];
          const shiftType = pattern[dayName];

          if (shiftType) {
            // Skip FPV during summer months (June-August)
            const month = dayDate.getMonth();
            if (shiftType === 'FPV' && summerMonths.includes(month)) {
              // FPV excluded in summer - skip this shift
              continue;
            }

            const dateKey = getDateKey(dayDate);
            shifts.push({
              date: dateKey,
              type: shiftType
            });
          }
        }
      }
    }

    // Move to next week
    weekStart.setDate(weekStart.getDate() + 7);

    // Rotate to next row in cycle
    currentRow++;
    if (currentRow > cycle) {
      currentRow = 1;
    }
  }

  return shifts;
}
