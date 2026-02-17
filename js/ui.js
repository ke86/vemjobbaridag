/**
 * ui.js - Core UI Rendering Functions
 * Handles main DOM rendering and user interface updates
 *
 * Related files:
 * - ui-animations.js - Birthday & holiday animations
 * - ui-editors.js - Day editor & month picker
 * - ui-fridag.js - Fridagsnyckel functions
 * - ui-shadow.js - Shadow schedule (skuggschema)
 * - ui-realtime.js - Live train data, train/rast flip animations
 * - ui-upload.js - File upload, dagvy import, delete data
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
let prevDayBtn, nextDayBtn, currentDateEl, employeeListEl, showLedigaCheckbox, showRastCheckbox, showNextTrainCheckbox;
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

// ==========================================
// FILTER COOKIE HELPERS
// ==========================================

function setFilterCookie(name, value) {
  var d = new Date();
  d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
  document.cookie = name + '=' + value + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax';
}

function getFilterCookie(name) {
  var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? match[1] : null;
}

function saveFilterCookies() {
  if (showLedigaCheckbox) setFilterCookie('filter_lediga', showLedigaCheckbox.checked ? '1' : '0');
  if (showRastCheckbox) setFilterCookie('filter_rast', showRastCheckbox.checked ? '1' : '0');
  if (showNextTrainCheckbox) setFilterCookie('filter_tag', showNextTrainCheckbox.checked ? '1' : '0');
}

function restoreFilterCookies() {
  var lediga = getFilterCookie('filter_lediga');
  var rast = getFilterCookie('filter_rast');
  var tag = getFilterCookie('filter_tag');

  if (showLedigaCheckbox && lediga !== null) showLedigaCheckbox.checked = lediga === '1';
  if (showRastCheckbox && rast !== null) showRastCheckbox.checked = rast === '1';
  if (showNextTrainCheckbox && tag !== null) showNextTrainCheckbox.checked = tag === '1';
}

// ==========================================
// FILTER STYLE (flip / pill)
// ==========================================

function getFilterStyle() {
  return getFilterCookie('filter_style') || 'flip';
}

function setFilterStyle(style) {
  setFilterCookie('filter_style', style);
  applyFilterStyle(style);
}

function applyFilterStyle(style) {
  var bar = document.querySelector('.stats-bar');
  if (!bar) return;
  if (style === 'pill') {
    bar.classList.add('pill-mode');
  } else {
    bar.classList.remove('pill-mode');
  }
}

function initFilterStylePicker() {
  var picker = document.getElementById('filterStylePicker');
  if (!picker) return;
  var saved = getFilterStyle();
  // Set correct initial selection
  var btns = picker.querySelectorAll('.style-option');
  btns.forEach(function(btn) {
    btn.classList.toggle('selected', btn.getAttribute('data-style') === saved);
    btn.addEventListener('click', function() {
      btns.forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      setFilterStyle(btn.getAttribute('data-style'));
    });
  });
}

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
  employeeListEl = document.getElementById('employeeList');
  showLedigaCheckbox = document.getElementById('showLediga');
  showRastCheckbox = document.getElementById('showRast');
  showNextTrainCheckbox = document.getElementById('showNextTrain');

  // Restore toggle states from cookies
  restoreFilterCookies();

  // Filter style (flip/pill) – init picker + apply saved style
  initFilterStylePicker();
  applyFilterStyle(getFilterStyle());

  // Wake lock — keep screen awake
  initWakeLock();

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

// ==========================================
// BREAK (RAST) DATA FROM DAGVY
// ==========================================

const RLO_CITY_MAP = {
  'mcrlo': 'Malmö',
  'hbrlo': 'Helsingborg',
  'hdrlo': 'Halmstad',
  'hmrlo': 'Hässleholm',
  'ckrlo': 'Karlskrona',
  'kacrlo': 'Kalmar',
  'grlo': 'Göteborg',
  'crrlo': 'Kristianstad',
  'vörlo': 'Växjö'
};

// Fallback: station signature → city (for fromStation/toStation on rast segments)
const STATION_CITY_MAP = {
  'mc': 'Malmö', 'mal': 'Malmö', 'malmö': 'Malmö', 'malmö c': 'Malmö',
  'hb': 'Helsingborg', 'helsingborg': 'Helsingborg', 'helsingborg c': 'Helsingborg',
  'hd': 'Halmstad', 'halmstad': 'Halmstad', 'halmstad c': 'Halmstad',
  'hm': 'Hässleholm', 'hässleholm': 'Hässleholm', 'hässleholm c': 'Hässleholm',
  'ck': 'Karlskrona', 'karlskrona': 'Karlskrona', 'karlskrona c': 'Karlskrona',
  'kac': 'Kalmar', 'kalmar': 'Kalmar', 'kalmar c': 'Kalmar',
  'g': 'Göteborg', 'göteborg': 'Göteborg', 'göteborg c': 'Göteborg',
  'cr': 'Kristianstad', 'kristianstad': 'Kristianstad', 'kristianstad c': 'Kristianstad',
  'vö': 'Växjö', 'växjö': 'Växjö'
};

/**
 * Get break info for an employee from dagvy data.
 * Combines consecutive "Rast" and "Rasto" segments.
 * Finds city from: 1) *rlo activity segment, 2) fromStation on rast segment, 3) nearby segment stations
 * Returns { time: "12:00-12:45", city: "Malmö" } or null.
 */
function getBreakForEmployee(employeeId) {
  const emp = registeredEmployees[employeeId];
  if (!emp) return null;

  const normalizedName = normalizeName(emp.name);
  const dagvyDoc = dagvyAllData[normalizedName];
  if (!dagvyDoc || !dagvyDoc.days) return null;

  const dateKey = getDateKey(currentDate);
  const dayData = dagvyDoc.days.find(function(d) { return d.date === dateKey; });
  if (!dayData || !dayData.segments) return null;

  // Collect all rast segments and rlo segments
  const rastSegs = [];
  let rloCity = null;
  let rastSegIndices = [];

  for (let i = 0; i < dayData.segments.length; i++) {
    const seg = dayData.segments[i];
    const act = (seg.activity || '').trim();
    const actLower = act.toLowerCase();

    // Check for rlo location segment (activity ends with "rlo")
    if (actLower.endsWith('rlo')) {
      const mapped = RLO_CITY_MAP[actLower];
      if (mapped) {
        rloCity = mapped;
      }
    }

    // Check for Rast/Rasto segment
    if (actLower === 'rast' || actLower === 'rasto') {
      let startMin = null;
      let endMin = null;
      if (seg.timeStart) {
        const p = seg.timeStart.split(':');
        startMin = parseInt(p[0]) * 60 + parseInt(p[1]);
      }
      if (seg.timeEnd) {
        const p = seg.timeEnd.split(':');
        endMin = parseInt(p[0]) * 60 + parseInt(p[1]);
      }
      rastSegs.push({
        timeStart: seg.timeStart || '',
        timeEnd: seg.timeEnd || '',
        startMin: startMin,
        endMin: endMin,
        fromStation: seg.fromStation || '',
        toStation: seg.toStation || ''
      });
      rastSegIndices.push(i);
    }
  }

  if (rastSegs.length === 0) return null;

  // Helper: resolve a station name to a city via RLO_CITY_MAP or STATION_CITY_MAP
  function resolveCity(stationName) {
    if (!stationName) return null;
    const lower = stationName.toLowerCase().trim();
    if (!lower) return null;
    // Try rlo map first (e.g. "MCrlo" → Malmö)
    if (RLO_CITY_MAP[lower]) return RLO_CITY_MAP[lower];
    // Try station map (e.g. "MC" → Malmö)
    if (STATION_CITY_MAP[lower]) return STATION_CITY_MAP[lower];
    return null;
  }

  // Fallback 1: check fromStation/toStation on the rast segments themselves
  if (!rloCity) {
    for (const rs of rastSegs) {
      const fromCity = resolveCity(rs.fromStation);
      if (fromCity) { rloCity = fromCity; break; }
      const toCity = resolveCity(rs.toStation);
      if (toCity) { rloCity = toCity; break; }
    }
  }

  // Fallback 2: check segments immediately before/after the rast
  if (!rloCity && rastSegIndices.length > 0) {
    const firstIdx = rastSegIndices[0];
    const lastIdx = rastSegIndices[rastSegIndices.length - 1];
    // Check segment before first rast
    if (firstIdx > 0) {
      const prev = dayData.segments[firstIdx - 1];
      rloCity = resolveCity(prev.toStation);
    }
    // Check segment after last rast
    if (!rloCity && lastIdx < dayData.segments.length - 1) {
      const next = dayData.segments[lastIdx + 1];
      rloCity = resolveCity(next.fromStation);
    }
  }

  // Combine consecutive rast segments: earliest start → latest end
  let combinedStart = rastSegs[0].startMin;
  let combinedEnd = rastSegs[0].endMin;
  let combinedStartStr = rastSegs[0].timeStart;
  let combinedEndStr = rastSegs[0].timeEnd;

  for (let i = 1; i < rastSegs.length; i++) {
    const r = rastSegs[i];
    if (r.startMin !== null && (combinedStart === null || r.startMin < combinedStart)) {
      combinedStart = r.startMin;
      combinedStartStr = r.timeStart;
    }
    if (r.endMin !== null && (combinedEnd === null || r.endMin > combinedEnd)) {
      combinedEnd = r.endMin;
      combinedEndStr = r.timeEnd;
    }
  }

  const timeStr = combinedStartStr + '-' + combinedEndStr;
  return { time: timeStr, city: rloCity || '' };
}

/**
 * Get the next (or current) train segment for an employee from dagvy data.
 * Returns { trainNr, timeStart, timeEnd, fromStation, toStation, finished? } or null.
 * "Next" = nearest future train, or a train that started up to 60 min ago.
 * If all trains are done: returns last train with finished=true.
 */
function getNextTrainForEmployee(employeeId) {
  const emp = registeredEmployees[employeeId];
  if (!emp) return null;

  const normalizedName = normalizeName(emp.name);
  const dagvyDoc = dagvyAllData[normalizedName];
  if (!dagvyDoc || !dagvyDoc.days) return null;

  const dateKey = getDateKey(currentDate);
  const dayData = dagvyDoc.days.find(function(d) { return d.date === dateKey; });
  if (!dayData || !dayData.segments) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Collect all train segments with parsed times
  const trainSegs = [];
  for (const seg of dayData.segments) {
    let trainNr = null;
    if (seg.trainNr && seg.trainNr.length > 0) {
      trainNr = seg.trainNr.replace(/\s.*/g, '').trim();
    } else if (seg.activity && /^\d{3,5}(\s+\S+)*$/i.test(seg.activity.trim())) {
      trainNr = seg.activity.trim().replace(/\s.*/g, '').trim();
    }
    if (!trainNr) continue;

    let startMin = null;
    let endMin = null;
    if (seg.timeStart) {
      const p = seg.timeStart.split(':');
      startMin = parseInt(p[0]) * 60 + parseInt(p[1]);
    }
    if (seg.timeEnd) {
      const p = seg.timeEnd.split(':');
      endMin = parseInt(p[0]) * 60 + parseInt(p[1]);
    }

    trainSegs.push({
      trainNr: trainNr,
      timeStart: seg.timeStart || '',
      timeEnd: seg.timeEnd || '',
      startMin: startMin,
      endMin: endMin,
      fromStation: seg.fromStation || '',
      toStation: seg.toStation || ''
    });
  }

  if (trainSegs.length === 0) return null;

  // Only pick trains for "today" (not looking at past dates)
  const isViewingToday = (getDateKey(currentDate) === getDateKey(new Date()));

  if (!isViewingToday) {
    return trainSegs[0];
  }

  // Find current or next train:
  // 1. A train currently running (startMin <= now <= endMin)
  // 2. The next future train (startMin > now)
  // 3. A train that ended up to 60 min ago
  let currentTrain = null;
  let nextTrain = null;
  let recentTrain = null;

  for (const t of trainSegs) {
    if (t.startMin === null) continue;

    if (t.startMin <= nowMinutes && t.endMin !== null && t.endMin >= nowMinutes) {
      currentTrain = t;
      break;
    }
    if (t.startMin > nowMinutes && !nextTrain) {
      nextTrain = t;
    }
    if (t.endMin !== null && t.endMin < nowMinutes && (nowMinutes - t.endMin) <= 60) {
      recentTrain = t;
    }
  }

  if (currentTrain) return currentTrain;
  if (nextTrain) return nextTrain;
  if (recentTrain) return Object.assign({}, recentTrain, { finished: true });

  // All trains are done — return last train with finished flag
  const lastTrain = trainSegs[trainSegs.length - 1];
  if (lastTrain.endMin !== null && lastTrain.endMin < nowMinutes) {
    return Object.assign({}, lastTrain, { finished: true });
  }

  return trainSegs[0];
}

/**
 * Render badge with icon/turn number toggle OR live train badge
 * Mode depends on the "Nästa tåg" toggle checkbox
 */
function renderBadgeWithToggle(shift) {
  const turnStr = (shift.badgeText || '').toString().trim();
  const icons = getTurnIcons(turnStr);
  const trainMode = showNextTrainCheckbox ? showNextTrainCheckbox.checked : false;

  // Special badge types - always the same regardless of mode
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

  // === NÄSTA TÅG MODE ===
  if (trainMode) {
    const nextTrain = getNextTrainForEmployee(shift.employeeId);

    if (nextTrain) {
      if (nextTrain.finished) {
        // Finished for the day — show last train nr
        // Flip shows realtime delay at destination, fallback to "Ank HH:MM"
        const ankTime = nextTrain.timeEnd || '—';
        const destStation = nextTrain.toStation || '';
        return `
          <div class="train-live-badge train-finished" data-employee-id="${shift.employeeId}" data-train-nr="${nextTrain.trainNr}" data-finished="1" data-ank="${ankTime}" data-dest-station="${destStation}">
            <span class="train-live-nr">${nextTrain.trainNr}</span>
            <span class="train-live-delay">Ank ${ankTime}</span>
          </div>
        `;
      }
      return `
        <div class="train-live-badge" data-employee-id="${shift.employeeId}" data-train-nr="${nextTrain.trainNr}">
          <span class="train-live-nr">${nextTrain.trainNr}</span>
          <span class="train-live-delay"></span>
        </div>
      `;
    }

    // No dagvy data — grey dash
    return '<span class="badge train-no-data">—</span>';
  }

  // === TUR MODE (default) — show SE/DK icons with toggle ===
  if (icons.length === 0) {
    if (!turnStr) return '';
    return `<span class="badge dag">${turnStr}</span>`;
  }

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

/**
 * Determine an employee's shift status for the day.
 * Returns: 'active' | 'upcoming' | 'finished' | null
 *
 * Uses two strategies:
 *   1. Dagvy data (via getNextTrainForEmployee → finished flag)
 *   2. Fallback: parse shift start/end time from shift.time (e.g. "05:16-10:14")
 * Only returns a status when viewing today's date.
 */
function getEmployeeShiftStatus(shift) {
  // Only apply for today
  const isToday = getDateKey(currentDate) === getDateKey(new Date());
  if (!isToday) return null;

  // Non-working shifts have no status
  if (!shift.time || shift.time === '-' || shift.isBirthdayOnly || shift.isNameDayOnly) return null;
  if (nonWorkingTypes.includes(shift.badge)) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Strategy 1: Check dagvy data (most accurate — knows about all train segments)
  if (typeof getNextTrainForEmployee === 'function' && shift.employeeId) {
    const nextTrain = getNextTrainForEmployee(shift.employeeId);
    if (nextTrain && nextTrain.finished) return 'finished';
    if (nextTrain) return 'active'; // dagvy has trains, not finished → active
  }

  // Strategy 2: Fallback — parse shift times from "HH:MM-HH:MM" format
  const timeParts = (shift.time || '').split('-');
  if (timeParts.length >= 2) {
    const startStr = timeParts[0].trim();
    const endStr = timeParts[timeParts.length - 1].trim();
    const startMatch = startStr.match(/^(\d{1,2}):(\d{2})/);
    const endMatch = endStr.match(/^(\d{1,2}):(\d{2})/);

    if (startMatch && endMatch) {
      const startMinutes = parseInt(startMatch[1]) * 60 + parseInt(startMatch[2]);
      const endMinutes = parseInt(endMatch[1]) * 60 + parseInt(endMatch[2]);

      if (nowMinutes > endMinutes) return 'finished';
      if (nowMinutes < startMinutes) return 'upcoming';
      return 'active';
    }
  }

  return null;
}

// Backwards-compatible helper
function isEmployeeFinished(shift) {
  return getEmployeeShiftStatus(shift) === 'finished';
}

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
    let isWorking = true;
    if (shift.isBirthdayOnly || shift.isNameDayOnly) {
      timeDisplay = 'Ledig';
      isWorking = false;
    } else if (nonWorkingTypes.includes(shift.badge)) {
      timeDisplay = 'Ledig';
      isWorking = false;
    }

    // Get break info for working employees (gated by Rast toggle)
    let rastHtml = '';
    const showRast = showRastCheckbox ? showRastCheckbox.checked : true;
    if (showRast && isWorking && shift.employeeId) {
      const breakInfo = getBreakForEmployee(shift.employeeId);
      if (breakInfo && breakInfo.time) {
        const cityText = breakInfo.city || '';
        rastHtml = `<span class="rast-flip" data-rast-time="${breakInfo.time}" data-rast-city="${cityText}"><span class="rast-icon">🍽</span><span class="rast-time">${breakInfo.time}</span><span class="rast-city">${cityText}</span></span>`;
      }
    }

    // Build badge HTML with icon toggle support
    const badgeHtml = (shift.isBirthdayOnly || shift.isNameDayOnly) ? '' : renderBadgeWithToggle(shift);

    // "Uppdaterad" badge if schedule was updated from dagvy
    const updatedBadge = shift.updatedFromDagvy ? '<span class="dagvy-updated-badge">UPD</span>' : '';

    // Shift status: active / upcoming / finished (only for today)
    const shiftStatus = isWorking ? getEmployeeShiftStatus(shift) : null;
    if (shiftStatus === 'finished') cardClasses.push('employee-finished');
    else if (shiftStatus === 'active') cardClasses.push('employee-active');
    else if (shiftStatus === 'upcoming') cardClasses.push('employee-upcoming');
    const finishedLabel = shiftStatus === 'finished' ? '<span class="finished-label">✓ Slutat</span>' : '';

    const allClasses = cardClasses.join(' ');

    return `
      <div class="employee-card ${allClasses}" style="animation-delay: ${index * 0.05}s" onclick="showDagvyPopup('${shift.employeeId}')">
        <div class="employee-info">
          <div class="employee-name">${emp.name}${cakeHtml}${crownHtml}${updatedBadge}${finishedLabel}</div>
          <div class="employee-time">${timeDisplay}${rastHtml}</div>
        </div>
        <div class="employee-badge">
          ${badgeHtml}
        </div>
      </div>
    `;
  }).join('');

  // Start or stop realtime train polling based on toggle
  const trainMode = showNextTrainCheckbox ? showNextTrainCheckbox.checked : false;
  if (trainMode) {
    startTrainRealtimePolling();
    // Start flip timer for finished badges even before realtime data arrives
    const finishedBadges = document.querySelectorAll('.train-live-badge[data-finished="1"]');
    if (finishedBadges.length > 0 && !trainFlipTimer) {
      startTrainFlipTimer();
    }
  } else {
    stopTrainRealtimePolling();
  }

  // Start rast flip timer if there are any rast-flip elements
  const rastFlips = document.querySelectorAll('.rast-flip');
  if (rastFlips.length > 0) {
    startRastFlipTimer();
  } else {
    stopRastFlipTimer();
  }
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


// Count FP and FPV badges for an employee within the calendar year (Jan 1 - Dec 31)
function countFridagBadges(employeeId) {
  const currentYear = 2026;
  const startDate = new Date(currentYear, 0, 1);  // Jan 1, 2026
  const endDate = new Date(currentYear, 11, 31);  // Dec 31, 2026

  let fpCount = 0;
  let fpvCount = 0;
  let semCount = 0;

  // Loop through all dates in employeesData
  Object.entries(employeesData).forEach(([dateKey, dayShifts]) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // Check if date is within calendar year
    if (date >= startDate && date <= endDate) {
      dayShifts.forEach(shift => {
        if (shift.employeeId === employeeId) {
          // Check multiple fields for FP/FPV/Sem detection (handles legacy data)
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
          // Semester check
          else if (badge === 'semester' || badgeText === 'SEM' || badgeText === 'SEMESTER' || service === 'SEMESTER' || service === 'SEM') {
            semCount++;
          }
        }
      });
    }
  });

  return { fp: fpCount, fpv: fpvCount, sem: semCount };
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

    // Count FP/FPV/Sem for this employee
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
          <span class="fridag-count sem-count">Sem: ${fridagCount.sem}</span>
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
// WAKE LOCK — Håll skärmen vaken
// ==========================================

var _wakeLockSentinel = null;

function isWakeLockSupported() {
  return ('wakeLock' in navigator);
}

function requestWakeLock() {
  if (!isWakeLockSupported()) return;
  navigator.wakeLock.request('screen').then(function(sentinel) {
    _wakeLockSentinel = sentinel;
    _wakeLockSentinel.addEventListener('release', function() {
      _wakeLockSentinel = null;
    });
  }).catch(function() {
    // Wake lock request failed (low battery, background tab, etc.)
  });
}

function releaseWakeLock() {
  if (_wakeLockSentinel) {
    _wakeLockSentinel.release().then(function() {
      _wakeLockSentinel = null;
    }).catch(function() {
      _wakeLockSentinel = null;
    });
  }
}

function initWakeLock() {
  var toggle = document.getElementById('wakeLockToggle');
  if (!toggle) return;

  // Hide setting if not supported
  var settingsItem = toggle.closest('.settings-item');
  if (!isWakeLockSupported()) {
    if (settingsItem) settingsItem.style.display = 'none';
    return;
  }

  // Restore from cookie (default = ON)
  var saved = getFilterCookie('screen_wake_lock');
  if (saved === '0') {
    toggle.checked = false;
  } else {
    toggle.checked = true;
    requestWakeLock();
  }

  toggle.addEventListener('change', function() {
    if (toggle.checked) {
      setFilterCookie('screen_wake_lock', '1');
      requestWakeLock();
    } else {
      setFilterCookie('screen_wake_lock', '0');
      releaseWakeLock();
    }
  });

  // Re-acquire wake lock when returning to tab (browser releases on tab switch)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && toggle.checked) {
      requestWakeLock();
    }
  });
}

// ==========================================
// SHADOW SCHEDULE → moved to ui-shadow.js
// FILE UPLOAD & DELETE → moved to ui-upload.js
// LIVE TRAIN REALTIME & FLIP → moved to ui-realtime.js
// ==========================================
