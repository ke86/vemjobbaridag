/**
 * parkering.js — Parking management
 * Tracks which employees have parking and shows real-time parking occupancy.
 *
 * Logic:
 *  - Checks selected date's positions for day shifts and evening/night shifts
 *  - Checks the day before for night shifts that end the selected morning
 *  - A car is "in" the parking lot between shift start and shift end
 *  - Night shifts (start > end): car in from start, stays overnight until end next morning
 *  - 11 parking spots: 0-10 = green (OK), 11+ = red (full)
 *
 * Storage: IndexedDB via saveSetting('parkering', [...names])
 */

// =============================================
// CONSTANTS
// =============================================
var PARK_MAX_SPOTS = 11;

// =============================================
// STATE
// =============================================
var _parkeringList = [];        // Array of name strings
var _parkeringLoaded = false;   // Has data been loaded from IndexedDB?
var _parkDate = new Date();      // Currently viewed date

var _parkeringDefaults = [
  'Petter Tegnér Sjöstrand',
  'André Carlsson',
  'Sara Feldt',
  'Kenny Eriksson',
  'Tina Lundin',
  'Alexander Canlycke',
  'Dennis Ross',
  'Saga Fagerström',
  'Merim Popara',
  'Ibrahim Luta',
  'Henrik Royson',
  'Robin Hjerpe',
  'Jonathan Doss',
  'Nadeem Ahmad',
  'Marcelle Gnawa',
  'Karolina Johansson',
  'Anna Lundström',
  'Kymet Shala',
  'Safet Rexha',
  'Faton Toni Maloku',
  'Peter Nilsson'
];

// =============================================
// PERSISTENCE (IndexedDB)
// =============================================

function loadParkeringList() {
  if (typeof loadSetting !== 'function') return Promise.resolve([]);
  return loadSetting('parkering').then(function(val) {
    if (Array.isArray(val) && val.length > 0) {
      _parkeringList = val;
    } else {
      // First time — seed with defaults
      _parkeringList = _parkeringDefaults.slice();
      saveParkeringList();
    }
    _parkeringLoaded = true;
    return _parkeringList;
  }).catch(function() {
    _parkeringList = _parkeringDefaults.slice();
    _parkeringLoaded = true;
    saveParkeringList();
    return _parkeringList;
  });
}

function saveParkeringList() {
  if (typeof saveSetting !== 'function') return Promise.resolve();
  return saveSetting('parkering', _parkeringList).catch(function(err) {
    console.log('[PARKERING] Save error: ' + (err.message || err));
  });
}

// =============================================
// SETTINGS — Add / Remove in Inställningar → Data → Parkering
// =============================================

function renderParkeringSettingsList() {
  var listEl = document.getElementById('parkeringList');
  if (!listEl) return;

  if (!_parkeringLoaded) {
    loadParkeringList().then(function() {
      renderParkeringSettingsList();
    });
    return;
  }

  if (_parkeringList.length === 0) {
    listEl.innerHTML = '<div class="parkering-empty">Inga tillagda</div>';
    return;
  }

  var sorted = _parkeringList.slice().sort(function(a, b) {
    return a.localeCompare(b, 'sv');
  });

  var html = '';
  for (var i = 0; i < sorted.length; i++) {
    var name = sorted[i];
    var safeN = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    html += '<div class="parkering-list-item">' +
      '<span class="parkering-list-name">' + name + '</span>' +
      '<button class="parkering-remove-btn" onclick="removeParkeringPerson(\'' + safeN + '\')">✕</button>' +
      '</div>';
  }
  listEl.innerHTML = html;
}

function addParkeringPerson() {
  var input = document.getElementById('parkeringNameInput');
  if (!input) return;

  var name = input.value.trim();
  if (!name) return;

  name = name.replace(/\b\w/g, function(c) { return c.toUpperCase(); });

  var nameLC = name.toLowerCase();
  for (var i = 0; i < _parkeringList.length; i++) {
    if (_parkeringList[i].toLowerCase() === nameLC) {
      input.value = '';
      return;
    }
  }

  _parkeringList.push(name);
  saveParkeringList();
  input.value = '';
  renderParkeringSettingsList();
}

function removeParkeringPerson(name) {
  _parkeringList = _parkeringList.filter(function(n) {
    return n !== name;
  });
  saveParkeringList();
  renderParkeringSettingsList();
}

document.addEventListener('keydown', function(e) {
  if (e.target && e.target.id === 'parkeringNameInput' && e.key === 'Enter') {
    e.preventDefault();
    addParkeringPerson();
  }
});

// =============================================
// DATE HELPERS
// =============================================

function _parkParseTime(str) {
  if (!str || str === '-') return -1;
  var m = str.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return -1;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function _parkFmtTime(min) {
  var h = Math.floor(min / 60) % 24;
  var m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function _parkDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function _parkDayBefore(dateStr) {
  var parts = dateStr.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() - 1);
  return _parkDateStr(d);
}

function _parkIsToday(dateStr) {
  return dateStr === getTodayStr();
}

function _parkIsOvernight(startMin, endMin) {
  return startMin >= 0 && endMin >= 0 && endMin <= startMin;
}

// =============================================
// DATE NAVIGATION
// =============================================

function parkPrevDay() {
  _parkDate.setDate(_parkDate.getDate() - 1);
  renderParkeringPage();
}

function parkNextDay() {
  _parkDate.setDate(_parkDate.getDate() + 1);
  renderParkeringPage();
}

function parkGoToday() {
  _parkDate = new Date();
  renderParkeringPage();
}

// =============================================
// PARKING OCCUPANCY LOGIC
// =============================================

/**
 * Build parking status for all persons on a given date.
 * @param {string} dateStr  YYYY-MM-DD to check
 * Returns array of { name, carIn, startMin, endMin, turnr, timeStr, overnight, source }
 */
function buildParkingStatus(dateStr) {
  var isToday = _parkIsToday(dateStr);
  var now = new Date();
  var nowMin = isToday ? (now.getHours() * 60 + now.getMinutes()) : -1;
  var dayBeforeStr = _parkDayBefore(dateStr);

  var dagar = (_posCache && _posCache.data && _posCache.data.dagar) ? _posCache.data.dagar : {};
  var dayPos = dagar[dateStr] || [];
  var dayBeforePos = dagar[dayBeforeStr] || [];

  var results = [];
  var sorted = _parkeringList.slice().sort(function(a, b) {
    return a.localeCompare(b, 'sv');
  });

  for (var i = 0; i < sorted.length; i++) {
    var name = sorted[i];
    var hasDay = false;

    // 1. Check selected date's positions (today's own shift)
    var dayMatch = _parkFindPerson(name, dayPos);
    if (dayMatch) {
      var tt = _parkGetTimes(dayMatch);
      if (tt.startMin >= 0 && tt.endMin >= 0) {
        var dayEntry = {
          name: name, carIn: false,
          startMin: tt.startMin, endMin: tt.endMin,
          turnr: dayMatch.turnr || '', timeStr: tt.timeStr,
          overnight: false, source: 'day'
        };

        if (_parkIsOvernight(tt.startMin, tt.endMin)) {
          dayEntry.overnight = true;
          if (isToday) {
            dayEntry.carIn = nowMin >= tt.startMin;
          } else {
            dayEntry.carIn = true;
          }
        } else {
          if (isToday) {
            dayEntry.carIn = nowMin >= tt.startMin && nowMin < tt.endMin;
          } else {
            dayEntry.carIn = true;
          }
        }

        results.push(dayEntry);
        hasDay = true;
      }
    }

    // 2. Check day before for overnight shifts ending this morning
    //    This can create a SECOND entry for the same person
    var dayBeforeMatch = _parkFindPerson(name, dayBeforePos);
    if (dayBeforeMatch) {
      var yt = _parkGetTimes(dayBeforeMatch);
      if (yt.startMin >= 0 && yt.endMin >= 0 && _parkIsOvernight(yt.startMin, yt.endMin)) {
        var yesterdayIn = false;
        if (isToday) {
          yesterdayIn = nowMin < yt.endMin;
        } else {
          yesterdayIn = true;
        }

        if (yesterdayIn) {
          results.push({
            name: name, carIn: true,
            startMin: yt.startMin, endMin: yt.endMin,
            turnr: dayBeforeMatch.turnr || '', timeStr: yt.timeStr,
            overnight: true, source: 'yesterday'
          });
        }
      }
    }

    // 3. If no entries were added for this person, add an empty entry
    var lastAdded = results.length > 0 ? results[results.length - 1] : null;
    if (!lastAdded || lastAdded.name !== name) {
      results.push({
        name: name, carIn: false,
        startMin: -1, endMin: -1,
        turnr: '', timeStr: '',
        overnight: false, source: ''
      });
    }
  }

  return results;
}

function _parkFindPerson(name, posArray) {
  var nameLC = name.toLowerCase().trim();
  for (var j = 0; j < posArray.length; j++) {
    if (posArray[j].namn && posArray[j].namn.toLowerCase().trim() === nameLC) {
      return posArray[j];
    }
  }
  return null;
}

function _parkGetTimes(pos) {
  var start = pos.start;
  var slut = pos.slut;

  if (typeof getPosTime === 'function') {
    var resolved = getPosTime(pos);
    if (resolved.start && resolved.start !== '-') start = resolved.start;
    if (resolved.slut && resolved.slut !== '-') slut = resolved.slut;
  }

  var startMin = _parkParseTime(start);
  var endMin = _parkParseTime(slut);
  var timeStr = '';
  if (start && start !== '-' && slut && slut !== '-') {
    timeStr = start + '–' + slut;
  }

  return { startMin: startMin, endMin: endMin, timeStr: timeStr };
}

// =============================================
// MENU INDICATOR — green/red dot next to Parkering
// =============================================

/**
 * Update the parking indicator in the sidebar menu.
 * Call this after positions data is loaded.
 */
function updateParkeringMenuIndicator() {
  var dot = document.getElementById('parkeringMenuDot');
  if (!dot) return;

  if (!_parkeringLoaded) {
    loadParkeringList().then(function() {
      updateParkeringMenuIndicator();
    });
    return;
  }

  if (_parkeringList.length === 0 || !_posCache || !_posCache.data) {
    dot.style.display = 'none';
    return;
  }

  var todayStatus = buildParkingStatus(getTodayStr());
  var carsIn = 0;
  var menuCounted = {};
  for (var i = 0; i < todayStatus.length; i++) {
    if (todayStatus[i].carIn && !menuCounted[todayStatus[i].name]) {
      carsIn++;
      menuCounted[todayStatus[i].name] = true;
    }
  }

  dot.style.display = '';
  dot.className = carsIn >= PARK_MAX_SPOTS ? 'park-menu-dot park-dot-red' : 'park-menu-dot park-dot-green';
  dot.textContent = carsIn;
}

// =============================================
// TIME ANALYSIS — Find periods where parking is full
// =============================================

/**
 * Analyze a full day and find time periods where cars >= PARK_MAX_SPOTS.
 * Uses the raw shift time ranges (startMin/endMin/overnight/source) from
 * buildParkingStatus, scanning every 5 minutes across 00:00–23:59.
 *
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {Array<{from: number, to: number, max: number}>}  periods in minutes
 */
function _parkAnalyzeDay(dateStr) {
  var status = buildParkingStatus(dateStr);

  // Build time ranges: each range = { from: min, to: min } within 0–1440
  var ranges = [];
  for (var i = 0; i < status.length; i++) {
    var e = status[i];
    if (e.startMin < 0 || e.endMin < 0) continue;

    if (e.source === 'yesterday' && e.overnight) {
      // Night shift from day before — car parked from 00:00 until endMin
      ranges.push({ from: 0, to: e.endMin });
    } else if (e.source === 'day' && e.overnight) {
      // Night shift starting this day — car parked from startMin until end of day
      ranges.push({ from: e.startMin, to: 1440 });
    } else if (e.source === 'day') {
      // Normal day shift
      ranges.push({ from: e.startMin, to: e.endMin });
    }
  }

  if (ranges.length === 0) return [];

  // Scan every 5 minutes
  var fullStart = -1;
  var fullPeriods = [];
  var maxInPeriod = 0;

  for (var m = 0; m <= 1440; m += 5) {
    var count = 0;
    for (var r = 0; r < ranges.length; r++) {
      if (m >= ranges[r].from && m < ranges[r].to) count++;
    }

    if (count >= PARK_MAX_SPOTS) {
      if (fullStart < 0) {
        fullStart = m;
        maxInPeriod = count;
      }
      if (count > maxInPeriod) maxInPeriod = count;
    } else {
      if (fullStart >= 0) {
        fullPeriods.push({ from: fullStart, to: m, max: maxInPeriod });
        fullStart = -1;
        maxInPeriod = 0;
      }
    }
  }

  if (fullStart >= 0) {
    fullPeriods.push({ from: fullStart, to: 1440, max: maxInPeriod });
  }

  return fullPeriods;
}

// =============================================
// PARKERING PAGE — Render
// =============================================

function onParkeringPageShow() {
  _parkDate = new Date(); // Reset to today when opening page
  var container = document.getElementById('parkeringContainer');
  if (!container) return;

  if (!_parkeringLoaded) {
    loadParkeringList().then(function() {
      renderParkeringPage();
    });
    return;
  }

  renderParkeringPage();
}

function renderParkeringPage() {
  var container = document.getElementById('parkeringContainer');
  if (!container) return;

  if (_parkeringList.length === 0) {
    container.innerHTML =
      '<div class="parkering-page-empty">' +
        '<div class="parkering-page-empty-icon">🅿️</div>' +
        '<p>Inga personer tillagda</p>' +
        '<p class="parkering-page-empty-hint">Lägg till via Inställningar → Data → Parkering</p>' +
      '</div>';
    return;
  }

  var hasPosData = _posCache && _posCache.data && _posCache.data.dagar;
  if (!hasPosData) {
    container.innerHTML =
      '<div class="parkering-page-loading">' +
        '<div class="parkering-page-empty-icon">🅿️</div>' +
        '<p>Hämtar positionsdata…</p>' +
      '</div>';
    fetchPositionsForParkering();
    return;
  }

  var dateStr = _parkDateStr(_parkDate);
  var isToday = _parkIsToday(dateStr);
  var status = buildParkingStatus(dateStr);
  var now = new Date();
  var nowMin = isToday ? (now.getHours() * 60 + now.getMinutes()) : -1;

  // Count unique persons with carIn (avoid double-counting same person)
  var carsIn = 0;
  var countedNames = {};
  for (var i = 0; i < status.length; i++) {
    if (status[i].carIn && !countedNames[status[i].name]) {
      carsIn++;
      countedNames[status[i].name] = true;
    }
  }

  var isFull = isToday && carsIn >= PARK_MAX_SPOTS;
  var colorClass = isToday ? (isFull ? 'parkering-full' : 'parkering-ok') : 'parkering-ok';

  // Find "next out" (only for today)
  var nextOut = null;
  var nextOutMin = Infinity;
  if (isToday) {
    for (var n = 0; n < status.length; n++) {
      var s = status[n];
      if (!s.carIn || s.endMin < 0) continue;
      if (s.source === 'day' && s.overnight) continue;
      if (s.endMin > nowMin && s.endMin < nextOutMin) {
        nextOutMin = s.endMin;
        nextOut = s;
      }
    }
  }

  // Date display
  var dayNames = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
  var monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var displayDate = dayNames[_parkDate.getDay()] + ' ' + _parkDate.getDate() + ' ' + monthNames[_parkDate.getMonth()];

  var html = '';

  // ── Hero ──
  html += '<div class="parkering-hero ' + colorClass + '">';

  // Date navigation
  html += '<div class="parkering-nav">';
  html += '<button class="parkering-nav-btn" onclick="parkPrevDay()">◀</button>';
  html += '<span class="parkering-nav-date' + (isToday ? ' parkering-nav-today' : '') + '" onclick="parkGoToday()">' + displayDate + (isToday ? '' : '') + '</span>';
  html += '<button class="parkering-nav-btn" onclick="parkNextDay()">▶</button>';
  html += '</div>';

  // Count
  html += '<div class="parkering-hero-count">';
  html += '<span class="parkering-hero-num ' + colorClass + '">' + carsIn + '</span>';
  html += '<span class="parkering-hero-sep">/</span>';
  html += '<span class="parkering-hero-total">' + PARK_MAX_SPOTS + '</span>';
  html += '</div>';

  // Label — full/red only for today (real-time), other days just show count
  if (isToday) {
    if (isFull) {
      html += '<div class="parkering-hero-label parkering-label-full">⚠️ P-huset fullt!</div>';
    } else {
      var freeSpots = PARK_MAX_SPOTS - carsIn;
      html += '<div class="parkering-hero-label">' + freeSpots + ' lediga platser just nu</div>';
    }
  } else {
    html += '<div class="parkering-hero-label">' + carsIn + ' bilar parkerar denna dag</div>';
  }

  // Time analysis — show periods where parking is full
  var fullPeriods = _parkAnalyzeDay(dateStr);
  if (fullPeriods.length > 0) {
    var periodsStr = fullPeriods.map(function(p) {
      return _parkFmtTime(p.from) + '–' + _parkFmtTime(p.to);
    }).join(', ');
    html += '<div class="parkering-hero-analysis">⚠️ Fullt kl ' + periodsStr + '</div>';
  }

  // Next out (only today)
  if (nextOut) {
    html += '<div class="parkering-hero-next">';
    html += 'Nästa ut: <strong>' + nextOut.name + '</strong> kl ' + _parkFmtTime(nextOut.endMin);
    html += '</div>';
  }
  html += '</div>';

  // ── Person list ──
  html += '<div class="parkering-detail-list">';

  if (isToday) {
    // TODAY: 3 groups — only people who work (have a source)
    var parkedNow = [];   // carIn = true (currently in parking)
    var arriving = [];    // has shift but not arrived yet (nowMin < startMin)
    var leftAlready = []; // had shift but already left (nowMin >= endMin)

    for (var ti = 0; ti < status.length; ti++) {
      var te = status[ti];
      if (!te.source) continue; // skip people who don't work today

      if (te.carIn) {
        parkedNow.push(te);
      } else if (te.source === 'day' && te.startMin >= 0 && nowMin < te.startMin) {
        arriving.push(te);
      } else if (te.startMin >= 0 && te.endMin >= 0) {
        leftAlready.push(te);
      }
    }

    // Sort: parked — yesterday first, then by startMin
    parkedNow.sort(function(a, b) {
      var aY = a.source === 'yesterday' ? 0 : 1;
      var bY = b.source === 'yesterday' ? 0 : 1;
      if (aY !== bY) return aY - bY;
      var aS = a.startMin >= 0 ? a.startMin : 9999;
      var bS = b.startMin >= 0 ? b.startMin : 9999;
      return aS - bS;
    });

    // Sort: arriving — by startMin (next to arrive first)
    arriving.sort(function(a, b) {
      return (a.startMin >= 0 ? a.startMin : 9999) - (b.startMin >= 0 ? b.startMin : 9999);
    });

    // Sort: left — by endMin
    leftAlready.sort(function(a, b) {
      return (a.endMin >= 0 ? a.endMin : 0) - (b.endMin >= 0 ? b.endMin : 0);
    });

    if (parkedNow.length > 0) {
      html += '<div class="parkering-section-label">🚗 Parkerad (' + parkedNow.length + ')</div>';
      for (var pi = 0; pi < parkedNow.length; pi++) {
        html += _renderParkCard(parkedNow[pi], nowMin, true, isToday, pi + 1);
      }
    }

    if (arriving.length > 0) {
      html += '<div class="parkering-section-label parkering-section-arriving">⏳ Kommer (' + arriving.length + ')</div>';
      for (var ai = 0; ai < arriving.length; ai++) {
        html += _renderParkCard(arriving[ai], nowMin, false, isToday, ai + 1);
      }
    }

    if (leftAlready.length > 0) {
      html += '<div class="parkering-section-label parkering-section-out">✅ Kört ut (' + leftAlready.length + ')</div>';
      for (var li = 0; li < leftAlready.length; li++) {
        html += _renderParkCard(leftAlready[li], nowMin, false, isToday, li + 1);
      }
    }

  } else {
    // OTHER DAYS: 2 groups — Parkerad / Ej parkerad
    var carsInList = status.filter(function(s) { return s.carIn; });

    var namesWithCarIn = {};
    for (var ni = 0; ni < carsInList.length; ni++) {
      namesWithCarIn[carsInList[ni].name] = true;
    }
    var carsOutList = [];
    var outSeen = {};
    for (var oi = 0; oi < status.length; oi++) {
      var oEntry = status[oi];
      if (!namesWithCarIn[oEntry.name] && !outSeen[oEntry.name]) {
        carsOutList.push(oEntry);
        outSeen[oEntry.name] = true;
      }
    }

    carsInList.sort(function(a, b) {
      var aY = a.source === 'yesterday' ? 0 : 1;
      var bY = b.source === 'yesterday' ? 0 : 1;
      if (aY !== bY) return aY - bY;
      var aS = a.startMin >= 0 ? a.startMin : 9999;
      var bS = b.startMin >= 0 ? b.startMin : 9999;
      return aS - bS;
    });

    carsOutList.sort(function(a, b) { return a.name.localeCompare(b.name, 'sv'); });

    if (carsInList.length > 0) {
      html += '<div class="parkering-section-label">🚗 Parkerad (' + carsInList.length + ')</div>';
      for (var ci = 0; ci < carsInList.length; ci++) {
        html += _renderParkCard(carsInList[ci], nowMin, true, isToday, ci + 1);
      }
    }

    if (carsOutList.length > 0) {
      html += '<div class="parkering-section-label parkering-section-out">Ej parkerad (' + carsOutList.length + ')</div>';
      for (var co = 0; co < carsOutList.length; co++) {
        html += _renderParkCard(carsOutList[co], nowMin, false, isToday, co + 1);
      }
    }
  }

  html += '</div>';

  container.innerHTML = html;

  // Also update menu indicator for today
  updateParkeringMenuIndicator();
}

function _renderParkCard(entry, nowMin, isIn, isToday, num) {
  var cls = isIn ? 'parkering-card parkering-card-in' : 'parkering-card parkering-card-out';

  var detailHtml = '';
  if (entry.turnr || entry.timeStr) {
    detailHtml += '<div class="parkering-card-detail">';
    if (entry.turnr) {
      detailHtml += '<span class="parkering-card-turn">' + entry.turnr + '</span>';
    }
    if (entry.timeStr) {
      detailHtml += '<span class="parkering-card-time">' + entry.timeStr + '</span>';
    }
    if (isIn && entry.endMin >= 0 && isToday) {
      var leavesStr = '';
      if (entry.source === 'day' && entry.overnight) {
        leavesStr = 'Kör ut imorgon ' + _parkFmtTime(entry.endMin);
      } else if (entry.endMin > nowMin) {
        var diff = entry.endMin - nowMin;
        if (diff <= 60) {
          leavesStr = 'Kör ut om ' + diff + ' min';
        } else {
          leavesStr = 'Kör ut kl ' + _parkFmtTime(entry.endMin);
        }
      }
      if (leavesStr) {
        detailHtml += '<span class="parkering-card-leaves">' + leavesStr + '</span>';
      }
    }
    if (entry.source === 'yesterday') {
      detailHtml += '<span class="parkering-card-night">nattpass dagen innan</span>';
    }
    detailHtml += '</div>';
  }

  return '<div class="' + cls + '">' +
    '<span class="parkering-card-num">' + num + '.</span>' +
    '<span class="parkering-card-icon">' + (isIn ? '🚗' : '⚪') + '</span>' +
    '<div class="parkering-card-info">' +
      '<span class="parkering-card-name">' + entry.name + '</span>' +
      detailHtml +
    '</div>' +
  '</div>';
}

function fetchPositionsForParkering() {
  if (_posCache && _posCache.data) {
    renderParkeringPage();
    return;
  }

  var url = (typeof REMOTE_DOC_WORKER !== 'undefined' ? REMOTE_DOC_WORKER : 'https://onevr-auth.kenny-eriksson1986.workers.dev') + POS_ENDPOINT;
  var apiKey = (typeof REMOTE_DOC_API_KEY !== 'undefined' ? REMOTE_DOC_API_KEY : 'onevr-docs-2026');

  fetch(url, { headers: { 'X-API-Key': apiKey } })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      if (!data || !data.dagar) throw new Error('Oväntat svar');
      _posCache = { data: data, ts: Date.now() };
      renderParkeringPage();
    })
    .catch(function(err) {
      var container = document.getElementById('parkeringContainer');
      if (container) {
        container.innerHTML =
          '<div class="parkering-page-empty">' +
            '<div class="parkering-page-empty-icon">⚠️</div>' +
            '<p>Kunde inte hämta positionsdata</p>' +
            '<p class="parkering-page-empty-hint">' + (err.message || '') + '</p>' +
            '<button class="parkering-retry-btn" onclick="fetchPositionsForParkering()">Försök igen</button>' +
          '</div>';
      }
    });
}
