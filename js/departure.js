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
 * Load Danish departures/arrivals from embedded timetable data,
 * then cross-reference with Trafikverket API for Swedish destinations + delay info.
 */
async function loadDanishDepartures(stationCode) {
  var tbodyEl = document.getElementById('departureTableBody');
  var statusEl = document.getElementById('departureStatus');
  var filterPanel = document.getElementById('depFilterPanel');
  var filterToggle = document.getElementById('depFilterToggle');
  var filterBar = document.getElementById('depFilterBar');

  if (!tbodyEl) return;

  // Hide product filter for Danish stations, but keep employee filter accessible
  if (filterPanel) filterPanel.style.display = 'none';
  if (filterToggle) filterToggle.style.display = 'none';
  if (filterBar) filterBar.style.display = 'none';

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

      // Determine DK-only destination/origin (fallback)
      // For toSE trains that cross the bridge: generic "Malmö Central" fallback
      // (Trafikverket merge will upgrade to real destination if it goes further)
      // For toDK trains arriving from SE: generic "Malmö Central" fallback
      var dkDest = '';
      // Check if train actually crosses to Sweden (has Peberholm stop)
      var crossesBorder = false;
      for (var cb = 0; cb < dkInfo.stops.length; cb++) {
        if (dkInfo.stops[cb].code === 'PHM') { crossesBorder = true; break; }
      }
      if (isDep) {
        if (dkInfo.direction === 'toSE' && crossesBorder) {
          // toSE departure: destination is Sweden — generic fallback
          dkDest = 'Malmö Central';
        } else {
          var lastPax = null;
          for (var lk = dkInfo.stops.length - 1; lk >= 0; lk--) {
            if (dkInfo.stops[lk].pax) { lastPax = dkInfo.stops[lk]; break; }
          }
          dkDest = lastPax ? lastPax.name : '';
          if (lastPax && lastPax.code === stationCode) continue;
        }
      } else {
        if (dkInfo.direction === 'toDK' && crossesBorder) {
          // toDK arrival (odd nr coming from SE): generic fallback
          dkDest = 'Malmö Central';
        } else {
          var firstPax = null;
          for (var fk = 0; fk < dkInfo.stops.length; fk++) {
            if (dkInfo.stops[fk].pax) { firstPax = dkInfo.stops[fk]; break; }
          }
          dkDest = firstPax ? firstPax.name : '';
          if (firstPax && firstPax.code === stationCode) continue;
        }
      }

      rows.push({
        time: timeStr,
        min: min,
        dest: dkDest,         // DK fallback destination
        seDest: '',            // will be filled from Trafikverket
        trainNr: tnr,
        route: dkInfo.route,
        direction: dkInfo.direction,
        crossesBorder: crossesBorder, // true if PHM in stop list
        newTime: '',           // delay info
        hasDelay: false
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

  // Render initial table immediately (with DK-only destinations)
  renderDanishBoard(tbodyEl, rows, currentMin);

  if (statusEl) {
    statusEl.innerHTML = '<span class="dep-loading-spinner"></span> 🇩🇰 Hämtar svensk data...';
    statusEl.classList.remove('error');
  }

  // Collect unique train numbers for Trafikverket lookup (only border-crossing trains)
  var uniqueTrainNrs = [];
  for (var u = 0; u < rows.length; u++) {
    if (rows[u].crossesBorder && uniqueTrainNrs.indexOf(rows[u].trainNr) === -1) {
      uniqueTrainNrs.push(rows[u].trainNr);
    }
  }

  // Cross-reference with Trafikverket API
  if (uniqueTrainNrs.length > 0) {
    try {
      var seData = await fetchSwedishTrainData(uniqueTrainNrs);

      // Merge Swedish data into rows
      // Border filtering is now handled inside fetchSwedishTrainData parser —
      // it always prefers non-border destinations (e.g. "Göteborg C" over "Malmö central")
      for (var s = 0; s < rows.length; s++) {
        var row = rows[s];
        // Skip SE merge for DK-internal trains (no PHM = never enters Sweden today)
        if (!row.crossesBorder) continue;
        var seInfo = seData[row.trainNr];
        if (!seInfo) continue;

        // Swedish destination/origin (already border-filtered by parser)
        if (isDep && seInfo.toLocation) {
          row.seDest = seInfo.toLocation;
        } else if (!isDep && seInfo.fromLocation) {
          row.seDest = seInfo.fromLocation;
        }

        // Delay info from nearest Swedish station
        if (seInfo.delayMin > 0) {
          row.hasDelay = true;
          // Estimate new time at DK station based on Swedish delay
          var newMin = row.min + seInfo.delayMin;
          var newH = Math.floor(newMin / 60) % 24;
          var newM = newMin % 60;
          row.newTime = String(newH).padStart(2, '0') + ':' + String(newM).padStart(2, '0');
        }
      }

      // Re-render with enriched data
      renderDanishBoard(tbodyEl, rows, currentMin);
    } catch (err) {
      console.error('DK cross-ref error:', JSON.stringify({ message: err.message }));
    }
  }

  // Status bar
  if (statusEl) {
    statusEl.innerHTML = '🇩🇰 Tidtabell · Svensk korsreferens aktiv';
    statusEl.classList.remove('error');
  }

  // Clear API announcements (not relevant for DK)
  depAllAnnouncements = [];
}

/**
 * Fetch Swedish Trafikverket data for a batch of train numbers.
 * Returns object keyed by train number with destination, origin, delay info.
 */
async function fetchSwedishTrainData(trainNrs) {
  // Build IN-clause for train numbers
  var inValues = '';
  for (var i = 0; i < trainNrs.length; i++) {
    inValues += '<Value>' + trainNrs[i] + '</Value>';
  }

  var xml = '<REQUEST>'
    + '<LOGIN authenticationkey="' + TRAFIKVERKET_API_KEY + '" />'
    + '<QUERY objecttype="TrainAnnouncement" schemaversion="1.9" orderby="AdvertisedTimeAtLocation">'
    + '<FILTER>'
    + '<AND>'
    + '<IN name="AdvertisedTrainIdent">' + inValues + '</IN>'
    + '<EQ name="Advertised" value="true" />'
    + '<GT name="AdvertisedTimeAtLocation" value="$dateadd(-02:00:00)" />'
    + '<LT name="AdvertisedTimeAtLocation" value="$dateadd(08:00:00)" />'
    + '</AND>'
    + '</FILTER>'
    + '<INCLUDE>AdvertisedTrainIdent</INCLUDE>'
    + '<INCLUDE>ActivityType</INCLUDE>'
    + '<INCLUDE>LocationSignature</INCLUDE>'
    + '<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>'
    + '<INCLUDE>EstimatedTimeAtLocation</INCLUDE>'
    + '<INCLUDE>ToLocation</INCLUDE>'
    + '<INCLUDE>FromLocation</INCLUDE>'
    + '</QUERY>'
    + '</REQUEST>';

  var data = await fetchTrafikverketData(xml);
  var announcements = [];
  if (data && data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
    announcements = data.RESPONSE.RESULT[0].TrainAnnouncement || [];
  }

  // ===== DEBUG: Log raw Trafikverket data per train =====
  var debugPerTrain = {};
  for (var d = 0; d < announcements.length; d++) {
    var da = announcements[d];
    var dtnr = da.AdvertisedTrainIdent || '?';
    if (!debugPerTrain[dtnr]) debugPerTrain[dtnr] = [];
    var dTo = da.ToLocation && da.ToLocation.length > 0
      ? da.ToLocation.map(function(t) { return t.LocationName; }).join(',')
      : '-';
    var dFrom = da.FromLocation && da.FromLocation.length > 0
      ? da.FromLocation.map(function(f) { return f.LocationName; }).join(',')
      : '-';
    debugPerTrain[dtnr].push(
      da.ActivityType + ' @ ' + (da.LocationSignature || '?')
      + ' | To: ' + dTo
      + ' | From: ' + dFrom
      + ' | ' + (da.AdvertisedTimeAtLocation || '')
    );
  }
  var debugTrains = Object.keys(debugPerTrain);
  for (var dt = 0; dt < debugTrains.length; dt++) {
    var dtNr = debugTrains[dt];
    console.log('[DK-DEBUG] Tåg ' + dtNr + ' (' + debugPerTrain[dtNr].length + ' announcements):');
    for (var dl = 0; dl < debugPerTrain[dtNr].length; dl++) {
      console.log('  ' + debugPerTrain[dtNr][dl]);
    }
  }
  // ===== END DEBUG =====

  // Border stations — destinations on the short Swedish ØP leg.
  // If the train continues beyond these, we want the REAL final destination.
  var borderNames = ['malmö central', 'hyllie', 'svågertorp'];

  function isBorderName(name) {
    var low = (name || '').toLowerCase();
    for (var b = 0; b < borderNames.length; b++) {
      if (low === borderNames[b]) return true;
    }
    return false;
  }

  // Build lookup per train number
  var result = {};
  for (var a = 0; a < announcements.length; a++) {
    var ann = announcements[a];
    var tnr = ann.AdvertisedTrainIdent;
    if (!tnr) continue;

    if (!result[tnr]) {
      result[tnr] = { toLocation: '', fromLocation: '', lastStation: '', delayMin: 0 };
    }

    // Capture To/From location.
    // Strategy: announcements are sorted by time (earliest first).
    // Later stops overwrite earlier ones — BUT we never overwrite a
    // non-border destination with a border one. This ensures that if
    // Trafikverket reports "Göteborg C" at any stop, we keep it even
    // if later stops say "Malmö central".
    if (ann.ActivityType === 'Avgang') {
      if (ann.ToLocation && ann.ToLocation.length > 0) {
        var toLoc = ann.ToLocation[ann.ToLocation.length - 1];
        var toName = toLoc.LocationName || '';
        // Overwrite if: nothing yet, OR current is border, OR new is non-border
        if (!result[tnr].toLocation || isBorderName(result[tnr].toLocation) || !isBorderName(toName)) {
          result[tnr].toLocation = toName;
        }
      }
      // Track the last departure station (furthest along the route)
      if (ann.LocationSignature) {
        result[tnr].lastStation = ann.LocationSignature;
      }
    }
    if (ann.ActivityType === 'Ankomst') {
      if (ann.FromLocation && ann.FromLocation.length > 0) {
        var fromLoc = ann.FromLocation[0];
        var fromName = fromLoc.LocationName || '';
        if (!result[tnr].fromLocation || isBorderName(result[tnr].fromLocation) || !isBorderName(fromName)) {
          result[tnr].fromLocation = fromName;
        }
      }
    }

    // Track max delay across all announcements for this train
    if (ann.EstimatedTimeAtLocation && ann.AdvertisedTimeAtLocation) {
      var estT = new Date(ann.EstimatedTimeAtLocation).getTime();
      var advT = new Date(ann.AdvertisedTimeAtLocation).getTime();
      var delayMs = estT - advT;
      if (delayMs > 0) {
        var dMin = Math.round(delayMs / 60000);
        if (dMin > result[tnr].delayMin) {
          result[tnr].delayMin = dMin;
        }
      }
    }
  }

  // ===== DEBUG: Log final result =====
  var resultTrains = Object.keys(result);
  for (var rt = 0; rt < resultTrains.length; rt++) {
    var rNr = resultTrains[rt];
    var r = result[rNr];
    console.log('[DK-DEBUG] RESULT tåg ' + rNr + ': toLocation="' + r.toLocation + '" fromLocation="' + r.fromLocation + '" lastStation="' + r.lastStation + '" delay=' + r.delayMin);
  }
  // ===== END DEBUG =====

  return result;
}

/**
 * Render the Danish departure/arrival board
 */
function renderDanishBoard(tbodyEl, rows, currentMin) {
  if (rows.length === 0) {
    tbodyEl.innerHTML = '<tr><td colspan="6" class="dep-empty">Inga tåg</td></tr>';
    return;
  }

  var html = '';
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var isPast = row.min < currentMin;
    var rowClass = isPast ? 'dep-dk-past' : '';

    // Highlight employee's own trains
    if (depSelectedEmployee && depEmployeeTrainNrs.indexOf(row.trainNr) !== -1) {
      rowClass += ' dep-my-train';
    }

    // Destination: prefer Swedish destination, fallback to Danish
    var destCell = '';
    if (row.seDest) {
      destCell = row.seDest;
    } else {
      destCell = row.dest;
    }

    // Delay column
    var delayClass = row.hasDelay ? '' : ' no-delay';
    var delayText = row.newTime || '';

    html += '<tr class="' + rowClass + '">'
      + '<td class="dep-col-time">' + row.time + '</td>'
      + '<td class="dep-col-dest">' + destCell + '</td>'
      + '<td class="dep-col-newtime' + delayClass + '">' + delayText + '</td>'
      + '<td class="dep-col-track dep-dk-no-track">—</td>'
      + '<td class="dep-col-train">' + row.trainNr + '</td>'
      + '<td class="dep-col-note">Öresundståg</td>'
      + '</tr>';
  }
  tbodyEl.innerHTML = html;
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
  var filterBar = document.getElementById('depFilterBar');
  if (filterPanel) filterPanel.style.display = '';
  if (filterToggle) filterToggle.style.display = '';
  if (filterBar) filterBar.style.display = '';

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
