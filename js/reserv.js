/**
 * reserv.js - Reservlista page
 * Shows reserve workers from positions data (always current).
 * Dagvy details (segments) come from reservdagvy Firebase collection,
 * which is populated via Settings -> Data -> Hämta reservdata.
 */

/* global fetchReservDagvyFromFirebase, showReservDagvyPopup, _posCache, classifyPosFlags, getPosTime, fetchPositions */

// =============================================
// STATE
// =============================================
var _reservData = null;          // reservdagvy document (for dagvy popup segments)
var _reservDataLoaded = false;   // whether reservdagvy fetch has been attempted
var _reservSelectedDay = 'idag'; // 'idag' | 'imorgon'
var _reservFilterRoll = 'alla';  // 'alla' | 'Lokförare' | 'Tågvärd'
var _reservFilterOrt = 'alla';   // 'alla' | specific city
var _posOrtMap = null;           // { normalizedName: ort } built from all pos days

// =============================================
// PAGE SHOW / HIDE
// =============================================
function onReservPageShow() {
  window._ptrDisabled = true;
  fetchAndRenderReserv();
}

function onReservPageHide() {
  window._ptrDisabled = false;
}

// =============================================
// FETCH
// =============================================
async function fetchAndRenderReserv() {
  var container = document.getElementById('reservContainer');
  if (container) {
    container.innerHTML =
      '<div class="reserv-loading">' +
        '<div class="reserv-spinner"></div>' +
        '<div>Hämtar reserver...</div>' +
      '</div>';
  }

  // Ensure positions data is loaded
  if (typeof _posCache === 'undefined' || !_posCache || !_posCache.data || !_posCache.data.dagar) {
    if (typeof fetchPositions === 'function') {
      fetchPositions();
      // Wait for positions to load (poll up to 15s)
      var waited = 0;
      while ((!_posCache || !_posCache.data) && waited < 15000) {
        await new Promise(function(r) { setTimeout(r, 500); });
        waited += 500;
      }
    }
  }

  if (!_posCache || !_posCache.data || !_posCache.data.dagar) {
    _showReservError('Kunde inte hämta positionsdata');
    return;
  }

  // Also fetch reservdagvy data in the background (for dagvy popup segments)
  if (!_reservDataLoaded) {
    try {
      var data = await fetchReservDagvyFromFirebase();
      if (data && data.days && Array.isArray(data.days)) {
        _reservData = data;
      }
    } catch (err) {
      console.error('[RESERV] reservdagvy fetch error:', err);
    }
    _reservDataLoaded = true;
  }

  renderReserv();
}

function _showReservError(msg) {
  var container = document.getElementById('reservContainer');
  if (!container) return;
  container.innerHTML =
    '<div class="reserv-empty">' +
      '<div class="reserv-empty-icon">🛡️</div>' +
      '<p>' + msg + '</p>' +
    '</div>';
}

// =============================================
// RENDER
// =============================================
function renderReserv() {
  var container = document.getElementById('reservContainer');
  if (!container) return;

  if (!_posCache || !_posCache.data || !_posCache.data.dagar) {
    _showReservError('Ingen positionsdata tillgänglig');
    return;
  }

  var today = _getTodayStr();
  var tomorrow = _getTomorrowStr();
  var idag = _reservSelectedDay === 'idag';
  var imorgon = _reservSelectedDay === 'imorgon';
  var selectedDateStr = idag ? today : tomorrow;

  var allPersons = _getReservPersonsFromPositions(selectedDateStr);

  // Apply ort filter first (for counting purposes too)
  var ortFiltered = allPersons;
  if (_reservFilterOrt !== 'alla') {
    ortFiltered = allPersons.filter(function(p) {
      return (p.ort || '').trim() === _reservFilterOrt;
    });
  }

  // Count by role after ort filter, before roll filter
  var lokCount = 0, tvCount = 0;
  for (var k = 0; k < ortFiltered.length; k++) {
    var r = (ortFiltered[k].roll || '').toLowerCase();
    if (r.indexOf('lokförare') !== -1) lokCount++;
    else if (r.indexOf('tågvärd') !== -1) tvCount++;
  }

  // Apply roll filter for display list
  var persons = ortFiltered;
  if (_reservFilterRoll !== 'alla') {
    persons = persons.filter(function(p) {
      return (p.roll || '').toLowerCase() === _reservFilterRoll.toLowerCase();
    });
  }

  // Sort by start time
  persons = persons.slice().sort(function(a, b) {
    var ta = (a.start || '');
    var tb = (b.start || '');
    if (ta === '-') ta = '99:99';
    if (tb === '-') tb = '99:99';
    return ta.localeCompare(tb);
  });

  var html =
    '<div class="reserv-controls">' +
      '<div class="reserv-toggle-row">' +
        '<div class="reserv-day-toggle">' +
          '<button class="reserv-day-btn' + (idag ? ' active' : '') + '" onclick="setReservDay(\'idag\')">Idag</button>' +
          '<button class="reserv-day-btn' + (imorgon ? ' active' : '') + '" onclick="setReservDay(\'imorgon\')">Imorgon</button>' +
        '</div>' +
        '<div class="reserv-count-pills">' +
          '<span class="reserv-count-lok">Lkf ' + lokCount + '</span>' +
          '<span class="reserv-count-tv">TV ' + tvCount + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="reserv-filter-row">' +
        '<select class="reserv-select" id="reservRollSelect" onchange="setReservRoll(this.value)">' +
          '<option value="alla"' + (_reservFilterRoll === 'alla' ? ' selected' : '') + '>Alla roller</option>' +
          '<option value="Lokförare"' + (_reservFilterRoll === 'Lokförare' ? ' selected' : '') + '>Lokförare</option>' +
          '<option value="Tågvärd"' + (_reservFilterRoll === 'Tågvärd' ? ' selected' : '') + '>Tågvärd</option>' +
        '</select>' +
        '<select class="reserv-select" id="reservOrtSelect" onchange="setReservOrt(this.value)">' +
          '<option value="alla"' + (_reservFilterOrt === 'alla' ? ' selected' : '') + '>Alla orter</option>' +
          '<option value="Halmstad"' + (_reservFilterOrt === 'Halmstad' ? ' selected' : '') + '>Halmstad</option>' +
          '<option value="Helsingborg"' + (_reservFilterOrt === 'Helsingborg' ? ' selected' : '') + '>Helsingborg</option>' +
          '<option value="Hässleholm"' + (_reservFilterOrt === 'Hässleholm' ? ' selected' : '') + '>Hässleholm</option>' +
          '<option value="Kalmar"' + (_reservFilterOrt === 'Kalmar' ? ' selected' : '') + '>Kalmar</option>' +
          '<option value="Karlskrona"' + (_reservFilterOrt === 'Karlskrona' ? ' selected' : '') + '>Karlskrona</option>' +
          '<option value="Malmö"' + (_reservFilterOrt === 'Malmö' ? ' selected' : '') + '>Malmö</option>' +
        '</select>' +
      '</div>' +
    '</div>';

  if (persons.length === 0) {
    html +=
      '<div class="reserv-empty">' +
        '<div class="reserv-empty-icon">🛡️</div>' +
        '<p>Inga reserver hittades</p>' +
      '</div>';
  } else {
    html += '<div class="reserv-list">';
    for (var i = 0; i < persons.length; i++) {
      html += _buildReservCard(persons[i], selectedDateStr);
    }
    html += '</div>';
  }

  // Scraped-at info from reservdagvy (shows when dagvy data was last fetched)
  if (_reservData && _reservData.scrapedAt) {
    var scrapedDate = new Date(_reservData.scrapedAt);
    var scrapedStr = scrapedDate.toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    html += '<div class="reserv-scraped-at">Dagvy hämtad ' + scrapedStr + '</div>';
  } else {
    html += '<div class="reserv-scraped-at">Ingen dagvy hämtad — använd Inställningar → Data → Hämta reservdata för dagvy</div>';
  }

  container.innerHTML = html;

  // Update sidebar menu badges
  updateReservMenuBadges();
}

// =============================================
// CARD BUILDER
// =============================================
function _buildReservCard(person, dateStr) {
  var rollClass = '';
  if ((person.roll || '').toLowerCase().indexOf('lokförare') !== -1) rollClass = ' pos-role-lok';
  else if ((person.roll || '').toLowerCase().indexOf('tågvärd') !== -1) rollClass = ' pos-role-tv';

  var activeClass = _isWorkingNowPos(person) ? ' reserv-card--active-now' : '';

  var badgeHtml = '';
  var flags = (typeof classifyPosFlags === 'function') ? classifyPosFlags(person) : null;
  if (flags && flags.tag) {
    var badgeColorClass = 'reserv-badge-' + (flags.tagClass || 'pos-tag-res').replace('pos-tag-', '');
    badgeHtml = '<span class="reserv-badge ' + badgeColorClass + '">' + _esc(flags.tag) + '</span>';
  }

  var ort = (person.ort || '').trim();
  var ortHtml = ort
    ? '<span class="reserv-card-ort">' + _esc(ort) + '</span>'
    : '';

  var pTime = (typeof getPosTime === 'function') ? getPosTime(person) : { start: person.start, slut: person.slut };
  var startStr = pTime.start && pTime.start !== '-' ? pTime.start : '';
  var endStr = pTime.slut && pTime.slut !== '-' ? pTime.slut : '';
  var timeHtml = (startStr && endStr)
    ? '<span class="reserv-card-time">' + _esc(startStr) + ' – ' + _esc(endStr) + '</span>'
    : '';

  var personDataJson = JSON.stringify(person).replace(/'/g, '&#39;').replace(/"/g, '&quot;');

  return '<div class="reserv-card' + rollClass + activeClass + '" onclick="openReservDagvy(this)" data-person=\'' + personDataJson + '\' data-date="' + _esc(dateStr) + '">' +
    '<div class="reserv-card-top">' +
      '<span class="reserv-card-name">' + _esc(person.namn || '') + '</span>' +
      badgeHtml +
    '</div>' +
    '<div class="reserv-card-bottom">' +
      ortHtml +
      timeHtml +
    '</div>' +
  '</div>';
}

// =============================================
// MENU BADGES
// =============================================
function updateReservMenuBadges() {
  var today = _getTodayStr();
  var todayPersons = _getReservPersonsFromPositions(today);
  var lokCount = 0, tvCount = 0;
  for (var i = 0; i < todayPersons.length; i++) {
    var r = (todayPersons[i].roll || '').toLowerCase();
    if (r.indexOf('lokförare') !== -1) lokCount++;
    else if (r.indexOf('tågvärd') !== -1) tvCount++;
  }
  var lokEl = document.getElementById('reservMenuLok');
  var tvEl = document.getElementById('reservMenuTv');
  if (lokEl) {
    lokEl.textContent = lokCount;
    lokEl.style.display = lokCount > 0 ? '' : 'none';
  }
  if (tvEl) {
    tvEl.textContent = tvCount;
    tvEl.style.display = tvCount > 0 ? '' : 'none';
  }
}

// =============================================
// EVENT HANDLERS
// =============================================
function setReservDay(day) {
  _reservSelectedDay = day;
  renderReserv();
}

function setReservRoll(roll) {
  _reservFilterRoll = roll;
  renderReserv();
}

function setReservOrt(ort) {
  _reservFilterOrt = ort;
  renderReserv();
}

function openReservDagvy(cardEl) {
  var personJson = cardEl.getAttribute('data-person');
  var dateStr = cardEl.getAttribute('data-date');
  if (!personJson) return;
  try {
    var posPerson = JSON.parse(personJson.replace(/&#39;/g, "'"));
    var mergedPerson = _mergePosWithDagvy(posPerson, dateStr);
    showReservDagvyPopup(mergedPerson, dateStr);
  } catch (e) {
    console.error('[RESERV] openReservDagvy parse error', e);
  }
}

// =============================================
// HELPERS
// =============================================

/**
 * Get reserve persons from positions cache for a given date.
 * Filters positions data using classifyPosFlags to find reserves.
 */
function _getReservPersonsFromPositions(dateStr) {
  if (typeof _posCache === 'undefined' || !_posCache || !_posCache.data || !_posCache.data.dagar) return [];
  var dayData = _posCache.data.dagar[dateStr];
  if (!Array.isArray(dayData)) return [];

  var result = [];
  for (var i = 0; i < dayData.length; i++) {
    var p = dayData[i];
    if (typeof classifyPosFlags !== 'function') break;
    var flags = classifyPosFlags(p);
    if (flags.isRes) {
      result.push(p);
    }
  }
  return result;
}

/**
 * Merge a positions-data person with reservdagvy segments.
 * Person info (name, turnr, start, end, ort, role) comes from positions data.
 * Segments (detailed dagvy) come from reservdagvy Firebase data.
 * If reservdagvy data is missing, returns person with empty segments and a notFound flag.
 */
function _mergePosWithDagvy(posPerson, dateStr) {
  var pTime = (typeof getPosTime === 'function') ? getPosTime(posPerson) : { start: posPerson.start, slut: posPerson.slut };

  var merged = {
    name: posPerson.namn || '',
    turnr: posPerson.turnr || '',
    start: (pTime.start && pTime.start !== '-') ? pTime.start : '',
    end: (pTime.slut && pTime.slut !== '-') ? pTime.slut : '',
    locName: (posPerson.ort || '').trim(),
    role: posPerson.roll || '',
    segments: [],
    notFound: true
  };

  // Try to find segments in reservdagvy data
  if (_reservData && _reservData.days) {
    var nameNorm = (posPerson.namn || '').toLowerCase().trim();
    for (var i = 0; i < _reservData.days.length; i++) {
      var day = _reservData.days[i];
      if (day.date !== dateStr) continue;
      if (!Array.isArray(day.persons)) continue;
      for (var j = 0; j < day.persons.length; j++) {
        var rp = day.persons[j];
        if ((rp.name || '').toLowerCase().trim() === nameNorm) {
          merged.segments = rp.segments || [];
          merged.badge = rp.badge || '';
          merged.badgeColor = rp.badgeColor || '';
          merged.notFound = rp.notFound || false;
          // Use reservdagvy times if available (more precise)
          if (rp.start) merged.start = rp.start;
          if (rp.end) merged.end = rp.end;
          return merged;
        }
      }
    }
  }

  return merged;
}

/**
 * Check if a positions-data person is currently working.
 */
function _isWorkingNowPos(person) {
  var pTime = (typeof getPosTime === 'function') ? getPosTime(person) : { start: person.start, slut: person.slut };
  if (!pTime.start || !pTime.slut || pTime.start === '-' || pTime.slut === '-') return false;
  var now = new Date();
  var hhmm = _pad(now.getHours()) + ':' + _pad(now.getMinutes());
  var s = pTime.start.substring(0, 5);
  var e = pTime.slut.substring(0, 5);
  if (s <= e) {
    return hhmm >= s && hhmm <= e;
  }
  // Overnight shift
  return hhmm >= s || hhmm <= e;
}

function _getTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());
}

function _getTomorrowStr() {
  var d = new Date();
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());
}

function _pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function _esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
