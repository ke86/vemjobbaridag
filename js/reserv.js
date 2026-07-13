/**
 * reserv.js - Reservlista page
 * Shows reserve workers from reservdagvy Firebase collection.
 * Filtered by Idag/Imorgon, Roll, and Ort.
 */

/* global fetchReservDagvyFromFirebase, showReservDagvyPopup, _posCache */

// =============================================
// STATE
// =============================================
var _reservData = null;          // full reservdagvy document
var _reservSelectedDay = 'idag'; // 'idag' | 'imorgon'
var _reservFilterRoll = 'alla';  // 'alla' | 'Lokförare' | 'Tågvärd'
var _reservFilterOrt = 'alla';   // 'alla' | specific city

// =============================================
// PAGE SHOW / HIDE
// =============================================
function onReservPageShow() {
  window._ptrDisabled = true;
  if (!_reservData) {
    fetchAndRenderReserv();
  } else {
    renderReserv();
  }
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
        '<div>Hämtar reservdata...</div>' +
      '</div>';
  }

  try {
    var data = await fetchReservDagvyFromFirebase();
    if (!data || !data.days || !Array.isArray(data.days)) {
      _showReservError('Ingen reservdata tillgänglig');
      return;
    }
    _reservData = data;
    renderReserv();
  } catch (err) {
    console.error('[RESERV]', err);
    _showReservError('Kunde inte hämta reservdata');
  }
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
  if (!container || !_reservData) return;

  var today = _getTodayStr();
  var tomorrow = _getTomorrowStr();
  var idag = _reservSelectedDay === 'idag';
  var imorgon = _reservSelectedDay === 'imorgon';
  var selectedDateStr = idag ? today : tomorrow;

  var allPersons = _getPersonsForDay(selectedDateStr);

  // Apply ort filter first (for counting purposes too)
  var ortFiltered = allPersons;
  if (_reservFilterOrt !== 'alla') {
    ortFiltered = allPersons.filter(function(p) {
      return _resolveOrt(p) === _reservFilterOrt;
    });
  }

  // Count by role after ort filter, before roll filter
  var lokCount = 0, tvCount = 0;
  for (var k = 0; k < ortFiltered.length; k++) {
    var r = (ortFiltered[k].role || '').toLowerCase();
    if (r.indexOf('lokförare') !== -1) lokCount++;
    else if (r.indexOf('tågvärd') !== -1) tvCount++;
  }

  // Apply roll filter for display list
  var persons = ortFiltered;
  if (_reservFilterRoll !== 'alla') {
    persons = persons.filter(function(p) {
      return (p.role || '').toLowerCase() === _reservFilterRoll.toLowerCase();
    });
  }

  // Sort by start time
  persons = persons.slice().sort(function(a, b) {
    return (a.start || '').localeCompare(b.start || '');
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

  // Scraped-at info
  if (_reservData && _reservData.scrapedAt) {
    var scrapedDate = new Date(_reservData.scrapedAt);
    var scrapedStr = scrapedDate.toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    html += '<div class="reserv-scraped-at">Hämtad ' + scrapedStr + '</div>';
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
  if ((person.role || '').toLowerCase().indexOf('lokförare') !== -1) rollClass = ' pos-role-lok';
  else if ((person.role || '').toLowerCase().indexOf('tågvärd') !== -1) rollClass = ' pos-role-tv';

  var activeClass = _isWorkingNow(person) ? ' reserv-card--active-now' : '';

  var badgeHtml = '';
  if (person.badge) {
    var badgeColorClass = 'reserv-badge-' + (person.badgeColor || 'default').toLowerCase();
    badgeHtml = '<span class="reserv-badge ' + badgeColorClass + '">' + _esc(person.badge) + '</span>';
  }

  var ort = _resolveOrt(person);
  var ortHtml = ort
    ? '<span class="reserv-card-ort">' + _esc(ort) + '</span>'
    : '';

  var timeHtml = (person.start && person.end)
    ? '<span class="reserv-card-time">' + _esc(person.start) + ' – ' + _esc(person.end) + '</span>'
    : '';

  var personDataJson = JSON.stringify(person).replace(/'/g, '&#39;').replace(/"/g, '&quot;');

  return '<div class="reserv-card' + rollClass + activeClass + '" onclick="openReservDagvy(this)" data-person=\'' + personDataJson + '\' data-date="' + _esc(dateStr) + '">' +
    '<div class="reserv-card-top">' +
      '<span class="reserv-card-name">' + _esc(person.name) + '</span>' +
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
  if (!_reservData) return;
  var today = _getTodayStr();
  var todayPersons = _getPersonsForDay(today);
  var lokCount = 0, tvCount = 0;
  for (var i = 0; i < todayPersons.length; i++) {
    var r = (todayPersons[i].role || '').toLowerCase();
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
    var person = JSON.parse(personJson.replace(/&#39;/g, "'"));
    showReservDagvyPopup(person, dateStr);
  } catch (e) {
    console.error('[RESERV] openReservDagvy parse error', e);
  }
}

// =============================================
// HELPERS
// =============================================
function _getPersonsForDay(dateStr) {
  if (!_reservData || !_reservData.days) return [];
  var dayObj = null;
  for (var i = 0; i < _reservData.days.length; i++) {
    if (_reservData.days[i].date === dateStr) {
      dayObj = _reservData.days[i];
      break;
    }
  }
  if (!dayObj || !Array.isArray(dayObj.persons)) return [];
  return dayObj.persons.filter(function(p) { return !p.notFound; });
}

var _STATION_ORT = {
  'hdort': 'Halmstad',
  'hd': 'Halmstad',
  'mcort': 'Malmö',
  'mc': 'Malmö',
  'm': 'Malmö',
  'ckort': 'Karlskrona',
  'ck': 'Karlskrona',
  'hbort': 'Helsingborg',
  'hb': 'Helsingborg',
  'kacort': 'Kalmar',
  'kac': 'Kalmar',
  'hm': 'Hässleholm'
};

function _resolveOrt(person) {
  if (person.locName) return person.locName;
  var firstSeg = person.segments && person.segments[0];
  if (firstSeg && firstSeg.fromStation) {
    var mapped = _STATION_ORT[firstSeg.fromStation.toLowerCase()];
    if (mapped) return mapped;
  }
  // Fallback: look up person by name in positions data
  if (typeof _posCache !== 'undefined' && _posCache && _posCache.data && _posCache.data.dagar) {
    var today = _getTodayStr();
    var dayData = _posCache.data.dagar[today];
    if (Array.isArray(dayData)) {
      var nameNorm = (person.name || '').toLowerCase().trim();
      for (var i = 0; i < dayData.length; i++) {
        var pos = dayData[i];
        if ((pos.namn || '').toLowerCase().trim() === nameNorm && pos.ort) {
          return pos.ort;
        }
      }
    }
  }
  return '';
}

function _isWorkingNow(person) {
  if (!person.start || !person.end) return false;
  var now = new Date();
  var hhmm = _pad(now.getHours()) + ':' + _pad(now.getMinutes());
  var s = person.start.substring(0, 5);
  var e = person.end.substring(0, 5);
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
