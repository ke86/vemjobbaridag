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
var _posActiveOrt = 'alla';
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

  // Filter row: Roll | Ort | Sök
  var uniqueOrts = getUniqueOrts(dayData);

  html += '<div class="pos-filter-row">';

  // Roll dropdown
  html += '<div class="pos-filter-group">';
  html += '<label class="pos-filter-label" for="posFilterRoll">Roll</label>';
  html += '<select class="pos-filter-select" id="posFilterRoll">';
  html += '<option value="alla"' + (_posActiveFilter === 'alla' ? ' selected' : '') + '>Alla</option>';
  html += '<option value="lokforare"' + (_posActiveFilter === 'lokforare' ? ' selected' : '') + '>Lokförare</option>';
  html += '<option value="tagvard"' + (_posActiveFilter === 'tagvard' ? ' selected' : '') + '>Tågvärd</option>';
  html += '<option value="til"' + (_posActiveFilter === 'til' ? ' selected' : '') + '>TIL</option>';
  html += '</select>';
  html += '</div>';

  // Ort dropdown
  html += '<div class="pos-filter-group">';
  html += '<label class="pos-filter-label" for="posFilterOrt">Ort</label>';
  html += '<select class="pos-filter-select" id="posFilterOrt">';
  html += '<option value="alla"' + (_posActiveOrt === 'alla' ? ' selected' : '') + '>Alla</option>';
  for (var oi = 0; oi < uniqueOrts.length; oi++) {
    var ort = uniqueOrts[oi];
    html += '<option value="' + escPosAttr(ort) + '"' + (_posActiveOrt === ort ? ' selected' : '') + '>' + escPosHtml(ort) + '</option>';
  }
  html += '</select>';
  html += '</div>';

  // Search field
  html += '<div class="pos-filter-group pos-filter-group-search">';
  html += '<label class="pos-filter-label" for="posSearchInput">Sök</label>';
  html += '<div class="pos-search-bar">';
  html += '<input type="text" class="pos-search-input" id="posSearchInput" placeholder="Namn, tåg, tur…" value="' + escPosAttr(_posSearchQuery) + '">';
  if (_posSearchQuery) {
    html += '<button class="pos-search-clear" id="posSearchClear">✕</button>';
  }
  html += '</div>';
  html += '</div>';

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

  // Min/max for native date picker
  var minDate = _posAvailDates.length > 0 ? _posAvailDates[0] : _posCurrentDate;
  var maxDate = _posAvailDates.length > 0 ? _posAvailDates[_posAvailDates.length - 1] : _posCurrentDate;

  var html = '<div class="pos-date-picker">';
  html += '<button class="pos-date-nav" id="posPrevDay"' + (isFirst ? ' disabled' : '') + '>←</button>';
  html += '<div class="pos-date-display" id="posDateDisplayBtn">';
  html += '<span class="pos-date-label">' + label + '</span>';
  html += '<input type="date" class="pos-native-date" id="posNativeDatePicker" value="' + _posCurrentDate + '" min="' + minDate + '" max="' + maxDate + '">';
  html += '</div>';
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
function getUniqueOrts(dayData) {
  var ortSet = {};
  for (var i = 0; i < dayData.length; i++) {
    var ort = (dayData[i].ort || '').trim();
    if (ort) ortSet[ort] = true;
  }
  return Object.keys(ortSet).sort();
}

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

    // Ort filter
    if (_posActiveOrt !== 'alla') {
      if ((p.ort || '').trim() !== _posActiveOrt) continue;
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
// TURN CLASSIFICATION
// =============================================
// TIL shift codes
var POS_TIL_CODES = ['PL1','PL2','PL3','FL1','FL2','FL3','IL1','IL2','SL1','SL2','SL3','DK1','DK2','TDS1','TDS2','TDS3'];

function classifyPosTurn(turnr, roll) {
  var result = { tag: '', tagClass: '' };
  if (!turnr) return result;

  var t = turnr.toUpperCase().trim();

  // TIL shifts — no SE/DK tag
  for (var i = 0; i < POS_TIL_CODES.length; i++) {
    if (t === POS_TIL_CODES[i]) return result;
  }

  // Reserve: starts with RESERV
  if (t.indexOf('RESERV') === 0) {
    result.tag = 'RES';
    result.tagClass = 'pos-tag-res';
    return result;
  }

  // Reserve: format NNNNNN-NNNNNN
  if (/^\d{6}-\d{6}$/.test(t)) {
    result.tag = 'RES';
    result.tagClass = 'pos-tag-res';
    return result;
  }

  // Reserve: role is "Reserv"
  if (roll && roll.toLowerCase().indexOf('reserv') !== -1) {
    result.tag = 'RES';
    result.tagClass = 'pos-tag-res';
    return result;
  }

  // Extract leading digits
  var digits = t.match(/^(\d+)/);
  if (!digits || digits[1].length < 4) return result;
  var d = digits[1];

  // 4th digit 8 or 9 → reserve
  if (d[3] === '8' || d[3] === '9') {
    result.tag = 'RES';
    result.tagClass = 'pos-tag-res';
    return result;
  }

  // 3rd digit odd → SE, even → DK (need at least 3 digits)
  if (d.length >= 3) {
    var third = parseInt(d[2], 10);
    if (third % 2 === 1) {
      result.tag = 'SE';
      result.tagClass = 'pos-tag-se';
    } else {
      result.tag = 'DK';
      result.tagClass = 'pos-tag-dk';
    }
  }

  return result;
}

// =============================================
// CARD BUILDER
// =============================================
function buildPosCard(p) {
  var roll = (p.roll || '').toLowerCase();
  var rollClass = 'pos-role-other';
  var rollLabel = '–';
  if (roll.indexOf('lokförare') !== -1) {
    rollClass = 'pos-role-lok';
    rollLabel = 'LF';
  } else if (roll.indexOf('tågvärd') !== -1) {
    rollClass = 'pos-role-tv';
    rollLabel = 'TV';
  } else if (roll.indexOf('trafik') !== -1 || roll.indexOf('informationsledare') !== -1) {
    rollClass = 'pos-role-til';
    rollLabel = 'TIL';
  }

  var timeStr = '';
  if (p.start && p.start !== '-') {
    timeStr = p.start;
    if (p.slut && p.slut !== '-') timeStr += '–' + p.slut;
  }

  // Working now?
  var isNow = false;
  if (p.turnr && p.start && p.start !== '-' && p.slut && p.slut !== '-') {
    isNow = isTimeNow(p.start, p.slut);
  }

  // SE/DK/RES classification
  var cls = classifyPosTurn(p.turnr, p.roll);

  // Has trains? (for expandable indicator)
  var hasTrains = p.tagnr && p.tagnr.length > 0;

  var html = '<div class="pos-card ' + rollClass + (isNow ? ' pos-card-now' : '') + '"' +
    (hasTrains ? ' data-expandable="1"' : '') + '>';

  // Left: role badge
  html += '<span class="pos-card-icon">' + rollLabel + '</span>';

  // Middle: two rows
  html += '<div class="pos-card-body">';

  // Row 1: namn + ort
  html += '<div class="pos-card-row">';
  html += '<span class="pos-card-name">' + escPosHtml(p.namn || '?') + '</span>';
  if (p.ort) html += '<span class="pos-card-ort">' + escPosHtml(p.ort) + '</span>';
  html += '</div>';

  // Row 2: tid + tur
  html += '<div class="pos-card-row">';
  if (timeStr) html += '<span class="pos-card-time">' + timeStr + '</span>';
  if (p.turnr) html += '<span class="pos-card-tur">' + escPosHtml(p.turnr) + '</span>';
  html += '</div>';

  html += '</div>';

  // Right: SE/DK/RES tag + expand chevron
  html += '<div class="pos-card-end">';
  if (cls.tag) {
    html += '<span class="pos-card-tag ' + cls.tagClass + '">' + cls.tag + '</span>';
  }
  if (isNow) html += '<span class="pos-card-now-dot" title="Jobbar nu">●</span>';
  if (hasTrains) html += '<span class="pos-card-chevron">▾</span>';
  html += '</div>';

  // Hidden trains (for expandable, del 2)
  if (hasTrains) {
    html += '<div class="pos-card-trains">';
    for (var t = 0; t < p.tagnr.length; t++) {
      html += '<span class="pos-train-badge">' + escPosHtml(p.tagnr[t]) + '</span>';
    }
    html += '</div>';
  }

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

  // Date display → open native calendar
  var dateBtn = document.getElementById('posDateDisplayBtn');
  var datePicker = document.getElementById('posNativeDatePicker');
  if (dateBtn && datePicker) {
    dateBtn.addEventListener('click', function() {
      datePicker.showPicker ? datePicker.showPicker() : datePicker.focus();
    });
    datePicker.addEventListener('change', function() {
      var val = this.value;
      if (!val) return;
      // Snap to closest available date
      if (_posAvailDates.indexOf(val) !== -1) {
        _posCurrentDate = val;
      } else {
        // Find closest available date
        var closest = _posAvailDates[0];
        for (var di = 0; di < _posAvailDates.length; di++) {
          if (_posAvailDates[di] <= val) closest = _posAvailDates[di];
        }
        _posCurrentDate = closest;
      }
      renderPositions();
    });
  }

  // Expandable cards (click to toggle trains)
  var cards = document.querySelectorAll('.pos-card[data-expandable]');
  for (var ci = 0; ci < cards.length; ci++) {
    cards[ci].addEventListener('click', function() {
      this.classList.toggle('expanded');
    });
  }

  // Roll dropdown
  var rollSelect = document.getElementById('posFilterRoll');
  if (rollSelect) {
    rollSelect.addEventListener('change', function() {
      _posActiveFilter = this.value;
      renderPositions();
    });
  }

  // Ort dropdown
  var ortSelect = document.getElementById('posFilterOrt');
  if (ortSelect) {
    ortSelect.addEventListener('change', function() {
      _posActiveOrt = this.value;
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
