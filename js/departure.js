// ==========================================
// DEPARTURE BOARD (Avgång / Ankomst)
// ==========================================

let departureType = 'Avgang';
let departureRefreshTimer = null;
let departurePageActive = false;

// Hardcoded config
const TRAFIKVERKET_API_KEY = 'dbd424f3abd74e19be0b4f18009c4000';
const TRAFIKVERKET_PROXY_URL = 'https://trafikverket-proxy.kenny-eriksson1986.workers.dev';

// Filter state: which train types are visible (all active by default)
var depActiveFilters = {};    // { 'Pågatågen': true, 'Öresundståg': true, ... }
var depAllAnnouncements = []; // raw data from last fetch
var depLastLocationField = 'ToLocation';
var depFilterExpanded = false;

/**
 * Station name lookup from signature
 */
const stationNames = {};
(function() {
  var sel = document.getElementById('departureStation');
  if (sel) {
    for (var i = 0; i < sel.options.length; i++) {
      stationNames[sel.options[i].value] = sel.options[i].text;
    }
  }
})();

/**
 * Get product name from an announcement
 */
function getTrainProduct(announcement) {
  if (announcement.ProductInformation && announcement.ProductInformation.length > 0) {
    var info = announcement.ProductInformation[0];
    var desc = info.Description || info;
    if (typeof desc === 'string') return desc;
    if (desc && desc.Description) return desc.Description;
  }
  return 'Övrigt';
}

/**
 * Initialize the departure page: event listeners
 */
function initDeparturePage() {
  var stationSelect = document.getElementById('departureStation');
  var btnAvgang = document.getElementById('depToggleAvgang');
  var btnAnkomst = document.getElementById('depToggleAnkomst');
  var filterToggle = document.getElementById('depFilterToggle');

  if (stationSelect) {
    stationSelect.addEventListener('change', function() {
      loadDepartures();
    });
  }

  if (btnAvgang) {
    btnAvgang.addEventListener('click', function() {
      departureType = 'Avgang';
      btnAvgang.classList.add('active');
      if (btnAnkomst) btnAnkomst.classList.remove('active');
      // Update column header
      var thRow = document.querySelector('.departure-table thead tr');
      if (thRow) { var ths = thRow.querySelectorAll('th'); if (ths.length >= 2) ths[1].textContent = 'Till'; }
      loadDepartures();
    });
  }

  if (btnAnkomst) {
    btnAnkomst.addEventListener('click', function() {
      departureType = 'Ankomst';
      btnAnkomst.classList.add('active');
      if (btnAvgang) btnAvgang.classList.remove('active');
      var thRow = document.querySelector('.departure-table thead tr');
      if (thRow) { var ths = thRow.querySelectorAll('th'); if (ths.length >= 2) ths[1].textContent = 'Från'; }
      loadDepartures();
    });
  }

  if (filterToggle) {
    filterToggle.addEventListener('click', function() {
      depFilterExpanded = !depFilterExpanded;
      var chips = document.getElementById('depFilterChips');
      var icon = document.querySelector('.dep-filter-toggle-icon');
      if (chips) chips.classList.toggle('expanded', depFilterExpanded);
      if (icon) icon.textContent = depFilterExpanded ? '▾' : '▸';
    });
  }
}

/**
 * Called when departure page becomes visible
 */
function onDeparturePageShow() {
  departurePageActive = true;
  loadDepartures();
  departureRefreshTimer = setInterval(function() {
    if (departurePageActive) loadDepartures();
  }, 30000);
}

/**
 * Called when departure page is hidden
 */
function onDeparturePageHide() {
  departurePageActive = false;
  if (departureRefreshTimer) {
    clearInterval(departureRefreshTimer);
    departureRefreshTimer = null;
  }
}

/**
 * Fetch data from Trafikverket API via Cloudflare Worker proxy
 */
async function fetchTrafikverketData(xmlBody) {
  var response = await fetch(TRAFIKVERKET_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: xmlBody
  });
  if (!response.ok) {
    throw new Error('HTTP ' + response.status);
  }
  return await response.json();
}

/**
 * Build and render filter chips from announcements
 */
function buildFilterChips(announcements) {
  var chipsEl = document.getElementById('depFilterChips');
  var countEl = document.getElementById('depFilterCount');
  if (!chipsEl) return;

  // Collect unique train types + count
  var typeCounts = {};
  for (var i = 0; i < announcements.length; i++) {
    var product = getTrainProduct(announcements[i]);
    typeCounts[product] = (typeCounts[product] || 0) + 1;
  }

  var types = Object.keys(typeCounts).sort();

  // Initialize new types as active
  for (var t = 0; t < types.length; t++) {
    if (depActiveFilters[types[t]] === undefined) {
      depActiveFilters[types[t]] = true;
    }
  }

  // Remove old types no longer present
  var filterKeys = Object.keys(depActiveFilters);
  for (var k = 0; k < filterKeys.length; k++) {
    if (typeCounts[filterKeys[k]] === undefined) {
      delete depActiveFilters[filterKeys[k]];
    }
  }

  // Render chips
  var html = '';
  for (var j = 0; j < types.length; j++) {
    var type = types[j];
    var active = depActiveFilters[type] !== false;
    html += '<button class="dep-filter-chip' + (active ? ' active' : '') + '" data-type="' + type.replace(/"/g, '&quot;') + '">'
      + type + ' <span class="dep-chip-count">' + typeCounts[type] + '</span>'
      + '</button>';
  }
  chipsEl.innerHTML = html;

  // Update filter count indicator
  var activeCount = 0;
  var totalCount = types.length;
  for (var f = 0; f < types.length; f++) {
    if (depActiveFilters[types[f]] !== false) activeCount++;
  }
  if (countEl) {
    if (activeCount < totalCount) {
      countEl.textContent = '(' + activeCount + '/' + totalCount + ')';
    } else {
      countEl.textContent = '';
    }
  }

  // Chip click handlers
  var chips = chipsEl.querySelectorAll('.dep-filter-chip');
  for (var c = 0; c < chips.length; c++) {
    chips[c].addEventListener('click', function() {
      var type = this.getAttribute('data-type');
      depActiveFilters[type] = !depActiveFilters[type];
      this.classList.toggle('active', depActiveFilters[type]);
      // Update count
      var ac = 0;
      var keys = Object.keys(depActiveFilters);
      for (var x = 0; x < keys.length; x++) { if (depActiveFilters[keys[x]]) ac++; }
      if (countEl) { countEl.textContent = ac < keys.length ? '(' + ac + '/' + keys.length + ')' : ''; }
      // Re-render table with filter
      renderFilteredBoard();
    });
  }
}

/**
 * Re-render the board using current filter state
 */
function renderFilteredBoard() {
  var filtered = depAllAnnouncements.filter(function(a) {
    var product = getTrainProduct(a);
    return depActiveFilters[product] !== false;
  });
  renderDepartureBoard(filtered, depLastLocationField);
}

/**
 * Load departures/arrivals from Trafikverket API
 */
async function loadDepartures() {
  var statusEl = document.getElementById('departureStatus');
  var tbodyEl = document.getElementById('departureTableBody');
  var stationSelect = document.getElementById('departureStation');

  if (!tbodyEl || !stationSelect) return;

  var stationSig = stationSelect.value;

  // Show loading in bottom bar
  if (statusEl) {
    statusEl.innerHTML = '<span class="dep-loading-spinner"></span> Hämtar data...';
    statusEl.classList.remove('error');
  }

  // Build XML request
  depLastLocationField = departureType === 'Avgang' ? 'ToLocation' : 'FromLocation';
  var xml = '<REQUEST>'
    + '<LOGIN authenticationkey="' + TRAFIKVERKET_API_KEY + '" />'
    + '<QUERY objecttype="TrainAnnouncement" schemaversion="1.9" orderby="AdvertisedTimeAtLocation">'
    + '<FILTER>'
    + '<AND>'
    + '<EQ name="LocationSignature" value="' + stationSig + '" />'
    + '<EQ name="ActivityType" value="' + departureType + '" />'
    + '<EQ name="Advertised" value="true" />'
    + '<GT name="AdvertisedTimeAtLocation" value="$dateadd(-00:30:00)" />'
    + '<LT name="AdvertisedTimeAtLocation" value="$dateadd(06:00:00)" />'
    + '</AND>'
    + '</FILTER>'
    + '<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>'
    + '<INCLUDE>EstimatedTimeAtLocation</INCLUDE>'
    + '<INCLUDE>TimeAtLocation</INCLUDE>'
    + '<INCLUDE>TrackAtLocation</INCLUDE>'
    + '<INCLUDE>AdvertisedTrainIdent</INCLUDE>'
    + '<INCLUDE>ToLocation</INCLUDE>'
    + '<INCLUDE>FromLocation</INCLUDE>'
    + '<INCLUDE>Deviation</INCLUDE>'
    + '<INCLUDE>ProductInformation</INCLUDE>'
    + '<INCLUDE>Canceled</INCLUDE>'
    + '</QUERY>'
    + '</REQUEST>';

  try {
    var data = await fetchTrafikverketData(xml);
    var announcements = [];

    if (data && data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
      announcements = data.RESPONSE.RESULT[0].TrainAnnouncement || [];
    }

    // Store for filter re-renders
    depAllAnnouncements = announcements;

    // Build filter chips
    buildFilterChips(announcements);

    // Render with active filters
    renderFilteredBoard();

    // Update bottom status bar
    var now = new Date();
    var timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
    if (statusEl) {
      statusEl.innerHTML = 'Uppdaterad ' + timeStr + ' · <span id="depCountdown">30</span>s';
      statusEl.classList.remove('error');
      startCountdown();
    }

  } catch (err) {
    console.error('Departure fetch error:', JSON.stringify({message: err.message, stack: err.stack}));
    if (statusEl) {
      statusEl.innerHTML = '⚠️ ' + (err.message || 'Fel') + ' · Försöker igen...';
      statusEl.classList.add('error');
    }
  }
}

/**
 * Countdown timer in the bottom bar
 */
var depCountdownTimer = null;
function startCountdown() {
  if (depCountdownTimer) clearInterval(depCountdownTimer);
  var seconds = 30;
  depCountdownTimer = setInterval(function() {
    seconds--;
    var el = document.getElementById('depCountdown');
    if (el) el.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(depCountdownTimer);
      depCountdownTimer = null;
    }
  }, 1000);
}

/**
 * Render departure/arrival rows in the board table
 */
function renderDepartureBoard(announcements, locationField) {
  var tbodyEl = document.getElementById('departureTableBody');
  if (!tbodyEl) return;

  if (announcements.length === 0) {
    tbodyEl.innerHTML = '<tr><td colspan="6" class="dep-empty">Inga tåg</td></tr>';
    return;
  }

  var html = '';

  for (var i = 0; i < announcements.length; i++) {
    var a = announcements[i];

    // Time
    var advTime = a.AdvertisedTimeAtLocation ? new Date(a.AdvertisedTimeAtLocation) : null;
    var timeStr = advTime ? String(advTime.getHours()).padStart(2, '0') + ':' + String(advTime.getMinutes()).padStart(2, '0') : '';

    // New time (estimated, if delayed)
    var estTime = a.EstimatedTimeAtLocation ? new Date(a.EstimatedTimeAtLocation) : null;
    var newTimeStr = '';
    var hasDelay = false;
    if (estTime && advTime && estTime.getTime() !== advTime.getTime()) {
      newTimeStr = String(estTime.getHours()).padStart(2, '0') + ':' + String(estTime.getMinutes()).padStart(2, '0');
      hasDelay = true;
    }

    // Destination / Origin
    var locArr = a[locationField] || [];
    var destName = '';
    if (locArr.length > 0) {
      destName = locArr[locArr.length - 1].LocationName || '';
    }

    // Track
    var track = a.TrackAtLocation || '';

    // Train number
    var trainId = a.AdvertisedTrainIdent || '';

    // Product name for row styling
    var product = getTrainProduct(a);

    // Deviation = Anmärkning (skip product info, just show deviation)
    var notes = [];
    if (a.Deviation && a.Deviation.length > 0) {
      for (var d = 0; d < a.Deviation.length; d++) {
        var devDesc = a.Deviation[d].Description || a.Deviation[d];
        if (typeof devDesc === 'string') notes.push(devDesc);
        else if (devDesc && devDesc.Description) notes.push(devDesc.Description);
      }
    }

    var isCancelled = a.Canceled === true;
    if (isCancelled) notes.push('Inställt');

    var noteStr = notes.length > 0 ? notes.join(' ') : product;
    var rowClass = isCancelled ? 'dep-cancelled' : '';

    html += '<tr class="' + rowClass + '">'
      + '<td class="dep-col-time">' + timeStr + '</td>'
      + '<td class="dep-col-dest">' + destName + '</td>'
      + '<td class="dep-col-newtime' + (hasDelay ? '' : ' no-delay') + '">' + (newTimeStr || '') + '</td>'
      + '<td class="dep-col-track">' + track + '</td>'
      + '<td class="dep-col-train">' + trainId + '</td>'
      + '<td class="dep-col-note" title="' + noteStr.replace(/"/g, '&quot;') + '">' + noteStr + '</td>'
      + '</tr>';
  }

  tbodyEl.innerHTML = html;
}
