/**
 * positions.js – Positionslista
 * Fetches position data from worker API and displays it.
 */

/* global REMOTE_DOC_WORKER, REMOTE_DOC_API_KEY */

// =============================================
// CONFIG & STATE
// =============================================
var POS_ENDPOINT = '/positions';
var _posCache = null;       // { data, ts }
var _posCacheTTL = 10 * 60 * 1000; // 10 min
var _posCurrentDate = null; // "2026-02-21"
var _posAvailDates = [];    // sorted array of date strings
var _posActiveFilter = 'alla';
var _posSearchQuery = '';

// =============================================
// PAGE SHOW / HIDE
// =============================================
function onPositionsPageShow() {
  // If no data cached or cache expired, fetch
  if (!_posCache || (Date.now() - _posCache.ts) > _posCacheTTL) {
    fetchPositions();
  } else {
    // Re-render with cached data (date might have changed)
    if (!_posCurrentDate) {
      _posCurrentDate = getTodayStr();
    }
    renderPositions();
  }
}

function onPositionsPageHide() {
  // Nothing to clean up
}

// =============================================
// FETCH
// =============================================
function fetchPositions() {
  var container = document.getElementById('positionsContainer');
  if (container) {
    container.innerHTML =
      '<div class="pos-loading">' +
        '<div class="pos-spinner"></div>' +
        '<div>Hämtar positionsdata…</div>' +
      '</div>';
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
      _posAvailDates = Object.keys(data.dagar).sort();

      // Pick today if available, otherwise first date
      var today = getTodayStr();
      if (_posAvailDates.indexOf(today) !== -1) {
        _posCurrentDate = today;
      } else if (!_posCurrentDate || _posAvailDates.indexOf(_posCurrentDate) === -1) {
        _posCurrentDate = _posAvailDates[0] || today;
      }

      renderPositions();
    })
    .catch(function(err) {
      if (container) {
        container.innerHTML =
          '<div class="pos-loading pos-error">' +
            '<span class="pos-error-icon">⚠️</span>' +
            '<div>Kunde inte hämta positionsdata</div>' +
            '<div class="pos-error-detail">' + (err.message || '') + '</div>' +
            '<button class="pos-retry-btn" onclick="fetchPositions()">Försök igen</button>' +
          '</div>';
      }
    });
}

// =============================================
// RENDER
// =============================================
function renderPositions() {
  var container = document.getElementById('positionsContainer');
  if (!container || !_posCache) return;

  var data = _posCache.data;
  var dayData = data.dagar[_posCurrentDate] || [];

  // Build HTML
  var html = '';

  // Date picker
  html += buildPosDatePicker();

  // Meta info
  if (data.meta && data.meta.skapad) {
    var updatedStr = formatPosDate(data.meta.skapad);
    html += '<div class="pos-meta">Uppdaterad: ' + updatedStr + '</div>';
  }

  // Search bar
  html += '<div class="pos-search-bar">';
  html += '<input type="text" class="pos-search-input" id="posSearchInput" placeholder="Sök namn, tåg eller tur…" value="' + escPosAttr(_posSearchQuery) + '">';
  if (_posSearchQuery) {
    html += '<button class="pos-search-clear" id="posSearchClear">✕</button>';
  }
  html += '</div>';

  // Filter chips
  html += '<div class="pos-filters">';
  var filters = [
    { id: 'alla', label: 'Alla' },
    { id: 'lokforare', label: '🚂 Lokförare' },
    { id: 'tagvard', label: '🎫 Tågvärd' },
    { id: 'til', label: '📡 TIL' }
  ];
  for (var i = 0; i < filters.length; i++) {
    var f = filters[i];
    html += '<button class="pos-filter-chip' + (f.id === _posActiveFilter ? ' active' : '') + '" data-filter="' + f.id + '">' + f.label + '</button>';
  }
  html += '</div>';

  // Filter + search data
  var filtered = filterPositions(dayData);

  // Count bar
  html += '<div class="pos-count">' + filtered.length + ' av ' + dayData.length + ' personer</div>';

  // Cards
  if (filtered.length === 0) {
    html += '<div class="pos-empty-list">Inga träffar</div>';
  } else {
    html += '<div class="pos-list">';
    for (var j = 0; j < filtered.length; j++) {
      html += buildPosCard(filtered[j]);
    }
    html += '</div>';
  }

  container.innerHTML = html;

  // Attach event listeners
  initPosListeners();
}

// =============================================
// DATE PICKER
// =============================================
function buildPosDatePicker() {
  var dateObj = parsePosDate(_posCurrentDate);
  var dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  var monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  var label = dayNames[dateObj.getDay()] + ' ' + dateObj.getDate() + ' ' + monthNames[dateObj.getMonth()];

  var isFirst = _posAvailDates.indexOf(_posCurrentDate) === 0;
  var isLast = _posAvailDates.indexOf(_posCurrentDate) === _posAvailDates.length - 1;

  var html = '<div class="pos-date-picker">';
  html += '<button class="pos-date-nav" id="posPrevDay"' + (isFirst ? ' disabled' : '') + '>←</button>';
  html += '<span class="pos-date-label">' + label + '</span>';
  html += '<button class="pos-date-nav" id="posNextDay"' + (isLast ? ' disabled' : '') + '>→</button>';
  html += '</div>';
  return html;
}

function posPrevDay() {
  var idx = _posAvailDates.indexOf(_posCurrentDate);
  if (idx > 0) {
    _posCurrentDate = _posAvailDates[idx - 1];
    renderPositions();
  }
}

function posNextDay() {
  var idx = _posAvailDates.indexOf(_posCurrentDate);
  if (idx < _posAvailDates.length - 1) {
    _posCurrentDate = _posAvailDates[idx + 1];
    renderPositions();
  }
}

// =============================================
// FILTER & SEARCH
// =============================================
function filterPositions(dayData) {
  var result = [];
  var query = _posSearchQuery.toLowerCase().trim();

  for (var i = 0; i < dayData.length; i++) {
    var p = dayData[i];

    // Role filter
    if (_posActiveFilter !== 'alla') {
      var roll = (p.roll || '').toLowerCase();
      if (_posActiveFilter === 'lokforare' && roll.indexOf('lokförare') === -1) continue;
      if (_posActiveFilter === 'tagvard' && roll.indexOf('tågvärd') === -1) continue;
      if (_posActiveFilter === 'til' && roll.indexOf('trafik') === -1 && roll.indexOf('informationsledare') === -1) continue;
    }

    // Search filter
    if (query) {
      var searchStr = (
        (p.namn || '') + ' ' +
        (p.turnr || '') + ' ' +
        (p.roll || '') + ' ' +
        (p.ort || '') + ' ' +
        (p.tagnr || []).join(' ')
      ).toLowerCase();
      if (searchStr.indexOf(query) === -1) continue;
    }

    result.push(p);
  }

  return result;
}

// =============================================
// CARD BUILDER
// =============================================
function buildPosCard(p) {
  var roll = (p.roll || '').toLowerCase();
  var rollClass = 'pos-role-other';
  var rollIcon = '👤';
  if (roll.indexOf('lokförare') !== -1) {
    rollClass = 'pos-role-lok';
    rollIcon = '🚂';
  } else if (roll.indexOf('tågvärd') !== -1) {
    rollClass = 'pos-role-tv';
    rollIcon = '🎫';
  } else if (roll.indexOf('trafik') !== -1 || roll.indexOf('informationsledare') !== -1) {
    rollClass = 'pos-role-til';
    rollIcon = '📡';
  }

  var isWorking = p.turnr && p.start !== '-';
  var timeStr = '';
  if (p.start && p.start !== '-') {
    timeStr = p.start;
    if (p.slut && p.slut !== '-') timeStr += ' – ' + p.slut;
  }

  // Check if currently working (between start and end)
  var isNow = false;
  if (isWorking && p.start !== '-' && p.slut !== '-') {
    isNow = isTimeNow(p.start, p.slut);
  }

  var html = '<div class="pos-card ' + rollClass + (isNow ? ' pos-card-now' : '') + '">';

  // Left: icon
  html += '<span class="pos-card-icon">' + rollIcon + '</span>';

  // Middle: info
  html += '<div class="pos-card-info">';
  html += '<div class="pos-card-name">' + escPosHtml(p.namn || '?') + '</div>';
  html += '<div class="pos-card-details">';
  if (p.turnr) html += '<span class="pos-card-tur">' + escPosHtml(p.turnr) + '</span>';
  if (timeStr) html += '<span class="pos-card-time">' + timeStr + '</span>';
  html += '</div>';

  // Train numbers
  if (p.tagnr && p.tagnr.length > 0) {
    html += '<div class="pos-card-trains">';
    for (var t = 0; t < p.tagnr.length; t++) {
      html += '<span class="pos-train-badge">' + escPosHtml(p.tagnr[t]) + '</span>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Right: ort + now indicator
  html += '<div class="pos-card-right">';
  if (p.ort) html += '<span class="pos-card-ort">' + escPosHtml(p.ort) + '</span>';
  if (isNow) html += '<span class="pos-card-now-dot" title="Jobbar nu">●</span>';
  html += '</div>';

  html += '</div>';
  return html;
}

// =============================================
// EVENT LISTENERS
// =============================================
function initPosListeners() {
  // Date nav
  var prevBtn = document.getElementById('posPrevDay');
  var nextBtn = document.getElementById('posNextDay');
  if (prevBtn) prevBtn.addEventListener('click', posPrevDay);
  if (nextBtn) nextBtn.addEventListener('click', posNextDay);

  // Filter chips
  var chips = document.querySelectorAll('.pos-filter-chip');
  for (var i = 0; i < chips.length; i++) {
    chips[i].addEventListener('click', function() {
      _posActiveFilter = this.getAttribute('data-filter');
      renderPositions();
    });
  }

  // Search input
  var searchInput = document.getElementById('posSearchInput');
  if (searchInput) {
    var debounceTimer = null;
    searchInput.addEventListener('input', function() {
      var val = this.value;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        _posSearchQuery = val;
        renderPositions();
        // Re-focus input after re-render
        var inp = document.getElementById('posSearchInput');
        if (inp) {
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      }, 250);
    });
  }

  // Search clear
  var clearBtn = document.getElementById('posSearchClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      _posSearchQuery = '';
      renderPositions();
      var inp = document.getElementById('posSearchInput');
      if (inp) inp.focus();
    });
  }
}

// =============================================
// HELPERS
// =============================================
function getTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function parsePosDate(str) {
  var parts = str.split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

function formatPosDate(isoStr) {
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  var months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function isTimeNow(startStr, endStr) {
  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var nowMin = h * 60 + m;

  var sp = startStr.split(':');
  var ep = endStr.split(':');
  var startMin = parseInt(sp[0], 10) * 60 + parseInt(sp[1], 10);
  var endMin = parseInt(ep[0], 10) * 60 + parseInt(ep[1], 10);

  // Handle overnight shifts (e.g., 22:00 - 06:00)
  if (endMin <= startMin) {
    return nowMin >= startMin || nowMin <= endMin;
  }
  return nowMin >= startMin && nowMin <= endMin;
}

function escPosHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escPosAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
