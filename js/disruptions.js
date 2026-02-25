// ==========================================
// TRAFIKSTÖRNINGAR (Disruptions)
// Fetches TrainMessage from Trafikverket API
// ==========================================

// --- State ---
var disruptPageActive = false;
var disruptRefreshTimer = null;
var disruptCountdownTimer = null;
var disruptAllMessages = [];       // raw parsed messages from API
var disruptActiveRegions = {};     // { '12': true, '13': true, ... }
var disruptExpandedId = null;      // currently expanded card ID (one at a time)
var disruptTimeRange = 'active';   // 'active', '24h', '3d', '7d'

// Refresh interval in seconds
var DISRUPT_REFRESH_SEC = 60;

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

// Keywords for severity classification (checked against header + description)
var SEVERITY_HIGH_KEYWORDS = [
  'inställ', 'stopp', 'avstäng', 'spärr', 'olycka', 'påkör',
  'urspår', 'evakuer', 'brand', 'ej framkomlig'
];
var SEVERITY_MEDIUM_KEYWORDS = [
  'försen', 'begräns', 'reducera', 'enkelspår', 'hastighetsnedsätt',
  'väntetid', 'signalfel', 'växelfel', 'kontaktledning'
];
var SEVERITY_LOW_KEYWORDS = [
  'risk', 'kan påverka', 'väntas', 'planerad', 'banarbete', 'underhåll'
];

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
 * Format a datetime string to HH:MM
 */
function formatDisruptTime(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  } catch (e) {
    return '';
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
 * Resolve affected location signatures to readable names.
 * Uses depApiStationNames from departure.js if available.
 */
function resolveDisruptStationName(sig) {
  if (!sig) return sig;
  // Use departure.js station name lookup if available
  if (typeof depApiStationNames !== 'undefined' && depApiStationNames[sig]) {
    return depApiStationNames[sig];
  }
  // Use departure.js sigToName function if available
  if (typeof sigToName === 'function') {
    return sigToName(sig);
  }
  return sig;
}

/**
 * Get the $dateadd filter string for the selected time range.
 * Returns empty string for 'active' (no time filter = only active messages).
 * Trafikverket $dateadd format: -D.HH:MM:SS (negative = past)
 */
function getDisruptTimeFilter() {
  switch (disruptTimeRange) {
    case '24h': return '$dateadd(-1.00:00:00)';
    case '3d':  return '$dateadd(-3.00:00:00)';
    case '7d':  return '$dateadd(-7.00:00:00)';
    default:    return ''; // 'active' — no time filter
  }
}

/**
 * Build the XML request for Trafikverket TrainMessage API.
 * Fetches messages for our county numbers within the selected time range.
 */
function buildDisruptXml() {
  // Build OR-clause for county numbers
  var countyFilters = '';
  for (var i = 0; i < DISRUPT_COUNTY_NOS.length; i++) {
    countyFilters += '<EQ name="CountyNo" value="' + DISRUPT_COUNTY_NOS[i] + '" />';
  }

  // Time filter — only added for historical views (24h / 3d / 7d)
  var timeFilter = getDisruptTimeFilter();

  // Build filter block: wrap in AND only if we have both county + time filters
  var filterBlock;
  if (timeFilter) {
    filterBlock = '<AND>'
      + '<OR>' + countyFilters + '</OR>'
      + '<GT name="LastUpdateDateTime" value="' + timeFilter + '" />'
      + '</AND>';
  } else {
    // Active only — just county filter, no AND wrapper needed
    filterBlock = '<OR>' + countyFilters + '</OR>';
  }

  var xml = '<REQUEST>'
    + '<LOGIN authenticationkey="' + TRAFIKVERKET_API_KEY + '" />'
    + '<QUERY objecttype="TrainMessage" schemaversion="1.7" orderby="LastUpdateDateTime desc">'
    + '<FILTER>'
    + filterBlock
    + '</FILTER>'
    + '<INCLUDE>EventId</INCLUDE>'
    + '<INCLUDE>Header</INCLUDE>'
    + '<INCLUDE>ExternalDescription</INCLUDE>'
    + '<INCLUDE>ReasonCodeText</INCLUDE>'
    + '<INCLUDE>StartDateTime</INCLUDE>'
    + '<INCLUDE>EndDateTime</INCLUDE>'
    + '<INCLUDE>LastUpdateDateTime</INCLUDE>'
    + '<INCLUDE>CountyNo</INCLUDE>'
    + '<INCLUDE>AffectedLocation</INCLUDE>'
    + '<INCLUDE>TrafficImpact</INCLUDE>'
    + '</QUERY>'
    + '</REQUEST>';

  console.log('[DISRUPT] XML request built, range=' + disruptTimeRange);
  return xml;
}

/**
 * Parse raw TrainMessage objects into our internal format.
 */
function parseDisruptMessages(rawMessages) {
  var parsed = [];

  for (var i = 0; i < rawMessages.length; i++) {
    var msg = rawMessages[i];
    var header = msg.Header || '';
    var desc = msg.ExternalDescription || '';
    var reasonCode = msg.ReasonCodeText || '';

    // Extract affected station signatures
    var stationSigs = [];
    if (msg.AffectedLocation && msg.AffectedLocation.length > 0) {
      for (var s = 0; s < msg.AffectedLocation.length; s++) {
        var loc = msg.AffectedLocation[s];
        var sig = loc.LocationSignature || loc;
        if (typeof sig === 'string' && stationSigs.indexOf(sig) === -1) {
          stationSigs.push(sig);
        }
      }
    }

    // Also extract from TrafficImpact if present
    if (msg.TrafficImpact && msg.TrafficImpact.length > 0) {
      for (var t = 0; t < msg.TrafficImpact.length; t++) {
        var impact = msg.TrafficImpact[t];
        if (impact.AffectedLocation && impact.AffectedLocation.length > 0) {
          for (var tl = 0; tl < impact.AffectedLocation.length; tl++) {
            var tloc = impact.AffectedLocation[tl];
            var tsig = tloc.LocationSignature || tloc;
            if (typeof tsig === 'string' && stationSigs.indexOf(tsig) === -1) {
              stationSigs.push(tsig);
            }
          }
        }
      }
    }

    // Resolve station names
    var stationNames = [];
    for (var sn = 0; sn < stationSigs.length; sn++) {
      stationNames.push({
        sig: stationSigs[sn],
        name: resolveDisruptStationName(stationSigs[sn])
      });
    }

    // County numbers for this message
    var countyNos = msg.CountyNo || [];
    var regionNames = getDisruptRegionNames(countyNos);

    // Severity
    var severity = classifyDisruptSeverity(header, desc);

    parsed.push({
      id: msg.EventId || ('msg-' + i),
      header: header,
      description: desc,
      reasonCode: reasonCode,
      severity: severity,
      startTime: msg.StartDateTime || null,
      endTime: msg.EndDateTime || null,
      lastUpdated: msg.LastUpdateDateTime || null,
      countyNos: countyNos,
      regionNames: regionNames,
      stations: stationNames
    });
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

/**
 * Fetch disruption messages from Trafikverket API
 */
async function fetchDisruptions() {
  var statusEl = document.getElementById('disruptStatus');
  var loadingEl = document.getElementById('disruptLoading');
  var emptyEl = document.getElementById('disruptEmpty');
  var listEl = document.getElementById('disruptList');

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
    // Ensure station names are loaded (reuses departure.js function)
    if (typeof fetchDepStationNames === 'function') {
      await fetchDepStationNames();
    }

    var xml = buildDisruptXml();
    console.log('[DISRUPT] Sending request to: ' + TRAFIKVERKET_PROXY_URL);
    console.log('[DISRUPT] XML body: ' + xml.substring(0, 300) + '...');

    var response = await fetch(TRAFIKVERKET_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    });

    console.log('[DISRUPT] Response status: ' + response.status);

    if (!response.ok) {
      var errorText = '';
      try { errorText = await response.text(); } catch (e) { /* ignore */ }
      console.log('[DISRUPT] Error response body: ' + errorText.substring(0, 500));
      throw new Error('HTTP ' + response.status + (errorText ? ' — ' + errorText.substring(0, 100) : ''));
    }

    var rawText = await response.text();
    console.log('[DISRUPT] Raw response (first 500 chars): ' + rawText.substring(0, 500));

    var data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.log('[DISRUPT] JSON parse error — response is not JSON');
      throw new Error('Svar var inte JSON: ' + rawText.substring(0, 100));
    }

    var rawMessages = [];

    if (data && data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
      rawMessages = data.RESPONSE.RESULT[0].TrainMessage || [];
      console.log('[DISRUPT] Got ' + rawMessages.length + ' TrainMessage(s)');
    } else {
      console.log('[DISRUPT] Unexpected response structure: ' + JSON.stringify(data).substring(0, 500));
    }

    // If we got 0 results, log the full response for debugging
    if (rawMessages.length === 0) {
      console.log('[DISRUPT] 0 messages returned. Full response: ' + JSON.stringify(data).substring(0, 1000));
    } else {
      // Log first message as sample
      console.log('[DISRUPT] Sample message: ' + JSON.stringify(rawMessages[0]).substring(0, 500));
    }

    // Parse into our internal format
    disruptAllMessages = parseDisruptMessages(rawMessages);

    // Hide loading
    if (loadingEl) loadingEl.style.display = 'none';

    // Update region chip counts
    updateDisruptChipCounts();

    // Render filtered list
    renderDisruptList();

    // Update summary bar
    updateDisruptSummary();

    // Update status bar with timestamp + countdown
    var now = new Date();
    var timeStr = String(now.getHours()).padStart(2, '0') + ':'
      + String(now.getMinutes()).padStart(2, '0') + ':'
      + String(now.getSeconds()).padStart(2, '0');
    if (statusEl) {
      statusEl.innerHTML = 'Uppdaterad ' + timeStr + ' · <span id="disruptCountdownVal">' + DISRUPT_REFRESH_SEC + '</span>s';
      statusEl.classList.remove('error');
      startDisruptCountdown();
    }

  } catch (err) {
    console.error('[DISRUPT] Fetch error: ' + (err.message || err));
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

/**
 * Start countdown timer in status bar
 */
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
      // "Alla" chip shows total unique messages
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
    parts.push(filtered.length + ' störning' + (filtered.length !== 1 ? 'ar' : ''));
    if (highCount > 0) parts.push(highCount + ' allvarlig' + (highCount !== 1 ? 'a' : ''));

    summaryTextEl.textContent = parts.join(' · ');
    if (summaryIconEl) {
      if (highCount > 0) summaryIconEl.textContent = '🔴';
      else if (medCount > 0) summaryIconEl.textContent = '🟡';
      else summaryIconEl.textContent = '🔵';
    }
  }
}

/**
 * Escape HTML special chars
 */
function escDisruptHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

  // Relative time
  var relTime = formatDisruptRelativeTime(msg.lastUpdated);
  var timeHtml = relTime ? '<span class="disrupt-card-time">' + escDisruptHtml(relTime) + '</span>' : '';

  // Description (for expanded body)
  var descHtml = escDisruptHtml(msg.description);

  // Reason code
  var reasonHtml = '';
  if (msg.reasonCode) {
    reasonHtml = '<div class="disrupt-card-desc" style="margin-top:6px;font-style:italic;opacity:0.8;">'
      + escDisruptHtml(msg.reasonCode) + '</div>';
  }

  // Stations list
  var stationsHtml = '';
  if (msg.stations.length > 0) {
    var stationTags = '';
    for (var s = 0; s < msg.stations.length; s++) {
      stationTags += '<span class="disrupt-station-tag">' + escDisruptHtml(msg.stations[s].name) + '</span>';
    }
    stationsHtml = '<div class="disrupt-stations">'
      + '<div class="disrupt-stations-label">Berörda stationer</div>'
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
    + regionHtml
    + timeHtml
    + '</div>'
    + '</div>'
    + '<div class="disrupt-card-body">'
    + '<div class="disrupt-card-desc">' + descHtml + '</div>'
    + reasonHtml
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
      // Update empty state text based on time range
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

/**
 * Handle card expand/collapse (one at a time)
 */
function handleDisruptCardClick() {
  var card = this.closest('.disrupt-card');
  if (!card) return;
  var id = card.getAttribute('data-id');

  if (disruptExpandedId === id) {
    // Collapse
    disruptExpandedId = null;
    card.classList.remove('expanded');
  } else {
    // Collapse previous
    var prev = document.querySelector('.disrupt-card.expanded');
    if (prev) prev.classList.remove('expanded');
    // Expand this one
    disruptExpandedId = id;
    card.classList.add('expanded');
  }
}

/**
 * Initialize region filter chips with click handlers
 */
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

/**
 * Handle region chip click — toggle logic:
 * - "Alla" toggles all on/off
 * - Individual chip toggles itself; if all individuals are active, "Alla" becomes active too
 */
function handleDisruptChipClick() {
  var region = this.getAttribute('data-region');

  if (region === 'all') {
    // Toggle all
    var allCurrentlyActive = disruptActiveRegions['all'] === true;
    var newState = !allCurrentlyActive;

    disruptActiveRegions['all'] = newState;
    var keys = Object.keys(DISRUPT_COUNTY_NAMES);
    for (var i = 0; i < keys.length; i++) {
      disruptActiveRegions[keys[i]] = newState;
    }
  } else {
    // Toggle individual
    disruptActiveRegions[region] = !disruptActiveRegions[region];

    // Check if all individual regions are now active → auto-activate "Alla"
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

  // Re-render
  renderDisruptList();
  updateDisruptSummary();
}

/**
 * Initialize time range toggle buttons
 */
function initDisruptTimeToggle() {
  var btns = document.querySelectorAll('#disruptTimeToggle .disrupt-time-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', handleDisruptTimeClick);
  }
}

/**
 * Handle time range button click
 */
function handleDisruptTimeClick() {
  var range = this.getAttribute('data-range');
  if (range === disruptTimeRange) return; // already selected

  disruptTimeRange = range;

  // Update button visual state
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

/**
 * Called when the disruptions page is shown
 */
function onDisruptionsPageShow() {
  disruptPageActive = true;

  // Measure header height (reuse departure page pattern)
  var header = document.querySelector('.header');
  if (header) {
    document.documentElement.style.setProperty('--dep-header-height', header.offsetHeight + 'px');
  }

  // Initialize filters on first show
  if (Object.keys(disruptActiveRegions).length === 0) {
    initDisruptFilters();
  }

  // Initialize time toggle on first show
  initDisruptTimeToggle();

  // Fetch data immediately
  fetchDisruptions();

  // Auto-refresh
  disruptRefreshTimer = setInterval(function() {
    if (disruptPageActive) fetchDisruptions();
  }, DISRUPT_REFRESH_SEC * 1000);
}

/**
 * Called when leaving the disruptions page
 */
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
