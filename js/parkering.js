/**
 * parkering.js — Parking management
 * Tracks which employees have parking and shows real-time parking occupancy.
 *
 * Logic:
 *  - Checks TODAY's positions for day shifts and evening/night shifts starting today
 *  - Checks YESTERDAY's positions for night shifts that end this morning
 *  - A car is "in" the parking lot between shift start and shift end
 *  - Night shifts (start > end): car in from start, stays overnight until end next morning
 *
 * Storage: IndexedDB via saveSetting('parkering', [...names])
 */

// =============================================
// STATE
// =============================================
var _parkeringList = [];        // Array of name strings
var _parkeringLoaded = false;   // Has data been loaded from IndexedDB?
var _parkeringExpanded = false;  // Is the detail list expanded?

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

  // Capitalize first letter of each word
  name = name.replace(/\b\w/g, function(c) { return c.toUpperCase(); });

  // Check duplicate (case-insensitive)
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

// Allow Enter key on input
document.addEventListener('keydown', function(e) {
  if (e.target && e.target.id === 'parkeringNameInput' && e.key === 'Enter') {
    e.preventDefault();
    addParkeringPerson();
  }
});

// =============================================
// TIME HELPERS
// =============================================

/**
 * Parse "HH:MM" to minutes since midnight. Returns -1 if invalid.
 */
function _parkParseTime(str) {
  if (!str || str === '-') return -1;
  var m = str.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return -1;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

/**
 * Format minutes since midnight to "HH:MM"
 */
function _parkFmtTime(min) {
  var h = Math.floor(min / 60) % 24;
  var m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/**
 * Get yesterday's date string (YYYY-MM-DD)
 */
function _parkYesterday() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/**
 * Check if a shift is overnight (start > end, e.g., 22:15-06:15)
 */
function _parkIsOvernight(startMin, endMin) {
  return startMin >= 0 && endMin >= 0 && endMin <= startMin;
}

// =============================================
// PARKING OCCUPANCY LOGIC
// =============================================

/**
 * Build parking status for all persons.
 * Returns array of objects:
 *   { name, carIn (bool), startMin, endMin, turnr, timeStr, overnight, source ('today'|'yesterday') }
 */
function buildParkingStatus() {
  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var todayStr = getTodayStr();
  var yesterdayStr = _parkYesterday();

  var dagar = (_posCache && _posCache.data && _posCache.data.dagar) ? _posCache.data.dagar : {};
  var todayPos = dagar[todayStr] || [];
  var yesterdayPos = dagar[yesterdayStr] || [];

  var results = [];
  var sorted = _parkeringList.slice().sort(function(a, b) {
    return a.localeCompare(b, 'sv');
  });

  for (var i = 0; i < sorted.length; i++) {
    var name = sorted[i];
    var entry = {
      name: name,
      carIn: false,
      startMin: -1,
      endMin: -1,
      turnr: '',
      timeStr: '',
      overnight: false,
      source: ''
    };

    // 1. Check today's positions
    var todayMatch = _parkFindPerson(name, todayPos);
    if (todayMatch) {
      var tt = _parkGetTimes(todayMatch);
      entry.turnr = todayMatch.turnr || '';
      entry.startMin = tt.startMin;
      entry.endMin = tt.endMin;
      entry.timeStr = tt.timeStr;
      entry.source = 'today';

      if (tt.startMin >= 0 && tt.endMin >= 0) {
        if (_parkIsOvernight(tt.startMin, tt.endMin)) {
          // Night shift starting today — car is in from start onwards
          entry.overnight = true;
          entry.carIn = nowMin >= tt.startMin;
        } else {
          // Normal day shift — car is in between start and end
          entry.carIn = nowMin >= tt.startMin && nowMin < tt.endMin;
        }
      }
    }

    // 2. Check yesterday's positions for overnight shifts ending this morning
    if (!entry.carIn) {
      var yesterdayMatch = _parkFindPerson(name, yesterdayPos);
      if (yesterdayMatch) {
        var yt = _parkGetTimes(yesterdayMatch);
        if (yt.startMin >= 0 && yt.endMin >= 0 && _parkIsOvernight(yt.startMin, yt.endMin)) {
          // Overnight shift from yesterday — car still in if we haven't passed end time
          if (nowMin < yt.endMin) {
            entry.carIn = true;
            entry.startMin = yt.startMin;
            entry.endMin = yt.endMin;
            entry.turnr = yesterdayMatch.turnr || '';
            entry.timeStr = yt.timeStr;
            entry.overnight = true;
            entry.source = 'yesterday';
          }
        }
      }
    }

    results.push(entry);
  }

  return results;
}

/**
 * Find a person by name in a position array
 */
function _parkFindPerson(name, posArray) {
  var nameLC = name.toLowerCase().trim();
  for (var j = 0; j < posArray.length; j++) {
    if (posArray[j].namn && posArray[j].namn.toLowerCase().trim() === nameLC) {
      return posArray[j];
    }
  }
  return null;
}

/**
 * Get resolved times for a position entry (using getPosTime for fallback)
 */
function _parkGetTimes(pos) {
  var start = pos.start;
  var slut = pos.slut;

  // Use getPosTime for TIL/reserve time lookup
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
// PARKERING PAGE — Render
// =============================================

function onParkeringPageShow() {
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

  // Check if pos data available
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

  var status = buildParkingStatus();
  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();

  // Count
  var carsIn = 0;
  var total = status.length;
  for (var i = 0; i < status.length; i++) {
    if (status[i].carIn) carsIn++;
  }

  // Find "next out" — among cars currently in, which has the earliest end time ahead
  var nextOut = null;
  var nextOutMin = Infinity;
  for (var n = 0; n < status.length; n++) {
    var s = status[n];
    if (!s.carIn || s.endMin < 0) continue;

    // For overnight shifts from today (starting tonight), they leave tomorrow — skip for "nästa ut"
    if (s.source === 'today' && s.overnight) continue;

    // For overnight from yesterday ending today, or day shifts
    if (s.endMin > nowMin && s.endMin < nextOutMin) {
      nextOutMin = s.endMin;
      nextOut = s;
    }
  }

  // Date string
  var dayNames = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
  var monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var dateStr = dayNames[now.getDay()] + ' ' + now.getDate() + ' ' + monthNames[now.getMonth()];

  var html = '';

  // ── Top: Date + Count ──
  html += '<div class="parkering-hero">';
  html += '<div class="parkering-hero-date">' + dateStr + '</div>';
  html += '<div class="parkering-hero-count">';
  html += '<span class="parkering-hero-num">' + carsIn + '</span>';
  html += '<span class="parkering-hero-sep">/</span>';
  html += '<span class="parkering-hero-total">' + total + '</span>';
  html += '</div>';
  html += '<div class="parkering-hero-label">bilar i p-huset just nu</div>';

  if (nextOut) {
    html += '<div class="parkering-hero-next">';
    html += 'Nästa ut: <strong>' + nextOut.name + '</strong> kl ' + _parkFmtTime(nextOut.endMin);
    html += '</div>';
  }
  html += '</div>';

  // ── Person list: parked first, sorted by end time ──
  var carsInList = status.filter(function(s) { return s.carIn; });
  var carsOutList = status.filter(function(s) { return !s.carIn; });

  // Sort parked cars by end time (nearest first), overnight-tonight last
  carsInList.sort(function(a, b) {
    var aEnd = a.endMin;
    var bEnd = b.endMin;
    // Overnight from today → push to end (they leave tomorrow)
    if (a.source === 'today' && a.overnight) aEnd = 9999;
    if (b.source === 'today' && b.overnight) bEnd = 9999;
    return aEnd - bEnd;
  });

  // Sort not-parked alphabetically
  carsOutList.sort(function(a, b) { return a.name.localeCompare(b.name, 'sv'); });

  // ── Expandable details ──
  html += '<div class="parkering-expand-header" onclick="toggleParkeringExpand()">';
  html += '<span>Visa detaljer</span>';
  html += '<span class="parkering-expand-arrow" id="parkeringArrow">' + (_parkeringExpanded ? '▲' : '▼') + '</span>';
  html += '</div>';

  html += '<div class="parkering-detail-list" id="parkeringDetailList" style="' + (_parkeringExpanded ? '' : 'display:none;') + '">';

  // Cars IN
  if (carsInList.length > 0) {
    html += '<div class="parkering-section-label">🚗 Står i p-huset (' + carsInList.length + ')</div>';
    for (var ci = 0; ci < carsInList.length; ci++) {
      html += _renderParkCard(carsInList[ci], nowMin, true);
    }
  }

  // Cars OUT
  if (carsOutList.length > 0) {
    html += '<div class="parkering-section-label parkering-section-out">Ej parkerad (' + carsOutList.length + ')</div>';
    for (var co = 0; co < carsOutList.length; co++) {
      html += _renderParkCard(carsOutList[co], nowMin, false);
    }
  }

  html += '</div>';

  container.innerHTML = html;
}

/**
 * Render a parking person card
 */
function _renderParkCard(entry, nowMin, isIn) {
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
    // For parked cars: show when they leave
    if (isIn && entry.endMin >= 0) {
      var leavesStr = '';
      if (entry.source === 'today' && entry.overnight) {
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
      detailHtml += '<span class="parkering-card-night">nattpass igår</span>';
    }
    detailHtml += '</div>';
  }

  return '<div class="' + cls + '">' +
    '<span class="parkering-card-icon">' + (isIn ? '🚗' : '⚪') + '</span>' +
    '<div class="parkering-card-info">' +
      '<span class="parkering-card-name">' + entry.name + '</span>' +
      detailHtml +
    '</div>' +
  '</div>';
}

/**
 * Toggle expand/collapse of detail list
 */
function toggleParkeringExpand() {
  _parkeringExpanded = !_parkeringExpanded;
  var list = document.getElementById('parkeringDetailList');
  var arrow = document.getElementById('parkeringArrow');
  if (list) list.style.display = _parkeringExpanded ? '' : 'none';
  if (arrow) arrow.textContent = _parkeringExpanded ? '▲' : '▼';
}

/**
 * Fetch positions data if not cached, then re-render
 */
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
