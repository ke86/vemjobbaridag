/**
 * reserv.js - Reservlista page
 * Shows reserve workers from reservdagvy Firebase collection.
 * Filtered by Idag/Imorgon, Roll, and Ort.
 */

/* global fetchReservDagvyFromFirebase, showReservDagvyPopup */

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

  var persons = _getPersonsForDay(_reservSelectedDay === 'idag' ? today : tomorrow);

  // Apply roll filter
  if (_reservFilterRoll !== 'alla') {
    persons = persons.filter(function(p) {
      return (p.role || '').toLowerCase() === _reservFilterRoll.toLowerCase();
    });
  }

  // Apply ort filter
  if (_reservFilterOrt !== 'alla') {
    persons = persons.filter(function(p) {
      return _resolveOrt(p) === _reservFilterOrt;
    });
  }

  // Sort by start time
  persons = persons.slice().sort(function(a, b) {
    return (a.start || '').localeCompare(b.start || '');
  });

  var idag = _reservSelectedDay === 'idag';
  var imorgon = _reservSelectedDay === 'imorgon';

  var selectedDateStr = idag ? today : tomorrow;

  var html =
    '<div class="reserv-controls">' +
      '<div class="reserv-day-toggle">' +
        '<button class="reserv-day-btn' + (idag ? ' active' : '') + '" onclick="setReservDay(\'idag\')">Idag</button>' +
        '<button class="reserv-day-btn' + (imorgon ? ' active' : '') + '" onclick="setReservDay(\'imorgon\')">Imorgon</button>' +
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
}

// =============================================
// CARD BUILDER
// =============================================
function _buildReservCard(person, dateStr) {
  var rollClass = '';
  if ((person.role || '').toLowerCase().includes('lokförare')) rollClass = ' pos-role-lok';
  else if ((person.role || '').toLowerCase().includes('tågvärd')) rollClass = ' pos-role-tv';

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

  return '<div class="reserv-card' + rollClass + '" onclick="openReservDagvy(this)" data-person=\'' + personDataJson + '\' data-date="' + _esc(dateStr) + '">' +
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
    return _STATION_ORT[firstSeg.fromStation.toLowerCase()] || '';
  }
  return '';
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
