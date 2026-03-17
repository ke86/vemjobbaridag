// ==========================================
// DAGVY (DAY VIEW) - DETAILED SHIFT INFO
// ==========================================

// Cache for dagvy data per employee
const dagvyCache = {};

// Global store for ALL dagvy data from Firebase listener
// Keyed by normalized employee name → full dagvy document
const dagvyAllData = {};

// Track if dagvy page is currently shown
let dagvyActive = false;
let dagvyPreviousTitle = '';
let dagvySimpleMode = false;
let dagvyCrewFilter = false; // false = Alla, true = Med dig
let dagvyCurrentData = null;
let dagvyCurrentName = '';

// Latest known dagvy scrapedAt timestamp
let dagvyLatestScrapedAt = null;

// ── Changelog — persistent change history ──
var _dagvyChangelog = [];
var _dagvyChangelogLoaded = false;

// Cookie keys for persisting toggle states
const DAGVY_MODE_COOKIE = 'dagvy_mode';   // "enkel" | "allt"
const DAGVY_CREW_COOKIE = 'dagvy_crew';   // "med" | "alla"

function dagvyReadCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function dagvyWriteCookie(name, value) {
  // Persist for 1 year
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
}

// ==========================================
// CHANGELOG — Persistent change history (IndexedDB)
// ==========================================

/**
 * Load changelog from IndexedDB. Called once at startup.
 * Auto-removes entries older than 30 days.
 */
function loadDagvyChangelog() {
  if (typeof loadSetting !== 'function') return Promise.resolve([]);
  return loadSetting('dagvyChangelog').then(function(val) {
    if (Array.isArray(val)) {
      _dagvyChangelog = val;
    }
    // Auto-cleanup: remove entries older than 30 days
    var thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    var before = _dagvyChangelog.length;
    _dagvyChangelog = _dagvyChangelog.filter(function(entry) {
      return entry.ts >= thirtyDaysAgo;
    });
    if (_dagvyChangelog.length < before) {
      console.log('[DAGVY-CHANGELOG] Auto-rensade ' + (before - _dagvyChangelog.length) + ' poster äldre än 30 dagar');
      _saveDagvyChangelog();
    }
    _dagvyChangelogLoaded = true;
    return _dagvyChangelog;
  }).catch(function() {
    _dagvyChangelogLoaded = true;
    return _dagvyChangelog;
  });
}

/**
 * Save changelog to IndexedDB.
 */
function _saveDagvyChangelog() {
  if (typeof saveSetting !== 'function') return;
  saveSetting('dagvyChangelog', _dagvyChangelog).catch(function(err) {
    console.log('[DAGVY-CHANGELOG] Save error: ' + (err.message || err));
  });
}

/**
 * Log a schedule change.
 * @param {string} employeeId
 * @param {string} name       Employee display name
 * @param {string} dateKey    YYYY-MM-DD the change applies to
 * @param {string} type       'tur' | 'tid' | 'tillagd' | 'konflikt'
 * @param {string} from       Old value (empty string for new entries)
 * @param {string} to         New value
 */
function _logDagvyChange(employeeId, name, dateKey, type, from, to) {
  // Avoid duplicate logs: skip if same employee+date+type+to already exists
  var now = Date.now();
  for (var i = _dagvyChangelog.length - 1; i >= 0; i--) {
    var prev = _dagvyChangelog[i];
    if (prev.employeeId === employeeId && prev.dateKey === dateKey &&
        prev.type === type && prev.to === to) {
      return; // duplicate, skip
    }
  }

  _dagvyChangelog.push({
    ts: now,
    employeeId: employeeId,
    name: name,
    dateKey: dateKey,
    type: type,
    from: from || '',
    to: to || ''
  });

  // Keep max 500 entries (trim oldest)
  if (_dagvyChangelog.length > 500) {
    _dagvyChangelog = _dagvyChangelog.slice(-500);
  }

  _saveDagvyChangelog();
}

// Load changelog on startup
loadDagvyChangelog();

// ==========================================
// DAGVY LOCALSTORAGE CACHE
// ==========================================
var DAGVY_CACHE_KEY = 'dagvy_cache';
var DAGVY_CACHE_MAX_AGE_DAYS = 3;

/**
 * Save current dagvyAllData + timestamp to localStorage.
 * Called after Firebase delivers new dagvy data.
 */
function saveDagvyToCache() {
  try {
    var payload = {
      savedAt: new Date().toISOString(),
      scrapedAt: dagvyLatestScrapedAt || null,
      data: dagvyAllData
    };
    localStorage.setItem(DAGVY_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Dagvy cache save failed:', e.message);
  }
}

/**
 * Load cached dagvy from localStorage.
 * Returns { savedAt, scrapedAt, data } or null if no cache / expired.
 */
function loadDagvyFromCache() {
  try {
    var raw = localStorage.getItem(DAGVY_CACHE_KEY);
    if (!raw) return null;
    var payload = JSON.parse(raw);
    if (!payload || !payload.data || !payload.savedAt) return null;

    // Check age — discard if older than 3 days
    var ageMs = Date.now() - new Date(payload.savedAt).getTime();
    var maxMs = DAGVY_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    if (ageMs > maxMs) {
      localStorage.removeItem(DAGVY_CACHE_KEY);
      return null;
    }
    return payload;
  } catch (e) {
    console.warn('Dagvy cache load failed:', e.message);
    return null;
  }
}

/**
 * Clean dagvy cache if older than 3 days.
 * Called at app startup.
 */
function cleanOldDagvyCache() {
  try {
    var raw = localStorage.getItem(DAGVY_CACHE_KEY);
    if (!raw) return;
    var payload = JSON.parse(raw);
    if (!payload || !payload.savedAt) {
      localStorage.removeItem(DAGVY_CACHE_KEY);
      return;
    }
    var ageMs = Date.now() - new Date(payload.savedAt).getTime();
    var maxMs = DAGVY_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    if (ageMs > maxMs) {
      localStorage.removeItem(DAGVY_CACHE_KEY);
      console.log('Dagvy cache cleaned (older than ' + DAGVY_CACHE_MAX_AGE_DAYS + ' days)');
    }
  } catch (e) {
    localStorage.removeItem(DAGVY_CACHE_KEY);
  }
}

/**
 * Update the dagvy timestamp display on the schedule page.
 * Called from firebase.js dagvy listener.
 * @param {string|null} scrapedAt - ISO string or similar from dagvy doc
 */
function updateDagvyTimestamp(scrapedAt) {
  // Keep the latest known timestamp
  if (scrapedAt && (!dagvyLatestScrapedAt || scrapedAt > dagvyLatestScrapedAt)) {
    dagvyLatestScrapedAt = scrapedAt;
  }

  var el = document.getElementById('dagvyTimestamp');
  if (!el) return;

  var ts = dagvyLatestScrapedAt;
  if (!ts) {
    el.textContent = '';
    return;
  }

  // Parse the timestamp and format nicely in Swedish
  try {
    var d = new Date(ts);
    if (isNaN(d.getTime())) {
      el.textContent = 'Dagvy uppdaterad: ' + ts;
      return;
    }
    var day = d.getDate();
    var monthIdx = d.getMonth();
    var months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    el.textContent = 'Dagvy uppdaterad ' + day + ' ' + months[monthIdx] + ' ' + h + ':' + m;
  } catch (err) {
    el.textContent = 'Dagvy uppdaterad: ' + ts;
  }
}

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
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    throw new Error('REST ' + resp.status + ': ' + resp.statusText);
  }
  throw new Error('REST 429: rate limited efter 3 försök');
}

/**
 * Normalize a name string: replace ALL unicode whitespace with regular space,
 * collapse multiple spaces, trim, and NFC normalize
 */
function normalizeName(str) {
  return str
    .normalize('NFC')
    .replace(/[\s\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Fetch dagvy data for a given employee name
 */
async function fetchDagvy(employeeName) {
  const normalizedSearch = normalizeName(employeeName);

  // Check cache first (cache for 5 minutes)
  const cached = dagvyCache[normalizedSearch];
  if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
    return cached.data;
  }

  // Method 1: REST API
  try {
    const restData = await fetchDagvyREST(employeeName.trim());
    if (restData) {
      dagvyCache[normalizedSearch] = { data: restData, timestamp: Date.now() };
      return restData;
    }
  } catch (restErr) {
    console.log('Dagvy REST error:', restErr.message);
  }

  // Method 2: Check in-memory dagvyAllData (already loaded at startup, zero reads)
  if (dagvyAllData[normalizedSearch]) {
    dagvyCache[normalizedSearch] = { data: dagvyAllData[normalizedSearch], timestamp: Date.now() };
    return dagvyAllData[normalizedSearch];
  }

  return null;
}

/**
 * Get Swedish weekday name from date
 */
function getSwedishWeekday(date) {
  const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
  return days[date.getDay()];
}

/**
 * Show dagvy as full page when clicking on an employee card
 */
async function showDagvyPopup(employeeId) {
  const emp = registeredEmployees[employeeId];
  if (!emp) return;

  dagvyActive = true;

  // Save current header title & update to weekday + date
  dagvyPreviousTitle = headerTitle.textContent;
  const weekday = getSwedishWeekday(currentDate);
  const dayNum = currentDate.getDate();
  const monthNum = currentDate.getMonth() + 1;
  headerTitle.textContent = weekday + ' ' + dayNum + '/' + monthNum;

  // Hide current page content, show dagvy page
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });

  // Create or get dagvy page container
  let dagvyPage = document.getElementById('dagvyPage');
  if (!dagvyPage) {
    dagvyPage = document.createElement('main');
    dagvyPage.className = 'dagvy-page page';
    dagvyPage.id = 'dagvyPage';
    document.querySelector('.main-content').parentNode.insertBefore(dagvyPage, document.querySelector('.main-content').nextSibling);
  }

  // Restore toggle states from cookies (instead of resetting to defaults)
  const savedMode = dagvyReadCookie(DAGVY_MODE_COOKIE);
  dagvySimpleMode = savedMode === 'enkel';
  const savedCrew = dagvyReadCookie(DAGVY_CREW_COOKIE);
  dagvyCrewFilter = savedCrew === 'med';
  dagvyCurrentData = null;
  dagvyCurrentName = emp.name;

  // Compute toggle CSS classes based on restored state
  const modeSwCls = dagvySimpleMode ? 'enkel-active' : 'allt-active';
  const enkelActive = dagvySimpleMode ? ' active' : '';
  const alltActive = dagvySimpleMode ? '' : ' active';
  const crewSwCls = dagvyCrewFilter ? 'med-active' : 'alla-active';
  const medActive = dagvyCrewFilter ? ' active' : '';
  const allaActive = dagvyCrewFilter ? '' : ' active';

  dagvyPage.classList.add('active');
  dagvyPage.innerHTML = `
    <div class="dagvy-person-bar">
      <div class="dagvy-person-info">
        <h2 class="dagvy-person-name">${emp.name}</h2>
        <div class="dagvy-person-turn">Hämtar turdata...</div>
      </div>
      <div class="dagvy-bar-actions">
        <div class="dagvy-toggles-stack">
          <div class="dagvy-mode-toggle" id="dagvyModeToggle" onclick="toggleDagvyMode()">
            <span class="dagvy-mode-label dagvy-mode-enkel${enkelActive}">Enkel</span>
            <div class="dagvy-mode-switch ${modeSwCls}">
              <div class="dagvy-mode-thumb"></div>
            </div>
            <span class="dagvy-mode-label dagvy-mode-allt${alltActive}">Allt</span>
          </div>
          <div class="dagvy-mode-toggle" id="dagvyCrewToggle" onclick="toggleDagvyCrewFilter()">
            <span class="dagvy-mode-label dagvy-crew-med${medActive}">Med dig</span>
            <div class="dagvy-mode-switch dagvy-crew-switch ${crewSwCls}">
              <div class="dagvy-mode-thumb"></div>
            </div>
            <span class="dagvy-mode-label dagvy-crew-alla${allaActive}">Alla</span>
          </div>
        </div>
        <button class="dagvy-close-btn" onclick="closeDagvy()">✕</button>
      </div>
    </div>
    <div class="dagvy-content" id="dagvyContent">
      <div class="dagvy-loading-state">
        <div class="dagvy-spinner"></div>
        <p>Laddar dagvy...</p>
      </div>
    </div>
    <div class="dagvy-bottom-bar">
      <div class="dagvy-bottom-btns">
        <button class="dagvy-btn dagvy-btn-schedule" onclick="closeDagvy(); goToPersonSchedule('${employeeId}')">
          📅 Schema
        </button>
        <button class="dagvy-btn dagvy-btn-changelog" id="dagvyChangelogBtn" onclick="showDagvyChangelog('${employeeId}')">
          📋 Ändringar <span class="dagvy-changelog-badge" id="dagvyChangelogBadge"></span>
        </button>
      </div>
    </div>
  `;

  // Fetch data
  const data = await fetchDagvy(emp.name);

  const contentEl = document.getElementById('dagvyContent');
  const turnEl = dagvyPage.querySelector('.dagvy-person-turn');
  if (!contentEl) return;

  if (!data || !data.days || data.days.length === 0) {
    if (turnEl) turnEl.textContent = 'Ingen dagvy hittades';
    contentEl.innerHTML = `
      <div class="dagvy-empty">
        <div class="dagvy-empty-icon">📋</div>
        <p>Ingen dagvy tillgänglig för ${emp.name}</p>
      </div>
    `;
    return;
  }

  // Find today's dagvy (match currentDate)
  const dateKey = getDateKey(currentDate);
  const todayDagvy = data.days.find(function(d) { return d.date === dateKey; });

  if (!todayDagvy || todayDagvy.notFound) {
    if (turnEl) turnEl.textContent = 'Ingen tur denna dag';

    // Check if person has a scheduled working shift (not already ledig)
    var schedShift = (employeesData[dateKey] || []).find(function(s) { return s.employeeId === employeeId; });
    var hasWorkingShift = schedShift && !nonWorkingTypes.includes(schedShift.badge);

    var emptyHtml = '<div class="dagvy-empty">';
    emptyHtml += '<div class="dagvy-empty-icon">📋</div>';

    if (hasWorkingShift) {
      emptyHtml += '<p class="dagvy-empty-title">Inget arbetspass hittat</p>';
      emptyHtml += '<p class="dagvy-empty-sub">Ledig? Välj typ nedan</p>';
      emptyHtml += '<div class="dagvy-ledig-chips">';
      var ledigTypes = [
        { type: 'fp', label: 'FP' },
        { type: 'fpv', label: 'FPV' },
        { type: 'semester', label: 'Sem' },
        { type: 'foraldraledighet', label: 'FL' },
        { type: 'sjuk', label: 'Sjuk' },
        { type: 'vab', label: 'VAB' },
        { type: 'komp', label: 'Komp' },
        { type: 'afd', label: 'AFD' },
        { type: 'ffu', label: 'FFU' }
      ];
      for (var li = 0; li < ledigTypes.length; li++) {
        var lt = ledigTypes[li];
        emptyHtml += '<button class="dagvy-ledig-chip" data-ledig-type="' + lt.type + '" ' +
          'onclick="dagvySetLedig(\'' + employeeId + '\',\'' + dateKey + '\',\'' + lt.type + '\',this)">' +
          lt.label + '</button>';
      }
      emptyHtml += '</div>';
    } else {
      emptyHtml += '<p>Ingen turdata för ' + formatDate(currentDate) + '</p>';
    }

    var availDates = data.days ? data.days.map(function(d) { return d.date; }).join(', ') : 'inga';
    emptyHtml += '<p class="dagvy-empty-sub dagvy-empty-dates">Tillgängliga dagar: ' + availDates + '</p>';
    emptyHtml += '</div>';
    contentEl.innerHTML = emptyHtml;
    return;
  }

  // Update turn info
  if (turnEl) {
    turnEl.innerHTML = 'Tur <strong>' + todayDagvy.turnr + '</strong> &middot; ' + todayDagvy.start + ' – ' + todayDagvy.end;

    // Show original schedule time/turn if dagvy changed them
    var shift = (employeesData[dateKey] || []).find(function(s) { return s.employeeId === employeeId; });
    if (shift) {
      var origParts = [];
      if (shift.originalBadgeText && shift.originalBadgeText !== shift.badgeText) {
        origParts.push('Tur ' + shift.originalBadgeText);
      }
      if (shift.originalTime && shift.originalTime !== shift.time) {
        origParts.push(shift.originalTime);
      }
      if (origParts.length > 0) {
        turnEl.innerHTML += '<span class="dagvy-original-info">Schema: ' + origParts.join(' · ') + '</span>';
      }
    }
  }

  // Show badge if data is from previous dagvy (smart merge)
  if (data.fromPrevious) {
    var badge = document.createElement('div');
    badge.className = 'dagvy-previous-badge';
    badge.textContent = '⏳ Från föregående dagvy';
    var personBar = dagvyPage.querySelector('.dagvy-person-bar');
    if (personBar) personBar.appendChild(badge);
  }

  // Show conflict warning if person is on non-working type but has dagvy
  var conflictShift = (employeesData[dateKey] || []).find(function(s) { return s.employeeId === employeeId; });
  if (conflictShift && conflictShift.dagvyConflict) {
    var badgeLabel = conflictShift.badge || 'ledig';
    var conflictBadge = document.createElement('div');
    conflictBadge.className = 'dagvy-conflict-notice';
    conflictBadge.textContent = '⚠️ Schemalagd som ' + badgeLabel.toUpperCase() + ' men har dagvy';
    var pBar = dagvyPage.querySelector('.dagvy-person-bar');
    if (pBar) pBar.appendChild(conflictBadge);
  }

  // Store for re-render on mode toggle
  dagvyCurrentData = todayDagvy;

  // Update schedule card if dagvy has different info
  updateScheduleFromDagvy(employeeId, todayDagvy, dateKey);

  // Build the dagvy content
  contentEl.innerHTML = buildDagvyContent(todayDagvy, emp.name, dagvySimpleMode);
  dagvyScrollToCurrent();

  // Update changelog badge count
  _updateDagvyChangelogBadge(employeeId);
}

/**
 * Look up start-end time for a turn number from TIL_TURN_TIMES / TIL_SHIFT_TIMES.
 * Returns "HH:MM-HH:MM" string or null if not found.
 */
function lookupTurnTime(turnr) {
  if (!turnr) return null;
  var key = turnr.trim();
  var keyUpper = key.toUpperCase();
  var match = null;
  if (typeof TIL_SHIFT_TIMES !== 'undefined' && TIL_SHIFT_TIMES[keyUpper]) {
    match = TIL_SHIFT_TIMES[keyUpper];
  } else if (typeof TIL_TURN_TIMES !== 'undefined') {
    match = TIL_TURN_TIMES[key] || TIL_TURN_TIMES[keyUpper] || null;
  }
  if (match && match.length >= 2) {
    return match[0] + '-' + match[1];
  }
  return null;
}

/**
 * Compare dagvy data with schedule and update if different
 */
function updateScheduleFromDagvy(employeeId, dayData, dateKey) {
  if (!dayData || !dayData.turnr || dayData.notFound) return;

  const allShifts = employeesData[dateKey];
  if (!allShifts) return;

  const shift = allShifts.find(function(s) { return s.employeeId === employeeId; });
  if (!shift) return;

  // Flag conflict if non-working type has dagvy data (don't overwrite schedule)
  if (nonWorkingTypes.includes(shift.badge)) {
    var dagvyTurnCheck = (dayData.turnr || '').trim();
    if (dagvyTurnCheck) {
      shift.dagvyConflict = true;
      shift.dagvyConflictTurn = dagvyTurnCheck;
      var dvTimeValid = dayData.start && dayData.start !== '-' && dayData.end && dayData.end !== '-';
      shift.dagvyConflictTime = dvTimeValid ? dayData.start + '-' + dayData.end : '';
      var conflictName = registeredEmployees[employeeId] ? registeredEmployees[employeeId].name : employeeId;
      console.log('[DAGVY-CONFLICT] ' + conflictName +
        ' has ' + shift.badge + ' but dagvy shows tur=' + dagvyTurnCheck);
      _logDagvyChange(employeeId, conflictName, dateKey, 'konflikt', shift.badge.toUpperCase(), dagvyTurnCheck);
      renderEmployees();
    }
    return;
  }

  const dagvyTurn = (dayData.turnr || '').trim();
  const dagvyTimeValid = dayData.start && dayData.start !== '-' && dayData.end && dayData.end !== '-';
  const dagvyTime = dagvyTimeValid ? dayData.start + '-' + dayData.end : '';
  const currentTurn = (shift.badgeText || '').trim();
  const currentTime = (shift.time || '').trim();

  // Update turn if dagvy has one and it differs (or current is missing)
  const turnChanged = dagvyTurn && dagvyTurn !== currentTurn;
  // Update time if dagvy has valid times and they differ (or current is missing)
  const timeChanged = dagvyTime && dagvyTime !== currentTime;

  if (!turnChanged && !timeChanged) return;

  // DEBUG: Log what's being updated
  var empName = registeredEmployees[employeeId] ? registeredEmployees[employeeId].name : employeeId;
  console.log('[DAGVY-UPDATE] ' + empName + ' dateKey=' + dateKey +
    ' | dagvyDate=' + (dayData.date || '?') +
    ' | turn: "' + currentTurn + '" → "' + dagvyTurn + '"' +
    ' | time: "' + currentTime + '" → "' + dagvyTime + '"' +
    ' | currentDate=' + getDateKey(currentDate));

  // Preserve original values before first overwrite
  if (turnChanged && !shift.hasOwnProperty('originalBadgeText')) {
    shift.originalBadgeText = currentTurn;
  }
  if (timeChanged && !shift.hasOwnProperty('originalTime')) {
    shift.originalTime = currentTime;
  }

  // Update the shift data + log changes
  if (turnChanged) {
    _logDagvyChange(employeeId, empName, dateKey, 'tur', currentTurn, dagvyTurn);
    shift.badgeText = dagvyTurn;
    // If dagvy didn't provide a new time, look up from TIL_TURN_TIMES / TIL_SHIFT_TIMES
    if (!timeChanged && dagvyTurn) {
      var lookupTime = lookupTurnTime(dagvyTurn);
      if (lookupTime) {
        if (!shift.hasOwnProperty('originalTime')) {
          shift.originalTime = currentTime;
        }
        _logDagvyChange(employeeId, empName, dateKey, 'tid', currentTime, lookupTime);
        shift.time = lookupTime;
        console.log('[DAGVY-LOOKUP] ' + empName + ' turn ' + dagvyTurn + ' → time from lookup: ' + lookupTime);
      }
    }
  }
  if (timeChanged) {
    _logDagvyChange(employeeId, empName, dateKey, 'tid', currentTime, dagvyTime);
    shift.time = dagvyTime;
  }
  shift.updatedFromDagvy = true;

  // Re-render the schedule list to reflect changes
  renderEmployees();
}

/**
 * Auto-update schedule from dagvy data (called by Firebase listener)
 * Maps employee name → employeeId, finds matching day, then updates schedule
 */
function applyDagvyToSchedule(empName, dagvyData) {
  if (!dagvyData || !dagvyData.days) return;

  // Find employeeId by name
  const normalizedName = normalizeName(empName);
  let employeeId = null;
  for (var id in registeredEmployees) {
    if (normalizeName(registeredEmployees[id].name) === normalizedName) {
      employeeId = id;
      break;
    }
  }
  if (!employeeId) return;

  // Check current date
  var dateKey = getDateKey(currentDate);
  var dayData = dagvyData.days.find(function(d) { return d.date === dateKey; });

  // DEBUG: Log dagvy matching
  var allDates = dagvyData.days.map(function(d) { return d.date; });
  console.log('[DAGVY-APPLY] ' + empName + ' | viewDate=' + dateKey +
    ' | matchFound=' + (dayData ? 'YES (' + dayData.date + ' tur=' + dayData.turnr + ')' : 'NO') +
    ' | dagvyDates=' + JSON.stringify(allDates));

  if (!dayData || dayData.notFound) return;

  // Check if employee has a shift — if not, create a virtual one from dagvy
  var allShifts = employeesData[dateKey];
  if (!allShifts) {
    employeesData[dateKey] = [];
    allShifts = employeesData[dateKey];
  }
  var existingShift = allShifts.find(function(s) { return s.employeeId === employeeId; });

  if (!existingShift) {
    // Create virtual shift from dagvy data
    var dagvyTurn = (dayData.turnr || '').trim();
    var dagvyTimeValid = dayData.start && dayData.start !== '-' && dayData.end && dayData.end !== '-';
    var dagvyTime = dagvyTimeValid ? dayData.start + '-' + dayData.end : '';
    var virtualTime = dagvyTime || lookupTurnTime(dagvyTurn) || '-';
    if (dagvyTurn) {
      var virtualShift = {
        employeeId: employeeId,
        badge: '',
        badgeText: dagvyTurn,
        time: virtualTime,
        addedFromDagvy: true,
        updatedFromDagvy: true
      };
      allShifts.push(virtualShift);
      _logDagvyChange(employeeId, empName, dateKey, 'tillagd', '', dagvyTurn + ' ' + virtualTime);
      console.log('[DAGVY-VIRTUAL] Created virtual shift for ' + empName +
        ' | tur=' + dagvyTurn + ' | tid=' + dagvyTime);
      renderEmployees();
      return;
    }
  }

  updateScheduleFromDagvy(employeeId, dayData, dateKey);
}

/**
 * Re-apply ALL dagvy corrections to current schedule data.
 * Called after schedule listener fires, so dagvy updates are never lost
 * due to timing (dagvy arriving before schedule).
 */
function reapplyDagvyCorrections() {
  var dateKey = getDateKey(currentDate);
  console.log('[DAGVY-REAPPLY] currentDate=' + currentDate.toString() + ' → dateKey=' + dateKey);
  var allShifts = employeesData[dateKey];
  if (!allShifts || allShifts.length === 0) return;

  var appliedAny = false;

  // Iterate all employees in dagvyAllData
  for (var normalizedName in dagvyAllData) {
    var dagvyDoc = dagvyAllData[normalizedName];
    if (!dagvyDoc || !dagvyDoc.days) continue;

    // Find matching employeeId
    var employeeId = null;
    for (var id in registeredEmployees) {
      if (normalizeName(registeredEmployees[id].name) === normalizedName) {
        employeeId = id;
        break;
      }
    }
    if (!employeeId) continue;

    // Find day data for current date
    var dayData = dagvyDoc.days.find(function(d) { return d.date === dateKey; });
    if (!dayData || dayData.notFound) continue;

    // Find the shift for this employee
    var shift = allShifts.find(function(s) { return s.employeeId === employeeId; });

    var dagvyTurn = (dayData.turnr || '').trim();
    var dagvyTimeValid = dayData.start && dayData.start !== '-' && dayData.end && dayData.end !== '-';
    var dagvyTime = dagvyTimeValid ? dayData.start + '-' + dayData.end : '';

    // No shift exists → create virtual shift from dagvy
    if (!shift) {
      if (dagvyTurn) {
        var virtualTime = dagvyTime || lookupTurnTime(dagvyTurn) || '-';
        var empDisplayName = registeredEmployees[employeeId] ? registeredEmployees[employeeId].name : normalizedName;
        allShifts.push({
          employeeId: employeeId,
          badge: '',
          badgeText: dagvyTurn,
          time: virtualTime,
          addedFromDagvy: true,
          updatedFromDagvy: true
        });
        appliedAny = true;
        _logDagvyChange(employeeId, empDisplayName, dateKey, 'tillagd', '', dagvyTurn + ' ' + virtualTime);
        console.log('[DAGVY-REAPPLY-VIRTUAL] Created virtual shift for ' + normalizedName +
          ' | tur=' + dagvyTurn + ' | tid=' + dagvyTime);
      }
      continue;
    }

    if (nonWorkingTypes.includes(shift.badge)) {
      if (dagvyTurn) {
        shift.dagvyConflict = true;
        shift.dagvyConflictTurn = dagvyTurn;
        shift.dagvyConflictTime = dagvyTime || '';
        appliedAny = true;
        var conflictDispName = registeredEmployees[employeeId] ? registeredEmployees[employeeId].name : normalizedName;
        _logDagvyChange(employeeId, conflictDispName, dateKey, 'konflikt', shift.badge.toUpperCase(), dagvyTurn);
      }
      continue;
    }

    var currentTurn = (shift.badgeText || '').trim();
    var currentTime = (shift.time || '').trim();

    var turnChanged = dagvyTurn && dagvyTurn !== currentTurn;
    var timeChanged = dagvyTime && dagvyTime !== currentTime;

    if (!turnChanged && !timeChanged) continue;

    // Preserve original values before first overwrite
    if (turnChanged && !shift.hasOwnProperty('originalBadgeText')) {
      shift.originalBadgeText = currentTurn;
    }
    if (timeChanged && !shift.hasOwnProperty('originalTime')) {
      shift.originalTime = currentTime;
    }

    var reapplyName = registeredEmployees[employeeId] ? registeredEmployees[employeeId].name : normalizedName;
    if (turnChanged) {
      _logDagvyChange(employeeId, reapplyName, dateKey, 'tur', currentTurn, dagvyTurn);
      shift.badgeText = dagvyTurn;
      // If dagvy didn't provide a new time, look up from TIL_TURN_TIMES / TIL_SHIFT_TIMES
      if (!timeChanged && dagvyTurn) {
        var lookupTime = lookupTurnTime(dagvyTurn);
        if (lookupTime) {
          if (!shift.hasOwnProperty('originalTime')) {
            shift.originalTime = currentTime;
          }
          _logDagvyChange(employeeId, reapplyName, dateKey, 'tid', currentTime, lookupTime);
          shift.time = lookupTime;
        }
      }
    }
    if (timeChanged) {
      _logDagvyChange(employeeId, reapplyName, dateKey, 'tid', currentTime, dagvyTime);
      shift.time = dagvyTime;
    }
    shift.updatedFromDagvy = true;
    appliedAny = true;
  }

  // Only re-render once if any corrections were applied
  if (appliedAny) {
    renderEmployees();
  }
}

/**
 * Toggle between Enkel/Allt dagvy modes and re-render
 */
function toggleDagvyMode() {
  dagvySimpleMode = !dagvySimpleMode;
  dagvyWriteCookie(DAGVY_MODE_COOKIE, dagvySimpleMode ? 'enkel' : 'allt');

  // Update switch visual
  const toggle = document.getElementById('dagvyModeToggle');
  if (toggle) {
    const sw = toggle.querySelector('.dagvy-mode-switch');
    const enkelLabel = toggle.querySelector('.dagvy-mode-enkel');
    const alltLabel = toggle.querySelector('.dagvy-mode-allt');
    if (dagvySimpleMode) {
      sw.classList.remove('allt-active');
      sw.classList.add('enkel-active');
      enkelLabel.classList.add('active');
      alltLabel.classList.remove('active');
    } else {
      sw.classList.remove('enkel-active');
      sw.classList.add('allt-active');
      enkelLabel.classList.remove('active');
      alltLabel.classList.add('active');
    }
  }

  // Re-render timeline
  if (dagvyCurrentData) {
    const contentEl = document.getElementById('dagvyContent');
    if (contentEl) {
      contentEl.innerHTML = buildDagvyContent(dagvyCurrentData, dagvyCurrentName, dagvySimpleMode);
      dagvyScrollToCurrent();
    }
  }
}

/**
 * Toggle between Med dig / Alla crew filter and re-render
 */
function toggleDagvyCrewFilter() {
  dagvyCrewFilter = !dagvyCrewFilter;
  dagvyWriteCookie(DAGVY_CREW_COOKIE, dagvyCrewFilter ? 'med' : 'alla');

  // Update switch visual
  const toggle = document.getElementById('dagvyCrewToggle');
  if (toggle) {
    const sw = toggle.querySelector('.dagvy-crew-switch');
    const medLabel = toggle.querySelector('.dagvy-crew-med');
    const allaLabel = toggle.querySelector('.dagvy-crew-alla');
    if (dagvyCrewFilter) {
      sw.classList.remove('alla-active');
      sw.classList.add('med-active');
      medLabel.classList.add('active');
      allaLabel.classList.remove('active');
    } else {
      sw.classList.remove('med-active');
      sw.classList.add('alla-active');
      medLabel.classList.remove('active');
      allaLabel.classList.add('active');
    }
  }

  // Re-render timeline
  if (dagvyCurrentData) {
    const contentEl = document.getElementById('dagvyContent');
    if (contentEl) {
      contentEl.innerHTML = buildDagvyContent(dagvyCurrentData, dagvyCurrentName, dagvySimpleMode);
      dagvyScrollToCurrent();
    }
  }
}

/**
 * Scroll dagvy content so the current segment is visible.
 */
function dagvyScrollToCurrent() {
  setTimeout(function() {
    const el = document.querySelector('.dagvy-seg-current');
    if (!el) return;
    const contentEl = document.getElementById('dagvyContent');
    if (!contentEl) return;
    const containerRect = contentEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // Scroll so current segment is roughly 1/3 from top of visible area
    const targetOffset = containerRect.height * 0.3;
    const delta = elRect.top - containerRect.top - targetOffset;
    contentEl.scrollTop = Math.max(0, contentEl.scrollTop + delta);
  }, 100);
}

/**
 * Check if an activity string looks like a train number
 * e.g. "11002 m1", "1071 m1", "845", "20160", "1007 tv", "1039 tv ags"
 */
function isTrainLikeActivity(activity) {
  if (!activity) return false;
  return /^\d{3,5}(\s+\S+)*$/i.test(activity.trim());
}

/**
 * Check if a segment should be shown in "Enkel" (simple) mode
 * Keeps: Tåg (med och utan trainNr), Passresa, Reserv (all forms), Rast/Rasto
 */
function isSimpleSegment(seg) {
  // Trains with trainNr field
  if (seg.trainNr && seg.trainNr.length > 0) return true;

  const act = (seg.activity || '').toLowerCase();

  // Train-like activities (e.g. "11002 m1", "1071 m1")
  if (isTrainLikeActivity(seg.activity)) return true;

  // Rast and Rasto
  if (act.includes('rast')) return true;

  // Passresa
  if (act.includes('passresa')) return true;

  // Reserv (all forms)
  if (act.includes('reserv')) return true;

  return false;
}

/**
 * Build dagvy HTML content from a day's data
 * Layout: Time | Route/Activity | TrainNr — all on one row
 * Crew expands directly under the train row
 * @param {boolean} simpleMode - If true, only show key segments
 */
function buildDagvyContent(dayData, employeeName, simpleMode) {
  let html = '';

  // Build a crew lookup by trainNr for inline expansion
  const crewByTrain = {};
  if (dayData.crews) {
    for (const trainCrew of dayData.crews) {
      if (!trainCrew.trainNr) continue;
      crewByTrain[trainCrew.trainNr] = trainCrew;
    }
  }

  // Compute current time for "du är här" marking (only for today)
  const isToday = (getDateKey(currentDate) === getDateKey(new Date()));
  const now = new Date();
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1;
  let foundCurrent = false;

  if (dayData.segments && dayData.segments.length > 0) {
    html += '<div class="dagvy-timeline">';

    for (const seg of dayData.segments) {
      // Filter in simple mode
      if (simpleMode && !isSimpleSegment(seg)) continue;

      const isTrain = seg.trainNr && seg.trainNr.length > 0;
      const isActivityTrain = !isTrain && isTrainLikeActivity(seg.activity);
      const isAnyTrain = isTrain || isActivityTrain;
      const isPassresa = (seg.trainType === 'Passresa') || (!isTrain && (seg.activity || '').toLowerCase().indexOf('passresa') !== -1);
      const isRast = seg.activity && (seg.activity.includes('Rast') || seg.activity === 'Rasto');
      const isGang = seg.activity === 'Gångtid';

      let segClass = 'dagvy-seg-activity';
      if (isPassresa) segClass = 'dagvy-seg-passresa';
      else if (isAnyTrain) segClass = 'dagvy-seg-train';
      else if (isRast) segClass = 'dagvy-seg-rast';
      else if (isGang) segClass = 'dagvy-seg-gang';

      // "Du är här" time-based classification
      let timeClass = '';
      if (nowMin >= 0 && seg.timeStart && seg.timeEnd) {
        const sp = seg.timeStart.split(':');
        const ep = seg.timeEnd.split(':');
        const segStart = parseInt(sp[0]) * 60 + parseInt(sp[1]);
        const segEnd = parseInt(ep[0]) * 60 + parseInt(ep[1]);
        if (segEnd <= nowMin) {
          timeClass = ' dagvy-seg-passed';
        } else if (segStart <= nowMin && nowMin < segEnd && !foundCurrent) {
          timeClass = ' dagvy-seg-current';
          foundCurrent = true;
        }
      }
      segClass += timeClass;

      const route = (seg.fromStation !== seg.toStation)
        ? seg.fromStation + ' → ' + seg.toStation
        : seg.fromStation;

      // Determine the train number to display
      const displayTrainNr = isTrain ? seg.trainNr : (isActivityTrain ? seg.activity.trim() : '');

      // Check if this train has crew data
      const hasCrew = isTrain && crewByTrain[seg.trainNr];
      const clickAttr = hasCrew ? 'onclick="this.classList.toggle(\'crew-open\')"' : '';
      const clickableClass = hasCrew ? ' dagvy-seg-clickable' : '';

      // Build row: Time | Route/Activity | TrainNr
      let middleHtml = '';
      let trainBadgeHtml = '';

      if (isAnyTrain || isPassresa) {
        middleHtml = '<span class="dagvy-seg-route-text">' + route + '</span>';
        let typePrefix = '';
        if (seg.trainType === 'Växling') typePrefix = 'VXL ';
        else if (isPassresa) typePrefix = 'PASS ';
        const badgeContent = (typePrefix + displayTrainNr).trim();
        const badgeClass = isPassresa ? 'dagvy-train-badge dagvy-badge-pass' : 'dagvy-train-badge';
        trainBadgeHtml = '<span class="' + badgeClass + '">' + badgeContent + '</span>';
        if (hasCrew) {
          trainBadgeHtml += '<span class="dagvy-seg-crew-hint">👥 ›</span>';
        }
      } else {
        // Rename Rast/Rasto for display
        let activityDisplay = seg.activity || '–';
        if (seg.activity === 'Rasto') activityDisplay = 'Rast obetald';
        else if (seg.activity === 'Rast') activityDisplay = 'Rast betald';

        middleHtml = '<span class="dagvy-seg-activity-text">' + activityDisplay + '</span>';
        if (route && seg.activity !== route) {
          middleHtml += '<span class="dagvy-seg-station-text">' + route + '</span>';
        }

        // Show duration in minutes for rast segments
        if (isRast && seg.timeStart && seg.timeEnd) {
          var startParts = seg.timeStart.split(':');
          var endParts = seg.timeEnd.split(':');
          var mins = (parseInt(endParts[0]) * 60 + parseInt(endParts[1]))
                   - (parseInt(startParts[0]) * 60 + parseInt(startParts[1]));
          if (mins > 0) {
            trainBadgeHtml = '<span class="dagvy-rast-minutes">' + mins + ' min</span>';
          }
        }
      }

      // Build inline crew HTML
      let crewHtml = '';
      if (hasCrew) {
        const trainCrew = crewByTrain[seg.trainNr];
        crewHtml += '<div class="dagvy-inline-crew">';

        if (trainCrew.vehicles && trainCrew.vehicles.length > 0) {
          crewHtml += '<div class="dagvy-inline-vehicles">' + trainCrew.vehicles.join(' · ') + '</div>';
        }

        // Group by unique persons
        const personMap = {};
        for (const c of trainCrew.crew) {
          const key = c.name;
          if (!personMap[key]) {
            personMap[key] = { ...c, legs: [] };
          }
          personMap[key].legs.push({ from: c.fromStation, to: c.toStation, start: c.timeStart, end: c.timeEnd });
        }

        // Determine overlap with owner's segment time
        const ownerStart = seg.timeStart;
        const ownerEnd = seg.timeEnd;
        const persons = Object.values(personMap).map(function(person) {
          const isMe = normalizeName(person.name) === normalizeName(employeeName);
          // Check if any of person's legs overlap with owner's segment
          const overlaps = person.legs.some(function(l) {
            return l.start < ownerEnd && l.end > ownerStart;
          });
          return { person: person, isMe: isMe, overlaps: overlaps };
        });

        // Sort: owner first, then overlapping, then rest
        persons.sort(function(a, b) {
          if (a.isMe && !b.isMe) return -1;
          if (!a.isMe && b.isMe) return 1;
          if (a.overlaps && !b.overlaps) return -1;
          if (!a.overlaps && b.overlaps) return 1;
          return 0;
        });

        // In "Med dig" mode, filter to only owner + overlapping
        const visiblePersons = dagvyCrewFilter
          ? persons.filter(function(p) { return p.isMe || p.overlaps; })
          : persons;

        let hasAddedSeparator = false;
        for (const entry of visiblePersons) {
          const person = entry.person;
          const isMe = entry.isMe;
          const overlaps = entry.overlaps;
          const isDimmed = !isMe && !overlaps;

          // Add separator before "Övrig bemanning" group
          if (isDimmed && !hasAddedSeparator && !dagvyCrewFilter) {
            crewHtml += '<div class="dagvy-crew-separator">Övrig bemanning</div>';
            hasAddedSeparator = true;
          }

          const roleBadge = person.role === 'Lokförare'
            ? '<span class="dagvy-role-badge dagvy-role-lf">LF</span>'
            : '<span class="dagvy-role-badge dagvy-role-tv">TV</span>';
          const legSummary = person.legs.map(function(l) { return l.from + '→' + l.to; }).join(', ');
          const timeRange = person.legs[0].start + '–' + person.legs[person.legs.length - 1].end;

          const dimClass = isDimmed ? ' dagvy-crew-dimmed' : '';
          crewHtml += '<div class="dagvy-crew-person ' + (isMe ? 'dagvy-crew-me' : '') + dimClass + '">'
            + '<div class="dagvy-crew-person-main">'
            + roleBadge
            + '<span class="dagvy-crew-name">' + person.name + '</span>'
            + (person.phone ? '<a href="tel:' + person.phone + '" class="dagvy-crew-phone" onclick="event.stopPropagation()">📞</a>' : '')
            + '</div>'
            + '<div class="dagvy-crew-person-detail">'
            + '<span class="dagvy-crew-time">' + timeRange + '</span>'
            + '<span class="dagvy-crew-leg">' + legSummary + '</span>'
            + '</div>'
            + '</div>';
        }
        crewHtml += '</div>';
      }

      // Build Danish stops HTML if this train segment touches Hie (Hyllie)
      let dkStopsHtml = '';
      if (isAnyTrain && typeof denmark !== 'undefined') {
        const tnr = isTrain ? seg.trainNr : (seg.activity || '').trim().split(/\s+/)[0];
        if (tnr && denmark.hasDanishData(tnr)) {
          const fromLower = (seg.fromStation || '').toLowerCase();
          const toLower = (seg.toStation || '').toLowerCase();
          const touchesHie = fromLower === 'hie' || toLower === 'hie'
            || fromLower === 'hyllie' || toLower === 'hyllie';
          if (touchesHie) {
            const dkInfo = denmark.getDanishStops(tnr);
            if (dkInfo && dkInfo.stops.length > 0) {
              const paxStops = dkInfo.stops.filter(function(s) { return s.pax; });
              if (paxStops.length > 0) {
                const dkFirst = paxStops[0];
                const dkLast = paxStops[paxStops.length - 1];
                const dkRoute = dkFirst.name + ' → ' + dkLast.name;
                dkStopsHtml += '<div class="dagvy-dk-section">'
                  + '<div class="dagvy-dk-header" onclick="this.parentElement.classList.toggle(\'dk-open\'); event.stopPropagation();">'
                  + '<span class="dagvy-dk-flag">🇩🇰</span>'
                  + '<span class="dagvy-dk-route">' + dkRoute + '</span>'
                  + '<span class="dagvy-dk-chevron">›</span>'
                  + '</div>'
                  + '<div class="dagvy-dk-stops">';
                for (const ds of paxStops) {
                  dkStopsHtml += '<div class="dagvy-dk-row">'
                    + '<span class="dagvy-dk-station">' + ds.name + '</span>'
                    + '<span class="dagvy-dk-times">'
                    + (ds.arr ? '<span class="dagvy-dk-arr">' + ds.arr + '</span>' : '')
                    + (ds.dep ? '<span class="dagvy-dk-dep">' + ds.dep + '</span>' : '')
                    + '</span>'
                    + '</div>';
                }
                dkStopsHtml += '</div></div>';
              }
            }
          }
        }
      }

      // Time display: simple mode shows start–end, allt mode shows only start
      const timeHtml = simpleMode
        ? seg.timeStart + '<span class="dagvy-seg-time-sep">–</span>' + seg.timeEnd
        : seg.timeStart;

      html += '<div class="dagvy-seg ' + segClass + clickableClass + '" ' + clickAttr + '>'
        + '<div class="dagvy-seg-time' + (simpleMode ? ' dagvy-seg-time-full' : '') + '">' + timeHtml + '</div>'
        + '<div class="dagvy-seg-middle">' + middleHtml + '</div>'
        + '<div class="dagvy-seg-right">' + trainBadgeHtml + '</div>'
        + crewHtml
        + dkStopsHtml
        + '</div>';
    }

    html += '</div>';
  }

  return html;
}

/**
 * Set a ledig type from the dagvy "not found" suggestion.
 * Saves the leave type to the schedule and updates UI.
 */
async function dagvySetLedig(employeeId, dateKey, ledigType, btnEl) {
  // Visual feedback: highlight selected chip, dim others
  var allChips = document.querySelectorAll('.dagvy-ledig-chip');
  for (var i = 0; i < allChips.length; i++) {
    allChips[i].classList.remove('dagvy-ledig-selected');
    allChips[i].disabled = true;
  }
  if (btnEl) btnEl.classList.add('dagvy-ledig-selected');

  // Build shift entry
  var badgeText = '';
  var typeMap = {
    'fp': 'FP', 'fpv': 'FPV', 'semester': 'Semester',
    'foraldraledighet': 'Föräldraledighet', 'sjuk': 'Sjuk',
    'vab': 'VAB', 'komp': 'Komp', 'afd': 'AFD', 'ffu': 'FFU'
  };
  badgeText = typeMap[ledigType] || ledigType.toUpperCase();

  var newShift = {
    employeeId: employeeId,
    badge: ledigType,
    badgeText: badgeText,
    time: '-',
    edited: true
  };

  try {
    // Save to Firebase
    if (typeof saveDayEditToFirebase === 'function') {
      await saveDayEditToFirebase(dateKey, employeeId, newShift);
    }

    // Update local data
    if (!employeesData[dateKey]) employeesData[dateKey] = [];
    employeesData[dateKey] = employeesData[dateKey].filter(function(s) { return s.employeeId !== employeeId; });
    employeesData[dateKey].push(newShift);

    // Refresh main view
    if (typeof renderEmployees === 'function') renderEmployees();

    // Show confirmation in dagvy
    var emptyEl = document.querySelector('.dagvy-empty');
    if (emptyEl) {
      emptyEl.innerHTML =
        '<div class="dagvy-empty-icon">✅</div>' +
        '<p>Ändrad till <strong>' + badgeText + '</strong></p>' +
        '<p class="dagvy-empty-sub">Schemat är uppdaterat</p>';
    }

    if (typeof showToast === 'function') showToast('Satt som ' + badgeText, 'success');
  } catch (err) {
    console.error('[DAGVY] Error setting ledig:', err);
    if (typeof showToast === 'function') showToast('Kunde inte spara: ' + err.message, 'error');
    // Re-enable chips on error
    for (var j = 0; j < allChips.length; j++) {
      allChips[j].disabled = false;
    }
  }
}

/**
 * Close dagvy page and return to schedule view
 */
function closeDagvy() {
  dagvyActive = false;

  // Remove dagvy page
  const dagvyPage = document.getElementById('dagvyPage');
  if (dagvyPage) {
    dagvyPage.classList.remove('active');
    dagvyPage.innerHTML = '';
  }

  // Restore header title
  headerTitle.textContent = 'Vem jobbar idag?';

  // Re-show schedule page
  schedulePage.classList.add('active');
}

// =============================================
// CHANGELOG — Badge + placeholder view
// =============================================

/**
 * Count changelog entries for a specific employee.
 * Safe fallback: returns 0 if _dagvyChangelog is not yet defined (Del 1).
 */
function _getDagvyChangeCount(employeeId) {
  if (typeof _dagvyChangelog === 'undefined' || !Array.isArray(_dagvyChangelog)) return 0;
  var count = 0;
  for (var i = 0; i < _dagvyChangelog.length; i++) {
    if (_dagvyChangelog[i].employeeId === employeeId) count++;
  }
  return count;
}

/**
 * Update the changelog badge in the dagvy bottom bar.
 */
function _updateDagvyChangelogBadge(employeeId) {
  var badge = document.getElementById('dagvyChangelogBadge');
  var btn = document.getElementById('dagvyChangelogBtn');
  if (!badge || !btn) return;

  var count = _getDagvyChangeCount(employeeId);
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
    btn.classList.add('dagvy-btn-changelog-active');
  } else {
    badge.textContent = '';
    badge.style.display = 'none';
    btn.classList.remove('dagvy-btn-changelog-active');
  }
}

/**
 * Show changelog view for a specific employee.
 * Replaces dagvy content with a grouped, chronological changelog.
 */
function showDagvyChangelog(employeeId) {
  var contentEl = document.getElementById('dagvyContent');
  if (!contentEl) return;

  var count = _getDagvyChangeCount(employeeId);

  if (count === 0) {
    contentEl.innerHTML =
      '<div class="dagvy-changelog-list">' +
        '<div class="dagvy-changelog-back" onclick="_dagvyChangelogBack(\'' + employeeId + '\')">' +
          '← Tillbaka till dagvy' +
        '</div>' +
        '<div class="dagvy-empty" style="padding-top:32px;">' +
          '<div class="dagvy-empty-icon">📋</div>' +
          '<p>Inga ändringar registrerade</p>' +
          '<p class="dagvy-empty-sub">Ändringar loggas när dagvy uppdaterar schemat</p>' +
        '</div>' +
      '</div>';
    return;
  }

  // Collect changes for this employee
  var changes = [];
  for (var i = 0; i < _dagvyChangelog.length; i++) {
    if (_dagvyChangelog[i].employeeId === employeeId) {
      changes.push(_dagvyChangelog[i]);
    }
  }

  // Sort newest first
  changes.sort(function(a, b) { return b.ts - a.ts; });

  var dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

  var html = '<div class="dagvy-changelog-list">';
  html += '<div class="dagvy-changelog-back" onclick="_dagvyChangelogBack(\'' + employeeId + '\')">' +
    '← Tillbaka till dagvy</div>';
  html += '<div class="dagvy-changelog-header">📋 Ändringar (' + changes.length + ')</div>';

  var lastDateLabel = '';
  for (var c = 0; c < changes.length; c++) {
    var ch = changes[c];
    var d = new Date(ch.ts);
    var dateLabel = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    var dayName = dayNames[d.getDay()];
    var timeLabel = String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');

    // Group header by detection date
    if (dateLabel !== lastDateLabel) {
      html += '<div class="dagvy-changelog-date">' + dayName + ' ' + dateLabel + '</div>';
      lastDateLabel = dateLabel;
    }

    // Icon + description per type
    var icon = '';
    var desc = '';
    var entryClass = 'dagvy-changelog-entry';
    if (ch.type === 'tur') {
      icon = '🔄';
      desc = '<span class="dagvy-cl-label">Tur</span> ' +
        '<span class="dagvy-cl-from">' + ch.from + '</span>' +
        ' <span class="dagvy-cl-arrow">→</span> ' +
        '<span class="dagvy-cl-to">' + ch.to + '</span>';
    } else if (ch.type === 'tid') {
      icon = '🕐';
      desc = '<span class="dagvy-cl-label">Tid</span> ' +
        '<span class="dagvy-cl-from">' + ch.from + '</span>' +
        ' <span class="dagvy-cl-arrow">→</span> ' +
        '<span class="dagvy-cl-to">' + ch.to + '</span>';
    } else if (ch.type === 'tillagd') {
      icon = '➕';
      desc = '<span class="dagvy-cl-label">Nytt pass</span> ' +
        '<span class="dagvy-cl-to">' + ch.to + '</span>';
      entryClass += ' dagvy-changelog-added';
    } else if (ch.type === 'konflikt') {
      icon = '⚠️';
      desc = '<span class="dagvy-cl-label">Konflikt</span> ' +
        '<span class="dagvy-cl-from">' + ch.from + '</span>' +
        ' men dagvy visar <span class="dagvy-cl-to">' + ch.to + '</span>';
      entryClass += ' dagvy-changelog-conflict';
    } else {
      icon = '📝';
      desc = ch.type + ': ' + ch.from + ' → ' + ch.to;
    }

    // Show which date the change applies to (if different from detection date)
    var appliesTo = '';
    if (ch.dateKey && ch.dateKey !== dateLabel) {
      appliesTo = '<span class="dagvy-cl-applies">gäller ' + ch.dateKey + '</span>';
    }

    html += '<div class="' + entryClass + '">' +
      '<span class="dagvy-changelog-icon">' + icon + '</span>' +
      '<div class="dagvy-changelog-content">' +
        '<div class="dagvy-changelog-desc">' + desc + '</div>' +
        '<div class="dagvy-changelog-meta">' +
          '<span class="dagvy-changelog-time">' + timeLabel + '</span>' +
          appliesTo +
        '</div>' +
      '</div>' +
    '</div>';
  }

  html += '</div>';
  contentEl.innerHTML = html;
}

/**
 * Return from changelog view to dagvy content.
 */
function _dagvyChangelogBack(employeeId) {
  if (dagvyCurrentData) {
    var contentEl = document.getElementById('dagvyContent');
    if (contentEl) {
      contentEl.innerHTML = buildDagvyContent(dagvyCurrentData, dagvyCurrentName, dagvySimpleMode);
      dagvyScrollToCurrent();
    }
  }
}

/**
 * Clear all changelog entries. Called from Settings.
 */
function clearDagvyChangelog() {
  _dagvyChangelog = [];
  _saveDagvyChangelog();
}

/**
 * Update the count text in Settings → Ändringshistorik.
 */
function _updateChangelogSettingsCount() {
  var el = document.getElementById('changelogCount');
  if (!el) return;
  var count = _dagvyChangelog.length;
  if (count === 0) {
    el.textContent = 'Ingen historik sparad.';
  } else {
    el.textContent = count + ' ändringar sparade.';
  }
}

/**
 * Clear changelog from Settings UI (with confirmation).
 */
function clearDagvyChangelogUI() {
  var count = _dagvyChangelog.length;
  if (count === 0) return;

  // Show inline confirmation
  var btn = document.getElementById('clearChangelogBtn');
  if (!btn) return;

  if (btn.dataset.confirming === 'true') {
    // Second click — actually clear
    clearDagvyChangelog();
    _updateChangelogSettingsCount();
    btn.textContent = 'Rensa all historik';
    btn.dataset.confirming = '';
    btn.classList.remove('settings-danger-btn-confirm');
    return;
  }

  // First click — ask to confirm
  btn.textContent = 'Tryck igen för att rensa ' + count + ' ändringar';
  btn.dataset.confirming = 'true';
  btn.classList.add('settings-danger-btn-confirm');

  // Reset after 3 seconds
  setTimeout(function() {
    if (btn.dataset.confirming === 'true') {
      btn.textContent = 'Rensa all historik';
      btn.dataset.confirming = '';
      btn.classList.remove('settings-danger-btn-confirm');
    }
  }, 3000);
}
