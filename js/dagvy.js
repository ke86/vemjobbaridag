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

  dagvySimpleMode = false;
  dagvyCrewFilter = false;
  dagvyCurrentData = null;
  dagvyCurrentName = emp.name;

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
            <span class="dagvy-mode-label dagvy-mode-enkel">Enkel</span>
            <div class="dagvy-mode-switch allt-active">
              <div class="dagvy-mode-thumb"></div>
            </div>
            <span class="dagvy-mode-label dagvy-mode-allt active">Allt</span>
          </div>
          <div class="dagvy-mode-toggle" id="dagvyCrewToggle" onclick="toggleDagvyCrewFilter()">
            <span class="dagvy-mode-label dagvy-crew-med">Med dig</span>
            <div class="dagvy-mode-switch dagvy-crew-switch alla-active">
              <div class="dagvy-mode-thumb"></div>
            </div>
            <span class="dagvy-mode-label dagvy-crew-alla active">Alla</span>
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
      <button class="dagvy-btn dagvy-btn-schedule" onclick="closeDagvy(); goToPersonSchedule('${employeeId}')">
        📅 Visa schema
      </button>
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
    const availDates = data.days ? data.days.map(function(d) { return d.date; }).join(', ') : 'inga';
    contentEl.innerHTML = `
      <div class="dagvy-empty">
        <div class="dagvy-empty-icon">📋</div>
        <p>Ingen turdata för ${formatDate(currentDate)}</p>
        <p class="dagvy-empty-sub">Tillgängliga dagar: ${availDates}</p>
      </div>
    `;
    return;
  }

  // Update turn info
  if (turnEl) {
    turnEl.innerHTML = 'Tur <strong>' + todayDagvy.turnr + '</strong> &middot; ' + todayDagvy.start + ' – ' + todayDagvy.end;
  }

  // Show badge if data is from previous dagvy (smart merge)
  if (data.fromPrevious) {
    var badge = document.createElement('div');
    badge.className = 'dagvy-previous-badge';
    badge.textContent = '⏳ Från föregående dagvy';
    var personBar = dagvyPage.querySelector('.dagvy-person-bar');
    if (personBar) personBar.appendChild(badge);
  }

  // Store for re-render on mode toggle
  dagvyCurrentData = todayDagvy;

  // Update schedule card if dagvy has different info
  updateScheduleFromDagvy(employeeId, todayDagvy, dateKey);

  // Build the dagvy content
  contentEl.innerHTML = buildDagvyContent(todayDagvy, emp.name, dagvySimpleMode);
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

  // Skip non-working types (FP, semester, etc.)
  if (nonWorkingTypes.includes(shift.badge)) return;

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

  // Update the shift data
  if (turnChanged) {
    shift.badgeText = dagvyTurn;
  }
  if (timeChanged) {
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
    if (!shift) continue;
    if (nonWorkingTypes.includes(shift.badge)) continue;

    var dagvyTurn = (dayData.turnr || '').trim();
    var dagvyTimeValid = dayData.start && dayData.start !== '-' && dayData.end && dayData.end !== '-';
    var dagvyTime = dagvyTimeValid ? dayData.start + '-' + dayData.end : '';
    var currentTurn = (shift.badgeText || '').trim();
    var currentTime = (shift.time || '').trim();

    var turnChanged = dagvyTurn && dagvyTurn !== currentTurn;
    var timeChanged = dagvyTime && dagvyTime !== currentTime;

    if (!turnChanged && !timeChanged) continue;

    if (turnChanged) shift.badgeText = dagvyTurn;
    if (timeChanged) shift.time = dagvyTime;
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
    }
  }
}

/**
 * Toggle between Med dig / Alla crew filter and re-render
 */
function toggleDagvyCrewFilter() {
  dagvyCrewFilter = !dagvyCrewFilter;

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
    }
  }
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

  if (dayData.segments && dayData.segments.length > 0) {
    html += '<div class="dagvy-timeline">';

    for (const seg of dayData.segments) {
      // Filter in simple mode
      if (simpleMode && !isSimpleSegment(seg)) continue;

      const isTrain = seg.trainNr && seg.trainNr.length > 0;
      const isActivityTrain = !isTrain && isTrainLikeActivity(seg.activity);
      const isAnyTrain = isTrain || isActivityTrain;
      const isRast = seg.activity && (seg.activity.includes('Rast') || seg.activity === 'Rasto');
      const isGang = seg.activity === 'Gångtid';

      let segClass = 'dagvy-seg-activity';
      if (isAnyTrain) segClass = 'dagvy-seg-train';
      else if (isRast) segClass = 'dagvy-seg-rast';
      else if (isGang) segClass = 'dagvy-seg-gang';

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

      if (isAnyTrain) {
        middleHtml = '<span class="dagvy-seg-route-text">' + route + '</span>';
        const vxIcon = seg.trainType === 'Växling' ? 'VXL ' : '';
        trainBadgeHtml = '<span class="dagvy-train-badge">' + vxIcon + displayTrainNr + '</span>';
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
