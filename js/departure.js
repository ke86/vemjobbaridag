// ==========================================
// DEPARTURE BOARD (Avgång / Ankomst)
// ==========================================

let departureType = 'Avgang';
let departureRefreshTimer = null;
let departurePageActive = false;

// Hardcoded config
const TRAFIKVERKET_API_KEY = 'dbd424f3abd74e19be0b4f18009c4000';
const TRAFIKVERKET_PROXY_URL = 'https://trafikverket-proxy.kenny-eriksson1986.workers.dev';

// Default active product — only this type is active by default
const DEFAULT_ACTIVE_PRODUCTS = ['Öresundståg'];

// Filter state
var depActiveFilters = {};       // { 'Pågatågen': true/false, ... }
var depFiltersInitialized = false; // first load sets defaults
var depAllAnnouncements = [];    // raw data from last fetch
var depLastLocationField = 'ToLocation';
var depFilterExpanded = false;
var depSelectedEmployee = '';     // '' = alla, or normalized employee name
var depEmployeeTrainNrs = [];    // train numbers from dagvy for selected employee

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
 * Extract train numbers from an employee's dagvy for today
 */
function getEmployeeTrainNumbers(normalizedName) {
  var trainNrs = [];
  var dagvyDoc = dagvyAllData[normalizedName];
  if (!dagvyDoc || !dagvyDoc.days) return trainNrs;

  var dateKey = getDateKey(currentDate);
  var dayData = dagvyDoc.days.find(function(d) { return d.date === dateKey; });
  if (!dayData || !dayData.segments) return trainNrs;

  for (var i = 0; i < dayData.segments.length; i++) {
    var seg = dayData.segments[i];
    // Segments with explicit trainNr
    if (seg.trainNr && seg.trainNr.length > 0) {
      // trainNr can be like "1085" — extract just the number part
      var nr = seg.trainNr.replace(/\s.*/g, '').trim();
      if (nr && trainNrs.indexOf(nr) === -1) trainNrs.push(nr);
    }
    // Train-like activities (e.g. "11002 m1", "1071 m1")
    if (seg.activity && /^\d{3,5}(\s+\S+)*$/i.test(seg.activity.trim())) {
      var actNr = seg.activity.trim().replace(/\s.*/g, '').trim();
      if (actNr && trainNrs.indexOf(actNr) === -1) trainNrs.push(actNr);
    }
  }
  return trainNrs;
}

/**
 * Populate the employee select dropdown
 */
function populateEmployeeSelect() {
  var select = document.getElementById('depEmployeeSelect');
  if (!select) return;

  // Keep current selection
  var currentVal = select.value;

  // Build sorted list of employees
  var employees = [];
  for (var id in registeredEmployees) {
    var emp = registeredEmployees[id];
    if (emp && emp.name) {
      employees.push({ id: id, name: emp.name, normalized: normalizeName(emp.name) });
    }
  }
  employees.sort(function(a, b) { return a.name.localeCompare(b.name, 'sv'); });

  var html = '<option value="">Alla tåg</option>';
  for (var i = 0; i < employees.length; i++) {
    var emp = employees[i];
    // Check if this employee has dagvy data for today
    var trainNrs = getEmployeeTrainNumbers(emp.normalized);
    var hasDagvy = trainNrs.length > 0;
    var label = emp.name;
    if (hasDagvy) label += ' (' + trainNrs.length + ' tåg)';
    html += '<option value="' + emp.normalized + '"' + (hasDagvy ? '' : ' disabled') + '>'
      + label + '</option>';
  }
  select.innerHTML = html;

  // Restore selection
  if (currentVal) select.value = currentVal;
}

/**
 * Measure header height and set CSS variable for departure page layout
 */
function updateDepHeaderHeight() {
  var header = document.querySelector('.header');
  if (header) {
    var h = header.offsetHeight;
    document.documentElement.style.setProperty('--dep-header-height', h + 'px');
  }
}

/**
 * Initialize the departure page: event listeners
 */
function initDeparturePage() {
  // Measure header for correct layout height
  updateDepHeaderHeight();
  window.addEventListener('resize', updateDepHeaderHeight);

  var stationSelect = document.getElementById('departureStation');
  var btnAvgang = document.getElementById('depToggleAvgang');
  var btnAnkomst = document.getElementById('depToggleAnkomst');
  var filterToggle = document.getElementById('depFilterToggle');
  var employeeSelect = document.getElementById('depEmployeeSelect');

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
      var panel = document.getElementById('depFilterPanel');
      var icon = document.getElementById('depFilterToggleIcon');
      if (panel) panel.classList.toggle('expanded', depFilterExpanded);
      if (icon) {
        icon.textContent = '▸';
        icon.classList.toggle('expanded', depFilterExpanded);
      }
    });
  }

  if (employeeSelect) {
    employeeSelect.addEventListener('change', function() {
      depSelectedEmployee = this.value;
      if (depSelectedEmployee) {
        depEmployeeTrainNrs = getEmployeeTrainNumbers(depSelectedEmployee);
      } else {
        depEmployeeTrainNrs = [];
      }
      renderFilteredBoard();
    });
  }
}

/**
 * Called when departure page becomes visible
 */
function onDeparturePageShow() {
  departurePageActive = true;
  populateEmployeeSelect();
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

  // First load: set defaults (only DEFAULT_ACTIVE_PRODUCTS active)
  if (!depFiltersInitialized) {
    depFiltersInitialized = true;
    for (var t = 0; t < types.length; t++) {
      depActiveFilters[types[t]] = DEFAULT_ACTIVE_PRODUCTS.indexOf(types[t]) !== -1;
    }
  } else {
    // Subsequent loads: init new types as inactive, keep existing
    for (var t2 = 0; t2 < types.length; t2++) {
      if (depActiveFilters[types[t2]] === undefined) {
        depActiveFilters[types[t2]] = false;
      }
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
    var active = depActiveFilters[type] === true;
    html += '<button class="dep-filter-chip' + (active ? ' active' : '') + '" data-type="' + type.replace(/"/g, '&quot;') + '">'
      + type + ' <span class="dep-chip-count">' + typeCounts[type] + '</span>'
      + '</button>';
  }
  chipsEl.innerHTML = html;

  // Update filter count indicator
  updateFilterCount();

  // Chip click handlers
  var chips = chipsEl.querySelectorAll('.dep-filter-chip');
  for (var c = 0; c < chips.length; c++) {
    chips[c].addEventListener('click', function() {
      var type = this.getAttribute('data-type');
      depActiveFilters[type] = !depActiveFilters[type];
      this.classList.toggle('active', depActiveFilters[type]);
      updateFilterCount();
      renderFilteredBoard();
    });
  }
}

/**
 * Update filter count badge
 */
function updateFilterCount() {
  var countEl = document.getElementById('depFilterCount');
  if (!countEl) return;
  var keys = Object.keys(depActiveFilters);
  var ac = 0;
  for (var x = 0; x < keys.length; x++) { if (depActiveFilters[keys[x]]) ac++; }
  var empLabel = depSelectedEmployee ? ' · 👤' : '';
  countEl.textContent = (ac < keys.length ? '(' + ac + '/' + keys.length + ')' : '') + empLabel;
}

/**
 * Re-render the board using current filter state + employee filter
 */
function renderFilteredBoard() {
  var filtered = depAllAnnouncements.filter(function(a) {
    // Product filter
    var product = getTrainProduct(a);
    if (depActiveFilters[product] !== true) return false;

    // Employee filter
    if (depSelectedEmployee && depEmployeeTrainNrs.length > 0) {
      var trainId = a.AdvertisedTrainIdent || '';
      if (depEmployeeTrainNrs.indexOf(trainId) === -1) return false;
    }

    return true;
  });
  renderDepartureBoard(filtered, depLastLocationField);
  updateFilterCount();
}

/**
 * Check if a station value is a Danish station
 */
function isDanishStation(val) {
  return val && val.indexOf('DK_') === 0;
}

/**
 * Get Danish station code from select value (e.g. "DK_CPH" → "CPH")
 */
function getDanishStationCode(val) {
  return val.replace('DK_', '');
}

/**
 * Load Danish departures/arrivals from embedded timetable data
 */
function loadDanishDepartures(stationCode) {
  var tbodyEl = document.getElementById('departureTableBody');
  var statusEl = document.getElementById('departureStatus');
  var filterPanel = document.getElementById('depFilterPanel');
  var filterToggle = document.getElementById('depFilterToggle');

  if (!tbodyEl) return;

  // Hide filter panel for Danish stations (no product types)
  if (filterPanel) filterPanel.style.display = 'none';
  if (filterToggle) filterToggle.style.display = 'none';

  if (typeof denmark === 'undefined') {
    tbodyEl.innerHTML = '<tr><td colspan="6" class="dep-empty">Dansk data ej tillgänglig</td></tr>';
    return;
  }

  var allTrainNrs = denmark.getAllDanishTrainNumbers();
  var now = new Date();
  var currentMin = now.getHours() * 60 + now.getMinutes();
  var isDep = departureType === 'Avgang';

  // Collect all trains that stop at this station
  var rows = [];

  for (var i = 0; i < allTrainNrs.length; i++) {
    var tnr = allTrainNrs[i];
    var dkInfo = denmark.getDanishStops(tnr, now);
    if (!dkInfo || !dkInfo.stops.length) continue;

    // Find this station in the stops
    for (var j = 0; j < dkInfo.stops.length; j++) {
      var stop = dkInfo.stops[j];
      if (stop.code !== stationCode || !stop.pax) continue;

      // For departures: need a departure time, and not the last stop
      // For arrivals: need an arrival time, and not the first stop
      var timeStr = isDep ? stop.dep : stop.arr;
      if (!timeStr) continue;

      var parts = timeStr.split(':');
      var min = parseInt(parts[0]) * 60 + parseInt(parts[1]);

      // Show: from 30 min ago to 6 hours ahead
      var diff = min - currentMin;
      if (diff < -30 || diff > 360) continue;

      // Determine destination/origin
      var dest = '';
      if (isDep) {
        // Destination = last stop
        var lastPax = null;
        for (var lk = dkInfo.stops.length - 1; lk >= 0; lk--) {
          if (dkInfo.stops[lk].pax) { lastPax = dkInfo.stops[lk]; break; }
        }
        dest = lastPax ? lastPax.name : '';
        // If destination is this station, skip
        if (lastPax && lastPax.code === stationCode) continue;
      } else {
        // Origin = first stop
        var firstPax = null;
        for (var fk = 0; fk < dkInfo.stops.length; fk++) {
          if (dkInfo.stops[fk].pax) { firstPax = dkInfo.stops[fk]; break; }
        }
        dest = firstPax ? firstPax.name : '';
        if (firstPax && firstPax.code === stationCode) continue;
      }

      rows.push({
        time: timeStr,
        min: min,
        dest: dest,
        trainNr: tnr,
        route: dkInfo.route
      });
    }
  }

  // Sort by time
  rows.sort(function(a, b) { return a.min - b.min; });

  // Apply employee filter
  if (depSelectedEmployee && depEmployeeTrainNrs.length > 0) {
    rows = rows.filter(function(r) {
      return depEmployeeTrainNrs.indexOf(r.trainNr) !== -1;
    });
  }

  if (rows.length === 0) {
    tbodyEl.innerHTML = '<tr><td colspan="6" class="dep-empty">Inga tåg</td></tr>';
  } else {
    var html = '';
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var isPast = row.min < currentMin;
      var rowClass = isPast ? 'dep-dk-past' : '';

      // Highlight employee's own trains
      if (depSelectedEmployee && depEmployeeTrainNrs.indexOf(row.trainNr) !== -1) {
        rowClass += ' dep-my-train';
      }

      html += '<tr class="' + rowClass + '">'
        + '<td class="dep-col-time">' + row.time + '</td>'
        + '<td class="dep-col-dest">' + row.dest + '</td>'
        + '<td class="dep-col-newtime no-delay"></td>'
        + '<td class="dep-col-track dep-dk-no-track">—</td>'
        + '<td class="dep-col-train">' + row.trainNr + '</td>'
        + '<td class="dep-col-note">Öresundståg</td>'
        + '</tr>';
    }
    tbodyEl.innerHTML = html;
  }

  // Status bar
  if (statusEl) {
    statusEl.innerHTML = '🇩🇰 Tidtabell (ej realtid)';
    statusEl.classList.remove('error');
  }

  // Clear API announcements (not relevant for DK)
  depAllAnnouncements = [];
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

  // Danish station → use local timetable data
  if (isDanishStation(stationSig)) {
    loadDanishDepartures(getDanishStationCode(stationSig));
    return;
  }

  // Swedish station → restore filter panel visibility
  var filterPanel = document.getElementById('depFilterPanel');
  var filterToggle = document.getElementById('depFilterToggle');
  if (filterPanel) filterPanel.style.display = '';
  if (filterToggle) filterToggle.style.display = '';

  // Show loading in bottom bar
  if (statusEl) {
    statusEl.innerHTML = '<span class="dep-loading-spinner"></span> Hämtar data...';
    statusEl.classList.remove('error');
  }

  // Update employee select (dagvy data may have changed)
  populateEmployeeSelect();

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

    // Train number
    var trainId = a.AdvertisedTrainIdent || '';

    // Destination / Origin
    var locArr = a[locationField] || [];
    var destName = '';
    if (locArr.length > 0) {
      destName = locArr[locArr.length - 1].LocationName || '';
    }

    // Danish extension: if train ends at Hyllie and has Danish data, show Danish destination
    var dkDest = '';
    if (typeof denmark !== 'undefined' && trainId) {
      var lastSig = locArr.length > 0 ? (locArr[locArr.length - 1].LocationName || '') : '';
      if (lastSig === 'Hyllie' || lastSig === 'Kastrup' || lastSig === 'Malmö central') {
        var dkStops = denmark.getDanishStops(trainId);
        if (dkStops && dkStops.stops.length > 0) {
          if (dkStops.direction === 'toDK') {
            dkDest = dkStops.stops[dkStops.stops.length - 1].name;
          } else {
            // Train coming FROM Denmark — show Danish origin
            dkDest = dkStops.stops[0].name;
          }
        }
      }
    }

    // Track
    var track = a.TrackAtLocation || '';

    // Product name
    var product = getTrainProduct(a);

    // Deviation = Anmärkning
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

    // Highlight employee's own trains
    if (depSelectedEmployee && depEmployeeTrainNrs.indexOf(trainId) !== -1) {
      rowClass += ' dep-my-train';
    }

    // Build destination cell with optional Danish destination
    var destCell = destName;
    if (dkDest) {
      destCell = destName + '<span class="dep-dk-dest"> → ' + dkDest + '</span>';
    }

    html += '<tr class="' + rowClass + '">'
      + '<td class="dep-col-time">' + timeStr + '</td>'
      + '<td class="dep-col-dest">' + destCell + '</td>'
      + '<td class="dep-col-newtime' + (hasDelay ? '' : ' no-delay') + '">' + (newTimeStr || '') + '</td>'
      + '<td class="dep-col-track">' + track + '</td>'
      + '<td class="dep-col-train">' + trainId + '</td>'
      + '<td class="dep-col-note" title="' + noteStr.replace(/"/g, '&quot;') + '">' + noteStr + '</td>'
      + '</tr>';
  }

  tbodyEl.innerHTML = html;
}
