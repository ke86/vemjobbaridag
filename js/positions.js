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
var _posActiveChips = {};   // { now:true, res:true, ... }
var _posFilterOpen = false;

// =============================================
// PAGE SHOW / HIDE
// =============================================
function onPositionsPageShow() {
  if (!_posCache || (Date.now() - _posCache.ts) > _posCacheTTL) {
    fetchPositions();
  } else {
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

  var html = '';

  // Date picker
  html += buildPosDatePicker();

  // Meta info
  if (data.meta && data.meta.skapad) {
    var updatedStr = formatPosDate(data.meta.skapad);
    html += '<div class="pos-meta">Uppdaterad: ' + updatedStr + '</div>';
  }

  // ── Search bar (full width, above filters) ──
  html += '<div class="pos-search-bar">';
  html += '<input type="text" class="pos-search-input" id="posSearchInput" placeholder="Sök namn, tåg, tur…" value="' + escPosAttr(_posSearchQuery) + '">';
  if (_posSearchQuery) {
    html += '<button class="pos-search-clear" id="posSearchClear">✕</button>';
  }
  html += '</div>';

  // ── Filter row: Roll | Ort | Filter ──
  var uniqueOrts = getUniqueOrts(dayData);
  var chipCount = countActiveChips();

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

  // Filter button (looks like a select)
  html += '<div class="pos-filter-group">';
  html += '<label class="pos-filter-label">Filter</label>';
  html += '<button class="pos-filter-btn" id="posFilterBtn">';
  html += chipCount > 0 ? 'Filter (' + chipCount + ')' : 'Alla';
  html += '<span class="pos-filter-btn-arrow">▾</span>';
  html += '</button>';
  html += '</div>';

  html += '</div>';

  // ── Filter chip panel (collapsible) ──
  html += '<div class="pos-chip-panel' + (_posFilterOpen ? ' open' : '') + '" id="posChipPanel">';
  var chips = [
    { id: 'now',    label: 'Jobbar nu' },
    { id: 'res',    label: 'Reserv' },
    { id: 'se',     label: 'Sverige' },
    { id: 'dk',     label: 'Danmark' },
    { id: 'tp',     label: 'Ändrad' },
    { id: 'adm',    label: 'ADM' },
    { id: 'utb',    label: 'Utbildning' },
    { id: 'insutb', label: 'Instruktör' }
  ];
  for (var ci = 0; ci < chips.length; ci++) {
    var c = chips[ci];
    var isActive = _posActiveChips[c.id] ? ' active' : '';
    html += '<button class="pos-chip' + isActive + '" data-chip="' + c.id + '">' + c.label + '</button>';
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

function countActiveChips() {
  var n = 0;
  for (var k in _posActiveChips) {
    if (_posActiveChips[k]) n++;
  }
  return n;
}

function filterPositions(dayData) {
  var result = [];
  var query = _posSearchQuery.toLowerCase().trim();
  var hasChips = countActiveChips() > 0;

  for (var i = 0; i < dayData.length; i++) {
    var p = dayData[i];

    // Role filter (dropdown) — TIL code overrides role for TIL filter
    if (_posActiveFilter !== 'alla') {
      var roll = (p.roll || '').toLowerCase();
      var hasTilCode = !!isTilCode(p.turnr);
      if (_posActiveFilter === 'lokforare' && roll.indexOf('lokförare') === -1) continue;
      if (_posActiveFilter === 'tagvard' && roll.indexOf('tågvärd') === -1) continue;
      if (_posActiveFilter === 'til' && !hasTilCode && roll.indexOf('trafik') === -1 && roll.indexOf('informationsledare') === -1) continue;
    }

    // Ort filter (dropdown) — TIL bypass: TIL persons shown on all orts
    if (_posActiveOrt !== 'alla') {
      if (!isTilCode(p.turnr) && (p.ort || '').trim() !== _posActiveOrt) continue;
    }

    // Chip filters (OR logic — match at least one active chip)
    if (hasChips) {
      var flags = classifyPosFlags(p);
      var chipMatch = false;
      if (_posActiveChips.now && flags.isNow) chipMatch = true;
      if (_posActiveChips.res && flags.isRes) chipMatch = true;
      if (_posActiveChips.se && flags.isSE) chipMatch = true;
      if (_posActiveChips.dk && flags.isDK) chipMatch = true;
      if (_posActiveChips.tp && flags.isTP) chipMatch = true;
      if (_posActiveChips.adm && flags.isAdm) chipMatch = true;
      if (_posActiveChips.utb && flags.isUtb) chipMatch = true;
      if (_posActiveChips.insutb && flags.isInsutb) chipMatch = true;
      if (!chipMatch) continue;
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
/**
 * TIL shift times — fallback when API omits start/slut.
 * Also serves as the canonical list of all TIL codes (keys).
 */
var TIL_SHIFT_TIMES = {
  'PL1':  ['06:00','14:15'], 'PL2':  ['14:00','22:30'], 'PL3':  ['22:15','06:15'],
  'PL4':  ['14:00','22:45'], 'PL5':  ['22:30','06:30'], 'PL6':  ['06:15','14:15'],
  'FL1':  ['06:00','14:15'], 'FL2':  ['14:00','22:30'], 'FL3':  ['22:15','06:15'],
  'FL4':  ['14:00','22:45'], 'FL5':  ['22:30','06:30'], 'FL6':  ['06:15','14:15'], 'FL7': ['22:30','06:15'],
  'IL1':  ['05:45','13:45'], 'IL2':  ['13:30','22:00'],
  'IL61': ['06:15','14:30'], 'IL62': ['14:15','22:00'],
  'IL71': ['06:15','14:30'], 'IL72': ['14:15','22:00'],
  'SL1':  ['06:00','14:15'], 'SL2':  ['14:00','22:30'], 'SL3':  ['22:15','06:15'],
  'SL4':  ['14:00','22:45'], 'SL5':  ['22:30','06:30'], 'SL6':  ['06:15','14:15'], 'SL7': ['22:30','06:15'],
  'DK1':  ['05:00','13:00'], 'DK2':  ['11:00','21:00'],
  'DK61': ['09:00','19:00'], 'DK71': ['09:00','19:00'],
  'TDS1': ['06:30','14:45'], 'TDS2': ['14:30','23:00'], 'TDS3': ['22:45','06:45']
};

/**
 * TIL prefix → readable label.
 */
var TIL_LABELS = {
  'PL': 'Personal', 'FL': 'Fordon', 'IL': 'Info',
  'SL': 'Drift SE', 'DK': 'Drift DK', 'TDS': 'Driftstöd'
};

/**
 * Check if a turn code is a TIL code. Returns the uppercase code or false.
 * Uses TIL_SHIFT_TIMES keys as canonical list.
 */
function isTilCode(turnr) {
  if (!turnr) return false;
  var t = turnr.toUpperCase().trim();
  return TIL_SHIFT_TIMES.hasOwnProperty(t) ? t : false;
}

/**
 * Get the TIL label for a TIL code, e.g. "PL1" → "Personal"
 */
function getTilLabel(code) {
  var prefix = code.replace(/\d+$/, '');
  return TIL_LABELS[prefix] || '';
}

/**
 * Hardcoded 5-digit TIL turn times — API sometimes omits start/slut for these.
 * Key: turn number, Value: [start, slut]
 */
var TIL_TURN_TIMES = {
  // ── Måndag ──
  '11291': ['04:15','11:30'], '11292': ['11:30','18:00'], '11293': ['18:00','00:00'],
  '11281': ['05:00','12:00'], '11282': ['12:00','19:00'],
  '11491': ['04:15','11:30'], '11492': ['11:30','18:00'], '11493': ['18:00','00:00'],
  '11481': ['05:00','12:00'], '11482': ['12:00','19:00'],
  '21291': ['04:35','12:00'], '21292': ['12:30','19:00'],
  '21391': ['04:35','12:00'], '21392': ['12:30','19:00'],
  '31191': ['03:30','11:30'], '31192': ['11:30','21:00'],
  '31391': ['03:30','11:30'], '31392': ['11:30','21:00'],
  '41191': ['04:50','12:10'], '41391': ['04:50','12:10'],
  '51191': ['04:00','11:30'], '51391': ['04:00','11:30'],
  '61191': ['04:35','12:00'], '61192': ['12:00','19:00'],
  '61391': ['04:35','12:00'], '61392': ['12:00','19:00'],
  // ── Tisdag–Torsdag ──
  '12291': ['03:45','11:30'], '12292': ['11:30','18:00'], '12293': ['18:00','00:00'],
  '12281': ['05:00','12:00'], '12282': ['12:00','19:00'],
  '12491': ['03:45','11:30'], '12492': ['11:30','18:00'], '12493': ['18:00','00:00'],
  '12481': ['05:00','12:00'], '12482': ['12:00','19:00'],
  '22291': ['04:35','12:00'], '22292': ['12:00','21:00'],
  '22391': ['04:35','12:00'], '22392': ['12:00','21:00'],
  '32191': ['03:50','11:30'], '32192': ['11:30','21:00'],
  '32391': ['03:50','11:30'], '32392': ['11:30','21:00'],
  '42191': ['05:10','12:10'], '42391': ['05:10','12:10'],
  '52191': ['04:00','11:30'], '52391': ['04:00','11:30'],
  '62191': ['04:35','12:00'], '62192': ['12:00','19:00'],
  '62391': ['04:35','12:00'], '62392': ['12:00','19:00'],
  // ── Fredag ──
  '15291': ['03:45','11:30'], '15292': ['11:30','18:00'], '15293': ['18:00','00:00'],
  '15281': ['05:00','12:00'], '15282': ['12:00','19:00'],
  '15491': ['03:45','11:30'], '15492': ['11:30','18:00'], '15493': ['18:00','00:00'],
  '15481': ['05:00','12:00'], '15482': ['12:00','19:00'],
  '25291': ['04:35','12:00'], '25292': ['12:00','21:00'],
  '25391': ['04:35','12:00'], '25392': ['12:00','21:00'],
  '35191': ['03:50','11:30'], '35192': ['11:30','21:00'],
  '35391': ['03:50','11:30'], '35392': ['11:30','21:00'],
  '45191': ['05:10','12:10'], '45391': ['05:10','12:10'],
  '55191': ['04:00','11:30'], '55391': ['04:00','11:30'],
  '65191': ['04:35','12:00'], '65192': ['12:00','19:00'],
  '65391': ['04:35','12:00'], '65392': ['12:00','19:00'],
  // ── Lördag ──
  '16291': ['03:45','11:30'], '16292': ['11:30','18:00'], '16293': ['18:00','00:00'],
  '16281': ['09:00','19:00'],
  '16491': ['03:45','11:30'], '16492': ['11:30','18:00'], '16493': ['18:00','00:00'],
  '16481': ['09:00','19:00'],
  '26291': ['05:40','13:15'], '26391': ['05:40','13:15'],
  '36191': ['04:10','12:00'], '36192': ['12:00','20:00'],
  '36391': ['04:10','12:00'], '36392': ['12:00','20:00'],
  '46191': ['06:10','13:10'], '46391': ['06:10','13:10'],
  '56191': ['05:00','12:30'], '56391': ['05:00','12:30'],
  '66191': ['05:35','13:15'], '66192': ['12:00','19:00'],
  '66391': ['05:35','13:15'], '66392': ['12:00','19:00'],
  // ── Söndag ──
  '17291': ['03:45','11:30'], '17292': ['11:30','18:00'], '17293': ['18:00','00:00'],
  '17281': ['09:00','19:00'],
  '17491': ['03:45','11:30'], '17492': ['11:30','18:00'], '17493': ['18:00','00:00'],
  '17481': ['09:00','19:00'],
  '37191': ['04:10','12:00'], '37192': ['12:00','20:00'],
  '37391': ['04:10','12:00'], '37392': ['12:00','20:00'],
  '47191': ['06:10','13:15'], '47391': ['06:10','13:15'],
  '57191': ['07:00','15:20'], '57391': ['07:00','15:20'],
  '67191': ['05:35','13:15'], '67192': ['12:00','19:00'],
  '67391': ['05:35','13:15'], '67392': ['12:00','19:00']
};

/**
 * Get start/slut for a person entry — falls back to TIL_TURN_TIMES lookup.
 */
function getPosTime(p) {
  var start = p.start;
  var slut = p.slut;
  if ((!start || start === '-') && p.turnr) {
    var key = p.turnr.trim();
    var keyUpper = key.toUpperCase();
    // Check TIL shift codes first (PL1, DK2, etc.)
    if (TIL_SHIFT_TIMES[keyUpper]) {
      start = TIL_SHIFT_TIMES[keyUpper][0];
      slut = TIL_SHIFT_TIMES[keyUpper][1];
    // Then 5-digit TIL turn numbers (11291, etc.)
    } else if (TIL_TURN_TIMES[key]) {
      start = TIL_TURN_TIMES[key][0];
      slut = TIL_TURN_TIMES[key][1];
    }
  }
  return { start: start, slut: slut };
}

/**
 * Full classification of a person entry.
 * Returns all boolean flags used by card display AND chip filtering.
 */
function classifyPosFlags(p) {
  var flags = { isRes: false, isSE: false, isDK: false, isAdm: false, isUtb: false, isInsutb: false, isTP: false, isNow: false, isTil: false, tag: '', tagClass: '' };
  var turnr = p.turnr || '';
  var t = turnr.toUpperCase().trim();
  var rollStr = (p.roll || '').toLowerCase();

  // Working now? (use getPosTime for TIL fallback)
  var pTime = getPosTime(p);
  if (turnr && pTime.start && pTime.start !== '-' && pTime.slut && pTime.slut !== '-') {
    flags.isNow = isTimeNow(pTime.start, pTime.slut);
  }

  if (!turnr) return flags;

  // TIL shifts (use TIL_SHIFT_TIMES as canonical list)
  if (TIL_SHIFT_TIMES.hasOwnProperty(t)) {
    flags.isTil = true;
    return flags;
  }

  // ADM — turn contains ADM
  if (t.indexOf('ADM') !== -1) {
    flags.isAdm = true;
    flags.tag = 'ADM';
    flags.tagClass = 'pos-tag-adm';
    return flags;
  }

  // INSUTB — turn contains INSUTB (check before UTB!)
  if (t.indexOf('INSUTB') !== -1) {
    flags.isInsutb = true;
    flags.tag = 'INST';
    flags.tagClass = 'pos-tag-insutb';
    return flags;
  }

  // UTB — turn contains UTB (but not INSUTB, already caught above)
  if (t.indexOf('UTB') !== -1) {
    flags.isUtb = true;
    flags.tag = 'UTB';
    flags.tagClass = 'pos-tag-utb';
    return flags;
  }

  // TP — ends with TP or format NNNNNN-NNNNNN
  if (/TP$/i.test(turnr)) {
    flags.isTP = true;
  }
  if (/^\d{6}-\d{6}$/.test(t)) {
    flags.isTP = true;
    flags.isRes = true;
    flags.tag = 'RES';
    flags.tagClass = 'pos-tag-res';
    return flags;
  }

  // Reserve: starts with RESERV
  if (t.indexOf('RESERV') === 0) {
    flags.isRes = true;
    flags.tag = 'RES';
    flags.tagClass = 'pos-tag-res';
    return flags;
  }

  // Reserve: role is "Reserv"
  if (rollStr.indexOf('reserv') !== -1) {
    flags.isRes = true;
    flags.tag = 'RES';
    flags.tagClass = 'pos-tag-res';
    return flags;
  }

  // Strip TP suffix for digit analysis
  var clean = t.replace(/TP$/i, '');

  // Extract leading digits
  var digits = clean.match(/^(\d+)/);
  if (!digits || digits[1].length < 4) {
    // If TP was detected but we can't parse digits, still show TP tag
    if (flags.isTP) {
      flags.tag = 'TP';
      flags.tagClass = 'pos-tag-tp';
    }
    return flags;
  }
  var d = digits[1];

  // 4th digit 8 or 9 → reserve
  if (d[3] === '8' || d[3] === '9') {
    flags.isRes = true;
    // TP takes priority in tag display if both
    if (flags.isTP) {
      flags.tag = 'TP';
      flags.tagClass = 'pos-tag-tp';
    } else {
      flags.tag = 'RES';
      flags.tagClass = 'pos-tag-res';
    }
    return flags;
  }

  // 3rd digit odd → SE, even → DK
  if (d.length >= 3) {
    var third = parseInt(d[2], 10);
    if (third % 2 === 1) {
      flags.isSE = true;
    } else {
      flags.isDK = true;
    }
  }

  // Determine tag: TP overrides SE/DK
  if (flags.isTP) {
    flags.tag = 'TP';
    flags.tagClass = 'pos-tag-tp';
  } else if (flags.isSE) {
    flags.tag = 'SE';
    flags.tagClass = 'pos-tag-se';
  } else if (flags.isDK) {
    flags.tag = 'DK';
    flags.tagClass = 'pos-tag-dk';
  }

  return flags;
}

/**
 * Legacy wrapper for card tag display — now delegates to classifyPosFlags.
 */
function classifyPosTurn(turnr, roll) {
  var flags = classifyPosFlags({ turnr: turnr, roll: roll, start: null, slut: null });
  return { tag: flags.tag, tagClass: flags.tagClass };
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

  // Badge-override: TIL turn code forces TIL badge regardless of roll
  var tilCode = isTilCode(p.turnr);
  if (tilCode) {
    rollClass = 'pos-role-til';
    rollLabel = 'TIL';
  }

  var pTime = getPosTime(p);
  var timeStr = '';
  if (pTime.start && pTime.start !== '-') {
    timeStr = pTime.start;
    if (pTime.slut && pTime.slut !== '-') timeStr += '–' + pTime.slut;
  }

  // Full classification
  var flags = classifyPosFlags(p);

  // Has trains?
  var hasTrains = p.tagnr && p.tagnr.length > 0;
  var hasSchedule = _posAvailDates.length > 1 && p.namn;

  var isExpandable = hasTrains || hasSchedule;

  var html = '<div class="pos-card ' + rollClass + (flags.isNow ? ' pos-card-now' : '') + '"' +
    (isExpandable ? ' data-expandable="1"' : '') +
    (p.namn ? ' data-person="' + escPosAttr(p.namn) + '"' : '') + '>';

  // Left: role badge
  html += '<span class="pos-card-icon">' + rollLabel + '</span>';

  // Middle: two rows
  html += '<div class="pos-card-body">';

  // Row 1: namn + ort
  html += '<div class="pos-card-row">';
  html += '<span class="pos-card-name">' + escPosHtml(p.namn || '?') + '</span>';
  if (p.ort) html += '<span class="pos-card-ort">' + escPosHtml(p.ort) + '</span>';
  html += '</div>';

  // Row 2: tid + tur (TIL codes show label e.g. "PL1 · Personal")
  html += '<div class="pos-card-row">';
  if (timeStr) html += '<span class="pos-card-time">' + timeStr + '</span>';
  if (p.turnr) {
    var turDisplay = escPosHtml(p.turnr);
    if (tilCode) {
      var tilLabel = getTilLabel(tilCode);
      if (tilLabel) turDisplay += ' · ' + escPosHtml(tilLabel);
    }
    html += '<span class="pos-card-tur">' + turDisplay + '</span>';
  }
  html += '</div>';

  html += '</div>';

  // Right: tag + now dot + chevron
  html += '<div class="pos-card-end">';
  if (flags.tag) {
    html += '<span class="pos-card-tag ' + flags.tagClass + '">' + flags.tag + '</span>';
  }
  if (flags.isNow) html += '<span class="pos-card-now-dot" title="Jobbar nu">●</span>';
  if (isExpandable) html += '<span class="pos-card-chevron">▾</span>';
  html += '</div>';

  // Hidden trains section (schedule injected on-demand via click handler)
  if (isExpandable) {
    html += '<div class="pos-card-trains">';
    if (hasTrains) {
      for (var t = 0; t < p.tagnr.length; t++) {
        html += '<span class="pos-train-badge">' + escPosHtml(p.tagnr[t]) + '</span>';
      }
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// =============================================
// PERSON SCHEDULE VIEW
// =============================================

/**
 * Build a compact schedule list for a person across all available dates.
 */
function buildPersonSchedule(personName) {
  if (!_posCache || !_posCache.data || !_posCache.data.dagar) return '';
  var dagar = _posCache.data.dagar;
  var today = getTodayStr();
  var dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  var nameLower = personName.toLowerCase();

  var html = '<div class="pos-schedule-list">';
  html += '<div class="pos-schedule-header">';
  html += '<span>Dag</span><span>Tur</span><span>Tid</span><span></span>';
  html += '</div>';

  for (var di = 0; di < _posAvailDates.length; di++) {
    var dateStr = _posAvailDates[di];
    var dayArr = dagar[dateStr] || [];
    var dateObj = parsePosDate(dateStr);
    var dayLabel = dayNames[dateObj.getDay()] + ' ' + dateObj.getDate() + '/' + (dateObj.getMonth() + 1);
    var isToday = dateStr === today;
    var isCurrent = dateStr === _posCurrentDate;

    // Find person in this day
    var found = null;
    for (var pi = 0; pi < dayArr.length; pi++) {
      if ((dayArr[pi].namn || '').toLowerCase() === nameLower) {
        found = dayArr[pi];
        break;
      }
    }

    var rowClass = 'pos-schedule-row';
    if (isToday) rowClass += ' pos-schedule-today';
    if (isCurrent) rowClass += ' pos-schedule-current';

    if (found) {
      var flags = classifyPosFlags(found);
      var fTime = getPosTime(found);
      var timeStr = '';
      if (fTime.start && fTime.start !== '-') {
        timeStr = fTime.start;
        if (fTime.slut && fTime.slut !== '-') timeStr += '–' + fTime.slut;
      }
      var tagHtml = flags.tag ? '<span class="pos-card-tag ' + flags.tagClass + '">' + flags.tag + '</span>' : '';

      html += '<div class="' + rowClass + '">';
      html += '<span class="pos-schedule-date">' + dayLabel + '</span>';
      var schedTurDisplay = escPosHtml(found.turnr || '–');
      var schedTilCode = isTilCode(found.turnr);
      if (schedTilCode) {
        var schedTilLabel = getTilLabel(schedTilCode);
        if (schedTilLabel) schedTurDisplay += ' · ' + escPosHtml(schedTilLabel);
      }
      html += '<span class="pos-schedule-tur">' + schedTurDisplay + '</span>';
      html += '<span class="pos-schedule-time">' + (timeStr || '–') + '</span>';
      html += '<span class="pos-schedule-tag">' + tagHtml + '</span>';
      html += '</div>';
    } else {
      html += '<div class="' + rowClass + ' pos-schedule-ledig">';
      html += '<span class="pos-schedule-date">' + dayLabel + '</span>';
      html += '<span class="pos-schedule-tur">Ledig</span>';
      html += '<span class="pos-schedule-time">–</span>';
      html += '<span class="pos-schedule-tag"></span>';
      html += '</div>';
    }
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
      if (_posAvailDates.indexOf(val) !== -1) {
        _posCurrentDate = val;
      } else {
        var closest = _posAvailDates[0];
        for (var di = 0; di < _posAvailDates.length; di++) {
          if (_posAvailDates[di] <= val) closest = _posAvailDates[di];
        }
        _posCurrentDate = closest;
      }
      renderPositions();
    });
  }

  // Expandable cards — one open at a time, schedule injected on expand
  var cards = document.querySelectorAll('.pos-card[data-expandable]');
  for (var ci = 0; ci < cards.length; ci++) {
    cards[ci].addEventListener('click', function(e) {
      // Don't toggle if clicking inside the schedule list (allow scrolling etc.)
      if (e.target.closest('.pos-schedule-list')) return;

      var wasExpanded = this.classList.contains('expanded');

      // Close all other expanded cards + remove their injected schedules
      var allExpanded = document.querySelectorAll('.pos-card.expanded');
      for (var ei = 0; ei < allExpanded.length; ei++) {
        allExpanded[ei].classList.remove('expanded');
        var oldSched = allExpanded[ei].querySelector('.pos-schedule-list');
        if (oldSched) oldSched.remove();
      }

      // If this card was already open, we just closed it — done
      if (wasExpanded) return;

      // Expand this card
      this.classList.add('expanded');

      // Build and inject schedule on-demand
      var personName = this.getAttribute('data-person');
      if (personName && _posAvailDates.length > 1) {
        var trainsDiv = this.querySelector('.pos-card-trains');
        if (trainsDiv) {
          trainsDiv.insertAdjacentHTML('beforeend', buildPersonSchedule(personName));
        }
      }
    });
  }

  // Filter button (toggle chip panel)
  var filterBtn = document.getElementById('posFilterBtn');
  if (filterBtn) {
    filterBtn.addEventListener('click', function() {
      _posFilterOpen = !_posFilterOpen;
      var panel = document.getElementById('posChipPanel');
      if (panel) panel.classList.toggle('open', _posFilterOpen);
      this.classList.toggle('active', _posFilterOpen);
    });
  }

  // Chip toggles
  var chipBtns = document.querySelectorAll('.pos-chip');
  for (var chi = 0; chi < chipBtns.length; chi++) {
    chipBtns[chi].addEventListener('click', function() {
      var chipId = this.getAttribute('data-chip');
      _posActiveChips[chipId] = !_posActiveChips[chipId];
      if (!_posActiveChips[chipId]) delete _posActiveChips[chipId];
      renderPositions();
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

  if (endMin <= startMin) {
    return nowMin >= startMin || nowMin <= endMin;
  }
  return nowMin >= startMin && nowMin <= endMin;
}

function formatPosShortDate(dateStr) {
  var d = parsePosDate(dateStr);
  return d.getDate() + '/' + (d.getMonth() + 1);
}

function escPosHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escPosAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
