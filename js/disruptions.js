// ==========================================
// TRAFIKSTÖRNINGAR (Disruptions)
// Fetches TrainStationMessage v1.0 from Trafikverket API
// ==========================================

// --- State ---
var disruptPageActive = false;
var disruptRefreshTimer = null;
var disruptCountdownTimer = null;
var disruptAllMessages = [];       // parsed messages after client-side filtering
var disruptActiveRegions = {};     // { '12': true, '13': true, ... }
var disruptExpandedId = null;      // currently expanded card ID (one at a time)
var disruptTimeRange = 'active';   // 'active', '24h', '3d', '7d'
var disruptStationCountyMap = null;  // { 'Cst': [12], 'Hld': [13], ... } — sig → countyNo[]
var disruptStationNameMap = null;    // { 'Cst': 'Malmö C', ... } — sig → name

// Refresh interval in seconds
var DISRUPT_REFRESH_SEC = 60;

// Direct Trafikverket API URL (proxy does not support all objecttypes)
var DISRUPT_API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';

// County numbers → readable names (for the regions we cover)
var DISRUPT_COUNTY_NAMES = {
  '12': 'Skåne',
  '13': 'Halland',
  '14': 'Göteborg',
  '7':  'Kronoberg',
  '8':  'Kalmar',
  '10': 'Blekinge'
};

// All county numbers we query
var DISRUPT_COUNTY_NOS = [7, 8, 10, 12, 13, 14];

// Keywords for severity classification (checked against FreeText)
var SEVERITY_HIGH_KEYWORDS = [
  'inställ', 'stopp', 'avstäng', 'spärr', 'olycka', 'påkör',
  'urspår', 'evakuer', 'brand', 'ej framkomlig', 'ersättningsbuss'
];
var SEVERITY_MEDIUM_KEYWORDS = [
  'försen', 'begräns', 'reducera', 'enkelspår', 'hastighetsnedsätt',
  'väntetid', 'signalfel', 'växelfel', 'kontaktledning', 'ändrad väg',
  'ändrad tid', 'kortare tåg'
];
var SEVERITY_LOW_KEYWORDS = [
  'risk', 'kan påverka', 'väntas', 'planerad', 'banarbete', 'underhåll',
  'kommande', 'information'
];

// ==========================================
// Utility functions
// ==========================================

/**
 * Classify severity from message text content.
 * Returns 'high', 'medium', 'low', or 'info'.
 */
function classifyDisruptSeverity(header, description) {
  var text = ((header || '') + ' ' + (description || '')).toLowerCase();

  for (var i = 0; i < SEVERITY_HIGH_KEYWORDS.length; i++) {
    if (text.indexOf(SEVERITY_HIGH_KEYWORDS[i]) !== -1) return 'high';
  }
  for (var j = 0; j < SEVERITY_MEDIUM_KEYWORDS.length; j++) {
    if (text.indexOf(SEVERITY_MEDIUM_KEYWORDS[j]) !== -1) return 'medium';
  }
  for (var k = 0; k < SEVERITY_LOW_KEYWORDS.length; k++) {
    if (text.indexOf(SEVERITY_LOW_KEYWORDS[k]) !== -1) return 'low';
  }
  return 'info';
}

/**
 * Get Swedish label for severity level
 */
function getSeverityLabel(severity) {
  switch (severity) {
    case 'high':   return 'Allvarligt';
    case 'medium': return 'Störning';
    case 'low':    return 'Information';
    default:       return 'Info';
  }
}

/**
 * Format a datetime string to YYYY-MM-DD HH:MM
 */
function formatDisruptDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    var date = d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
    var time = String(d.getHours()).padStart(2, '0') + ':'
      + String(d.getMinutes()).padStart(2, '0');
    return date + ' ' + time;
  } catch (e) {
    return '';
  }
}

/**
 * Format relative time (e.g. "3 min sedan", "2 tim sedan")
 */
function formatDisruptRelativeTime(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    var now = new Date();
    var diffMs = now.getTime() - d.getTime();

    // Future date
    if (diffMs < 0) {
      var futurMin = Math.floor(-diffMs / 60000);
      if (futurMin < 60) return 'om ' + futurMin + ' min';
      var futurH = Math.floor(futurMin / 60);
      if (futurH < 24) return 'om ' + futurH + ' tim';
      var futurD = Math.floor(futurH / 24);
      return 'om ' + futurD + ' d';
    }

    var diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just nu';
    if (diffMin < 60) return diffMin + ' min sedan';
    var diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return diffH + ' tim sedan';
    var diffD = Math.floor(diffH / 24);
    return diffD + ' d sedan';
  } catch (e) {
    return '';
  }
}

/**
 * Map county numbers to region names for a message
 */
function getDisruptRegionNames(countyNos) {
  var names = [];
  if (!countyNos || !countyNos.length) return names;
  for (var i = 0; i < countyNos.length; i++) {
    var name = DISRUPT_COUNTY_NAMES[String(countyNos[i])];
    if (name && names.indexOf(name) === -1) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Resolve station signature to readable name.
 * Checks our own map first, then departure.js data.
 */
function resolveDisruptStationName(sig) {
  if (!sig) return sig;
  // Check our own station name map (from TrainStation query)
  if (disruptStationNameMap && disruptStationNameMap[sig]) {
    return disruptStationNameMap[sig];
  }
  // Fall back to departure.js station name lookup
  if (typeof depApiStationNames !== 'undefined' && depApiStationNames[sig]) {
    return depApiStationNames[sig];
  }
  if (typeof sigToName === 'function') {
    return sigToName(sig);
  }
  return sig;
}

/**
 * Escape HTML special chars
 */
function escDisruptHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================
// Station-County mapping
// ==========================================

/**
 * Fetch station data from TrainStation v1.5 to build
 * station signature → county number mapping.
 * Only fetches stations in our 6 counties.
 * Cached after first successful fetch.
 */
async function fetchDisruptStationMap() {
  if (disruptStationCountyMap) return; // already loaded

  // Fetch ALL stations (no CountyNo filter — it may not be a valid filter field)
  // We'll filter client-side by matching CountyNo to our 6 counties
  var xml = '<REQUEST>'
    + '<LOGIN authenticationkey="' + TRAFIKVERKET_API_KEY + '" />'
    + '<QUERY objecttype="TrainStation" schemaversion="1.5">'
    + '<INCLUDE>LocationSignature</INCLUDE>'
    + '<INCLUDE>AdvertisedLocationName</INCLUDE>'
    + '<INCLUDE>CountyNo</INCLUDE>'
    + '</QUERY>'
    + '</REQUEST>';

  // Try direct API first, fall back to proxy
  var urls = [DISRUPT_API_URL, TRAFIKVERKET_PROXY_URL];
  var response = null;

  for (var u = 0; u < urls.length; u++) {
    try {
      response = await fetch(urls[u], {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml
      });
      if (response.ok) {
        console.log('[DISRUPT] Station map fetched via: ' + (u === 0 ? 'direkt API' : 'proxy'));
        break;
      }
      var errTxt = '';
      try { errTxt = await response.text(); } catch (e) { /* ignore */ }
      console.warn('[DISRUPT] Station map ' + (u === 0 ? 'direkt' : 'proxy') + ' HTTP ' + response.status + ': ' + errTxt.substring(0, 150));
      response = null;
    } catch (fetchErr) {
      console.warn('[DISRUPT] Station map ' + (u === 0 ? 'direkt' : 'proxy') + ' fetch error: ' + fetchErr.message);
      response = null;
    }
  }

  if (!response || !response.ok) {
    console.warn('[DISRUPT] Station map could not be loaded from any source');
    disruptStationCountyMap = {};
    disruptStationNameMap = {};
    return;
  }

  var data = JSON.parse(await response.text());
  var stations = [];
  if (data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
    stations = data.RESPONSE.RESULT[0].TrainStation || [];
  }

  disruptStationCountyMap = {};
  disruptStationNameMap = {};

  // Build mapping, only include stations in our 6 counties
  var ourCountySet = {};
  for (var c = 0; c < DISRUPT_COUNTY_NOS.length; c++) {
    ourCountySet[String(DISRUPT_COUNTY_NOS[c])] = true;
  }

  for (var s = 0; s < stations.length; s++) {
    var sig = stations[s].LocationSignature;
    var county = stations[s].CountyNo;
    var name = stations[s].AdvertisedLocationName;
    if (!sig) continue;

    // CountyNo can be a single number or an array
    var countyArr = Array.isArray(county) ? county : (county ? [county] : []);
    var matchesOurCounty = false;
    for (var ci = 0; ci < countyArr.length; ci++) {
      if (ourCountySet[String(countyArr[ci])]) {
        matchesOurCounty = true;
        break;
      }
    }

    if (matchesOurCounty) {
      disruptStationCountyMap[sig] = countyArr;
      if (name) disruptStationNameMap[sig] = name;
    }
  }

  console.log('[DISRUPT] Station map: ' + Object.keys(disruptStationCountyMap).length + ' stationer i våra län (av ' + stations.length + ' totalt)');
}

// ==========================================
// API query + parsing
// ==========================================

/**
 * Build XML request for TrainStationMessage v1.0.
 * Fetches all non-deleted messages modified in last 30 days.
 * Filtering by region + time range is done client-side.
 */
function buildDisruptXml() {
  var xml = '<REQUEST>'
    + '<LOGIN authenticationkey="' + TRAFIKVERKET_API_KEY + '" />'
    + '<QUERY objecttype="TrainStationMessage" schemaversion="1.0">'
    + '<FILTER>'
    + '<AND>'
    + '<EQ name="Deleted" value="false" />'
    + '<GT name="ModifiedTime" value="$dateadd(-30.00:00:00)" />'
    + '</AND>'
    + '</FILTER>'
    + '</QUERY>'
    + '</REQUEST>';
  return xml;
}

/**
 * Parse raw TrainStationMessage objects into our internal format.
 * Filters out messages not matching our 6 counties.
 *
 * TrainStationMessage fields:
 *   Id, MediaType, LocationCode, StartDateTime, EndDateTime,
 *   SplitActivationTime, FreeText, Status, VersionNumber,
 *   ActiveDays, PlatformSignAttributes, Deleted, ModifiedTime
 */
function parseDisruptMessages(rawMessages) {
  var parsed = [];
  var now = new Date();
  var skippedOutsideRegion = 0;

  for (var i = 0; i < rawMessages.length; i++) {
    var msg = rawMessages[i];

    // Skip deleted
    if (msg.Deleted) continue;

    // Skip empty messages
    var freeText = (msg.FreeText || '').trim();
    if (!freeText) continue;

    // Station / location
    var locationCode = msg.LocationCode || '';

    // County lookup — skip messages outside our 6 counties
    var countyNos = [];
    if (locationCode && disruptStationCountyMap) {
      countyNos = disruptStationCountyMap[locationCode] || [];
    }
    if (countyNos.length === 0) {
      skippedOutsideRegion++;
      continue; // Station not in our 6 counties
    }

    var regionNames = getDisruptRegionNames(countyNos);

    // Station name
    var stationName = resolveDisruptStationName(locationCode);

    // Extract a short header from FreeText
    // Remove common prefixes like "Kommande:", "Pågående:" etc.
    var cleanText = freeText.replace(/\n/g, ' ').trim();
    var header = cleanText;
    // Truncate to reasonable header length
    if (header.length > 90) {
      header = header.substring(0, 87) + '...';
    }

    // Full description (preserve newlines for expanded view)
    var description = freeText;

    // Severity classification from text
    var severity = classifyDisruptSeverity(header, description);

    // Dates
    var startDt = msg.StartDateTime ? new Date(msg.StartDateTime) : null;
    var endDt = msg.EndDateTime ? new Date(msg.EndDateTime) : null;

    // Is this message currently active? (EndDateTime in the future or null)
    var isActive = !endDt || endDt.getTime() > now.getTime();

    // Unique ID from API
    var msgId = msg.Id || ('tsm-' + i);

    parsed.push({
      id: msgId,
      header: header,
      description: description,
      reasonCode: '',
      severity: severity,
      startTime: msg.StartDateTime || null,
      endTime: msg.EndDateTime || null,
      lastUpdated: msg.ModifiedTime || null,
      countyNos: countyNos,
      regionNames: regionNames,
      stations: locationCode ? [{ sig: locationCode, name: stationName }] : [],
      isActive: isActive,
      mediaType: msg.MediaType || '',
      status: msg.Status || ''
    });
  }

  if (skippedOutsideRegion > 0) {
    console.log('[DISRUPT] Filtrerade bort ' + skippedOutsideRegion + ' meddelanden utanför våra län');
  }

  // Sort: high severity first, then medium, low, info; within same severity, newest first
  var severityOrder = { 'high': 0, 'medium': 1, 'low': 2, 'info': 3 };
  parsed.sort(function(a, b) {
    var sa = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 3;
    var sb = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 3;
    if (sa !== sb) return sa - sb;
    // Within same severity, newest updated first
    var ta = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
    var tb = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
    return tb - ta;
  });

  return parsed;
}

// ==========================================
// Fetch + render
// ==========================================

/**
 * Fetch disruption messages from Trafikverket API.
 * Flow: fetch station map → fetch TrainStationMessage → parse → filter → render
 */
async function fetchDisruptions() {
  var statusEl = document.getElementById('disruptStatus');
  var loadingEl = document.getElementById('disruptLoading');
  var emptyEl = document.getElementById('disruptEmpty');

  // Show loading on first load (if no messages yet)
  if (disruptAllMessages.length === 0 && loadingEl) {
    loadingEl.style.display = '';
  }
  if (emptyEl) emptyEl.style.display = 'none';

  // Update status bar
  if (statusEl) {
    statusEl.innerHTML = '<span class="disrupt-status-spinner"></span> Hämtar trafikmeddelanden...';
    statusEl.classList.remove('error');
  }

  try {
    // 1. Load station-county mapping (cached after first call)
    await fetchDisruptStationMap();

    // 2. Also load station names from departure.js if available
    if (typeof fetchDepStationNames === 'function') {
      await fetchDepStationNames();
    }

    // 3. Fetch TrainStationMessage
    var xml = buildDisruptXml();
    var response = await fetch(DISRUPT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    });

    if (!response.ok) {
      var errorText = '';
      try { errorText = await response.text(); } catch (e) { /* ignore */ }
      console.warn('[DISRUPT] HTTP ' + response.status + ': ' + errorText.substring(0, 200));
      throw new Error('HTTP ' + response.status);
    }

    var data = JSON.parse(await response.text());
    var rawMessages = [];
    if (data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
      rawMessages = data.RESPONSE.RESULT[0].TrainStationMessage || [];
    }

    console.log('[DISRUPT] ' + rawMessages.length + ' meddelanden totalt från API');

    // 4. Parse + filter by our 6 counties
    var allParsed = parseDisruptMessages(rawMessages);
    console.log('[DISRUPT] ' + allParsed.length + ' meddelanden i våra län');

    // 5. Client-side time range filtering
    var now = new Date();
    if (disruptTimeRange === 'active') {
      // Show only currently active or upcoming messages
      disruptAllMessages = allParsed.filter(function(m) { return m.isActive; });
    } else {
      // Show messages modified within the selected time range
      var msRanges = { '24h': 86400000, '3d': 259200000, '7d': 604800000 };
      var msAgo = msRanges[disruptTimeRange] || 86400000;
      var cutoff = new Date(now.getTime() - msAgo);
      disruptAllMessages = allParsed.filter(function(m) {
        var t = m.lastUpdated ? new Date(m.lastUpdated) : null;
        return t && t.getTime() >= cutoff.getTime();
      });
    }

    console.log('[DISRUPT] ' + disruptAllMessages.length + ' efter tidsfilter (' + disruptTimeRange + ')');

    // 6. Hide loading
    if (loadingEl) loadingEl.style.display = 'none';

    // 7. Update UI
    updateDisruptChipCounts();
    renderDisruptList();
    updateDisruptSummary();

    // 8. Update status bar with timestamp + countdown
    var timeStr = String(now.getHours()).padStart(2, '0') + ':'
      + String(now.getMinutes()).padStart(2, '0') + ':'
      + String(now.getSeconds()).padStart(2, '0');
    if (statusEl) {
      statusEl.innerHTML = 'Uppdaterad ' + timeStr + ' · <span id="disruptCountdownVal">' + DISRUPT_REFRESH_SEC + '</span>s';
      statusEl.classList.remove('error');
      startDisruptCountdown();
    }

  } catch (err) {
    console.error('[DISRUPT] Fel: ' + (err.message || err));
    if (loadingEl) loadingEl.style.display = 'none';
    if (statusEl) {
      statusEl.innerHTML = '⚠️ ' + (err.message || 'Fel') + ' · Försöker igen...';
      statusEl.classList.add('error');
    }
    // If we had previous data, keep showing it
    if (disruptAllMessages.length > 0) {
      renderDisruptList();
    }
  }
}

// ==========================================
// Countdown timer
// ==========================================

function startDisruptCountdown() {
  if (disruptCountdownTimer) clearInterval(disruptCountdownTimer);
  var seconds = DISRUPT_REFRESH_SEC;
  disruptCountdownTimer = setInterval(function() {
    seconds--;
    var el = document.getElementById('disruptCountdownVal');
    if (el) el.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(disruptCountdownTimer);
      disruptCountdownTimer = null;
    }
  }, 1000);
}

// ==========================================
// Filtering
// ==========================================

/**
 * Get filtered messages based on active region chips
 */
function getFilteredDisruptions() {
  var allActive = disruptActiveRegions['all'] === true;

  return disruptAllMessages.filter(function(msg) {
    if (allActive) return true;

    // Check if any of the message's counties match an active filter
    if (!msg.countyNos || msg.countyNos.length === 0) return false;
    for (var i = 0; i < msg.countyNos.length; i++) {
      if (disruptActiveRegions[String(msg.countyNos[i])] === true) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Update chip counts based on current messages
 */
function updateDisruptChipCounts() {
  // Count messages per region
  var regionCounts = {};
  for (var i = 0; i < disruptAllMessages.length; i++) {
    var msg = disruptAllMessages[i];
    if (msg.countyNos) {
      for (var j = 0; j < msg.countyNos.length; j++) {
        var key = String(msg.countyNos[j]);
        regionCounts[key] = (regionCounts[key] || 0) + 1;
      }
    }
  }

  // Update chip labels with counts
  var chips = document.querySelectorAll('#disruptFilterChips .disrupt-chip');
  for (var c = 0; c < chips.length; c++) {
    var chip = chips[c];
    var region = chip.getAttribute('data-region');
    if (region === 'all') {
      var countSpan = chip.querySelector('.disrupt-chip-count');
      if (!countSpan) {
        countSpan = document.createElement('span');
        countSpan.className = 'disrupt-chip-count';
        chip.appendChild(countSpan);
      }
      countSpan.textContent = disruptAllMessages.length;
    } else {
      var count = regionCounts[region] || 0;
      var countSpanR = chip.querySelector('.disrupt-chip-count');
      if (!countSpanR) {
        countSpanR = document.createElement('span');
        countSpanR.className = 'disrupt-chip-count';
        chip.appendChild(countSpanR);
      }
      countSpanR.textContent = count;
    }
  }
}

/**
 * Update the summary bar text
 */
function updateDisruptSummary() {
  var filtered = getFilteredDisruptions();
  var summaryTextEl = document.getElementById('disruptSummaryText');
  var summaryIconEl = document.querySelector('.disrupt-summary-icon');

  if (!summaryTextEl) return;

  if (filtered.length === 0) {
    var rangeLabels = { 'active': 'aktiva', '24h': 'senaste 24h', '3d': 'senaste 3 dagarna', '7d': 'senaste 7 dagarna' };
    var rangeLabel = rangeLabels[disruptTimeRange] || 'aktiva';
    summaryTextEl.textContent = 'Inga störningar (' + rangeLabel + ')';
    if (summaryIconEl) summaryIconEl.textContent = '✅';
  } else {
    // Count severities
    var highCount = 0;
    var medCount = 0;
    for (var i = 0; i < filtered.length; i++) {
      if (filtered[i].severity === 'high') highCount++;
      else if (filtered[i].severity === 'medium') medCount++;
    }

    var parts = [];
    parts.push(filtered.length + ' meddelande' + (filtered.length !== 1 ? 'n' : ''));
    if (highCount > 0) parts.push(highCount + ' allvarlig' + (highCount !== 1 ? 'a' : ''));

    summaryTextEl.textContent = parts.join(' · ');
    if (summaryIconEl) {
      if (highCount > 0) summaryIconEl.textContent = '🔴';
      else if (medCount > 0) summaryIconEl.textContent = '🟡';
      else summaryIconEl.textContent = '🔵';
    }
  }
}

// ==========================================
// Card rendering
// ==========================================

/**
 * Build HTML for a single disruption card
 */
function buildDisruptCard(msg) {
  var isExpanded = (disruptExpandedId === msg.id);
  var cardClass = 'disrupt-card severity-' + msg.severity + (isExpanded ? ' expanded' : '');

  // Region tags
  var regionHtml = '';
  for (var r = 0; r < msg.regionNames.length; r++) {
    regionHtml += '<span class="disrupt-region-tag">' + escDisruptHtml(msg.regionNames[r]) + '</span>';
  }

  // Severity badge
  var severityBadge = '<span class="disrupt-severity-badge severity-' + msg.severity + '">'
    + getSeverityLabel(msg.severity) + '</span>';

  // Active/expired indicator
  var activeBadge = '';
  if (!msg.isActive) {
    activeBadge = '<span class="disrupt-severity-badge severity-info">Avslutad</span>';
  }

  // Relative time (based on ModifiedTime)
  var relTime = formatDisruptRelativeTime(msg.lastUpdated);
  var timeHtml = relTime ? '<span class="disrupt-card-time">' + escDisruptHtml(relTime) + '</span>' : '';

  // Description for expanded body (preserve line breaks)
  var descHtml = escDisruptHtml(msg.description).replace(/\n/g, '<br>');

  // Stations list
  var stationsHtml = '';
  if (msg.stations.length > 0) {
    var stationTags = '';
    for (var s = 0; s < msg.stations.length; s++) {
      stationTags += '<span class="disrupt-station-tag">' + escDisruptHtml(msg.stations[s].name) + '</span>';
    }
    stationsHtml = '<div class="disrupt-stations">'
      + '<div class="disrupt-stations-label">Station</div>'
      + '<div class="disrupt-stations-list">' + stationTags + '</div>'
      + '</div>';
  }

  // Time details
  var timeDetailHtml = '';
  var startStr = formatDisruptDateTime(msg.startTime);
  var endStr = formatDisruptDateTime(msg.endTime);
  var updatedStr = formatDisruptDateTime(msg.lastUpdated);

  if (startStr || endStr || updatedStr) {
    timeDetailHtml = '<div class="disrupt-time-detail">';
    if (startStr) {
      timeDetailHtml += '<span><span class="disrupt-time-label">Start:</span> ' + startStr + '</span>';
    }
    if (endStr) {
      timeDetailHtml += '<span><span class="disrupt-time-label">Slut:</span> ' + endStr + '</span>';
    }
    if (updatedStr) {
      timeDetailHtml += '<span><span class="disrupt-time-label">Uppdaterad:</span> ' + updatedStr + '</span>';
    }
    timeDetailHtml += '</div>';
  }

  return '<div class="' + cardClass + '" data-id="' + escDisruptHtml(String(msg.id)) + '">'
    + '<div class="disrupt-card-header">'
    + '<div class="disrupt-card-top">'
    + '<div class="disrupt-card-title">' + escDisruptHtml(msg.header) + '</div>'
    + '<span class="disrupt-card-expand">▸</span>'
    + '</div>'
    + '<div class="disrupt-card-meta">'
    + severityBadge
    + activeBadge
    + regionHtml
    + timeHtml
    + '</div>'
    + '</div>'
    + '<div class="disrupt-card-body">'
    + '<div class="disrupt-card-desc">' + descHtml + '</div>'
    + stationsHtml
    + timeDetailHtml
    + '</div>'
    + '</div>';
}

/**
 * Render the disruptions list (filtered)
 */
function renderDisruptList() {
  var listEl = document.getElementById('disruptList');
  var emptyEl = document.getElementById('disruptEmpty');
  var loadingEl = document.getElementById('disruptLoading');

  if (!listEl) return;
  if (loadingEl) loadingEl.style.display = 'none';

  var filtered = getFilteredDisruptions();

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) {
      emptyEl.style.display = '';
      var emptyTitle = emptyEl.querySelector('.disrupt-empty-title');
      var emptyText = emptyEl.querySelector('.disrupt-empty-text');
      if (disruptTimeRange === 'active') {
        if (emptyTitle) emptyTitle.textContent = 'Inga kända störningar';
        if (emptyText) emptyText.textContent = 'Just nu ser trafiken bra ut i ditt område.';
      } else {
        var labels = { '24h': 'senaste 24 timmarna', '3d': 'senaste 3 dagarna', '7d': 'senaste 7 dagarna' };
        if (emptyTitle) emptyTitle.textContent = 'Inga störningar hittades';
        if (emptyText) emptyText.textContent = 'Inga meddelanden under ' + (labels[disruptTimeRange] || '') + ' för valda regioner.';
      }
    }
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    html += buildDisruptCard(filtered[i]);
  }
  listEl.innerHTML = html;

  // Attach click handlers for expand/collapse
  var cards = listEl.querySelectorAll('.disrupt-card-header');
  for (var c = 0; c < cards.length; c++) {
    cards[c].addEventListener('click', handleDisruptCardClick);
  }
}

// ==========================================
// Card expand/collapse
// ==========================================

function handleDisruptCardClick() {
  var card = this.closest('.disrupt-card');
  if (!card) return;
  var id = card.getAttribute('data-id');

  if (disruptExpandedId === id) {
    disruptExpandedId = null;
    card.classList.remove('expanded');
  } else {
    var prev = document.querySelector('.disrupt-card.expanded');
    if (prev) prev.classList.remove('expanded');
    disruptExpandedId = id;
    card.classList.add('expanded');
  }
}

// ==========================================
// Region filter chips
// ==========================================

function initDisruptFilters() {
  // Default: all regions active
  disruptActiveRegions = { 'all': true };
  var keys = Object.keys(DISRUPT_COUNTY_NAMES);
  for (var i = 0; i < keys.length; i++) {
    disruptActiveRegions[keys[i]] = true;
  }

  var chips = document.querySelectorAll('#disruptFilterChips .disrupt-chip');
  for (var c = 0; c < chips.length; c++) {
    chips[c].addEventListener('click', handleDisruptChipClick);
  }
}

function handleDisruptChipClick() {
  var region = this.getAttribute('data-region');

  if (region === 'all') {
    var allCurrentlyActive = disruptActiveRegions['all'] === true;
    var newState = !allCurrentlyActive;

    disruptActiveRegions['all'] = newState;
    var keys = Object.keys(DISRUPT_COUNTY_NAMES);
    for (var i = 0; i < keys.length; i++) {
      disruptActiveRegions[keys[i]] = newState;
    }
  } else {
    disruptActiveRegions[region] = !disruptActiveRegions[region];

    var allActive = true;
    var rKeys = Object.keys(DISRUPT_COUNTY_NAMES);
    for (var j = 0; j < rKeys.length; j++) {
      if (!disruptActiveRegions[rKeys[j]]) {
        allActive = false;
        break;
      }
    }
    disruptActiveRegions['all'] = allActive;
  }

  // Update chip visual state
  var chips = document.querySelectorAll('#disruptFilterChips .disrupt-chip');
  for (var c = 0; c < chips.length; c++) {
    var r = chips[c].getAttribute('data-region');
    chips[c].classList.toggle('active', disruptActiveRegions[r] === true);
  }

  renderDisruptList();
  updateDisruptSummary();
}

// ==========================================
// Time range toggle
// ==========================================

function initDisruptTimeToggle() {
  var btns = document.querySelectorAll('#disruptTimeToggle .disrupt-time-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', handleDisruptTimeClick);
  }
}

function handleDisruptTimeClick() {
  var range = this.getAttribute('data-range');
  if (range === disruptTimeRange) return;

  disruptTimeRange = range;

  var btns = document.querySelectorAll('#disruptTimeToggle .disrupt-time-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-range') === range);
  }

  // Clear existing data so loading spinner shows
  disruptAllMessages = [];
  disruptExpandedId = null;

  // Re-fetch with new time range
  fetchDisruptions();
}

// ==========================================
// Page lifecycle
// ==========================================

function onDisruptionsPageShow() {
  disruptPageActive = true;

  var header = document.querySelector('.header');
  if (header) {
    document.documentElement.style.setProperty('--dep-header-height', header.offsetHeight + 'px');
  }

  // Initialize filters on first show
  if (Object.keys(disruptActiveRegions).length === 0) {
    initDisruptFilters();
  }

  initDisruptTimeToggle();
  fetchDisruptions();

  // Auto-refresh
  disruptRefreshTimer = setInterval(function() {
    if (disruptPageActive) fetchDisruptions();
  }, DISRUPT_REFRESH_SEC * 1000);
}

function onDisruptionsPageHide() {
  disruptPageActive = false;
  if (disruptRefreshTimer) {
    clearInterval(disruptRefreshTimer);
    disruptRefreshTimer = null;
  }
  if (disruptCountdownTimer) {
    clearInterval(disruptCountdownTimer);
    disruptCountdownTimer = null;
  }
}
