// ==========================================
// TRAFIKSTÖRNINGAR (Disruptions)
// Fetches TrainStationMessage v1.0 + TrainAnnouncement v1.9
// with Deviation and ReasonCode from Trafikverket API
// ==========================================

// --- State ---
var disruptPageActive = false;
var disruptRefreshTimer = null;
var disruptCountdownTimer = null;
var disruptAllMessages = [];       // parsed messages after client-side filtering
var disruptActiveRegions = {};     // { '12': true, '13': true, ... }
var disruptExpandedId = null;      // currently expanded card ID (one at a time)
var disruptTimeRange = 'active';   // 'active', '24h', '3d', '7d'
var disruptFiltersExpanded = false; // region filter bar collapsed by default
var disruptStationCountyMap = null;  // { 'Cst': [12], 'Hld': [13], ... } — sig → countyNo[]
var disruptStationNameMap = null;    // { 'Cst': 'Malmö C', ... } — sig → name
var disruptReasonCodeMap = null;    // { 'IBK3': 'Signalfel', ... } — code → description
var disruptTrainDeviations = [];   // parsed train deviations from TrainAnnouncement

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
 * Fetch station data from TrainStation v1 to build
 * station signature → county number mapping.
 * Filters client-side to our 6 counties.
 * Cached after first successful fetch.
 */
async function fetchDisruptStationMap() {
  if (disruptStationCountyMap) return; // already loaded

  var xml = '<REQUEST>'
    + '<LOGIN authenticationkey="' + TRAFIKVERKET_API_KEY + '" />'
    + '<QUERY objecttype="TrainStation" schemaversion="1">'
    + '<INCLUDE>LocationSignature</INCLUDE>'
    + '<INCLUDE>AdvertisedLocationName</INCLUDE>'
    + '<INCLUDE>CountyNo</INCLUDE>'
    + '</QUERY>'
    + '</REQUEST>';

  // Try proxy first (departure.js uses it), then direct API as fallback
  var urls = [TRAFIKVERKET_PROXY_URL, DISRUPT_API_URL];
  var response = null;

  for (var u = 0; u < urls.length; u++) {
    try {
      response = await fetch(urls[u], {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml
      });
      if (response.ok) break;
      response = null;
    } catch (e) {
      response = null;
    }
  }

  if (!response) {
    console.warn('[DISRUPT] Kunde inte hämta stationslista');
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

  var hasCountyNo = stations.length > 0 && stations[0].CountyNo !== undefined;

  if (hasCountyNo) {
    var ourCountySet = {};
    for (var c = 0; c < DISRUPT_COUNTY_NOS.length; c++) {
      ourCountySet[String(DISRUPT_COUNTY_NOS[c])] = true;
    }

    for (var s = 0; s < stations.length; s++) {
      var sig = stations[s].LocationSignature;
      var county = stations[s].CountyNo;
      var name = stations[s].AdvertisedLocationName;
      if (!sig) continue;

      var countyArr = Array.isArray(county) ? county : (county ? [county] : []);
      var matchesOurCounty = false;
      for (var ci = 0; ci < countyArr.length; ci++) {
        if (ourCountySet[String(countyArr[ci])]) { matchesOurCounty = true; break; }
      }

      if (matchesOurCounty) {
        disruptStationCountyMap[sig] = countyArr;
        if (name) disruptStationNameMap[sig] = name;
      }
    }
  } else {
    // CountyNo not available — include ALL stations so no messages are filtered out
    for (var s2 = 0; s2 < stations.length; s2++) {
      var sig2 = stations[s2].LocationSignature;
      var name2 = stations[s2].AdvertisedLocationName;
      if (!sig2) continue;
      disruptStationCountyMap[sig2] = DISRUPT_COUNTY_NOS.slice();
      if (name2) disruptStationNameMap[sig2] = name2;
    }
  }

  console.log('[DISRUPT] Stationer: ' + Object.keys(disruptStationCountyMap).length + ' i våra län (av ' + stations.length + ' totalt)');
}

// ==========================================
// ReasonCode lookup
// ==========================================

/**
 * Fetch ReasonCode v1.0 to build a code → description lookup.
 * Cached after first successful fetch.
 */
async function fetchReasonCodes() {
  if (disruptReasonCodeMap) return; // already loaded

  var xml = '<REQUEST>'
    + '<LOGIN authenticationkey="' + TRAFIKVERKET_API_KEY + '" />'
    + '<QUERY objecttype="ReasonCode" schemaversion="1" />'
    + '</REQUEST>';

  var urls = [TRAFIKVERKET_PROXY_URL, DISRUPT_API_URL];
  var response = null;

  for (var u = 0; u < urls.length; u++) {
    try {
      response = await fetch(urls[u], {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml
      });
      if (response.ok) break;
      response = null;
    } catch (e) {
      response = null;
    }
  }

  if (!response) {
    console.warn('[DISRUPT] Kunde inte hämta ReasonCode');
    disruptReasonCodeMap = {};
    return;
  }

  var data = JSON.parse(await response.text());
  var codes = [];
  if (data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
    codes = data.RESPONSE.RESULT[0].ReasonCode || [];
  }

  disruptReasonCodeMap = {};

  if (codes.length > 0) {
    // Log first entry to discover field structure
    console.log('[DISRUPT] ReasonCode fält: ' + Object.keys(codes[0]).join(', '));
    console.log('[DISRUPT] ReasonCode exempel: ' + JSON.stringify(codes[0]).substring(0, 300));

    for (var i = 0; i < codes.length; i++) {
      var rc = codes[i];
      // Try common field names — we'll adapt once we see the actual structure
      var code = rc.Code || rc.ReasonCode || rc.Id || '';
      var desc = rc.Description || rc.Text || rc.GroupDescription || '';
      if (code) {
        disruptReasonCodeMap[String(code)] = desc;
      }
    }
  }

  console.log('[DISRUPT] ReasonCode: ' + Object.keys(disruptReasonCodeMap).length + ' koder laddade');
}

// ==========================================
// TrainAnnouncement + Deviation
// ==========================================

/**
 * Fetch TrainAnnouncement v1.9 with Deviation field.
 * Gets trains with deviations in the last 3h → +6h ahead.
 * Only departures (Avgang) to avoid duplicates.
 * Filtered client-side to our 6 counties.
 */
async function fetchTrainDeviations() {
  var xml = '<REQUEST>'
    + '<LOGIN authenticationkey="' + TRAFIKVERKET_API_KEY + '" />'
    + '<QUERY objecttype="TrainAnnouncement" schemaversion="1.9">'
    + '<FILTER>'
    + '<AND>'
    + '<EXISTS name="Deviation" value="true" />'
    + '<GT name="AdvertisedTimeAtLocation" value="$dateadd(-0.03:00:00)" />'
    + '<LT name="AdvertisedTimeAtLocation" value="$dateadd(0.06:00:00)" />'
    + '<EQ name="ActivityType" value="Avgang" />'
    + '</AND>'
    + '</FILTER>'
    + '<INCLUDE>AdvertisedTrainIdent</INCLUDE>'
    + '<INCLUDE>LocationSignature</INCLUDE>'
    + '<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>'
    + '<INCLUDE>EstimatedTimeAtLocation</INCLUDE>'
    + '<INCLUDE>TimeAtLocation</INCLUDE>'
    + '<INCLUDE>Deviation</INCLUDE>'
    + '<INCLUDE>Canceled</INCLUDE>'
    + '<INCLUDE>FromLocation</INCLUDE>'
    + '<INCLUDE>ToLocation</INCLUDE>'
    + '<INCLUDE>ProductInformation</INCLUDE>'
    + '<INCLUDE>ModifiedTime</INCLUDE>'
    + '</QUERY>'
    + '</REQUEST>';

  // TrainAnnouncement works on both proxy and direct API
  var urls = [TRAFIKVERKET_PROXY_URL, DISRUPT_API_URL];
  var response = null;

  for (var u = 0; u < urls.length; u++) {
    try {
      response = await fetch(urls[u], {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml
      });
      if (response.ok) break;
      response = null;
    } catch (e) {
      response = null;
    }
  }

  if (!response) {
    console.warn('[DISRUPT] Kunde inte hämta TrainAnnouncement');
    disruptTrainDeviations = [];
    return;
  }

  var data = JSON.parse(await response.text());
  var announcements = [];
  if (data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
    announcements = data.RESPONSE.RESULT[0].TrainAnnouncement || [];
  }

  console.log('[DISRUPT] TrainAnnouncement: ' + announcements.length + ' avvikelser från API');

  // Log first entry to discover field structure
  if (announcements.length > 0) {
    console.log('[DISRUPT] TA fält: ' + Object.keys(announcements[0]).join(', '));
    console.log('[DISRUPT] TA exempel: ' + JSON.stringify(announcements[0]).substring(0, 500));
  }

  // Filter to our stations (6 counties)
  var inRegion = [];
  var outsideRegion = 0;

  for (var i = 0; i < announcements.length; i++) {
    var ann = announcements[i];
    var locSig = ann.LocationSignature || '';

    // Check if this station is in our counties
    if (!locSig || !disruptStationCountyMap || !disruptStationCountyMap[locSig]) {
      outsideRegion++;
      continue;
    }

    inRegion.push(ann);
  }

  console.log('[DISRUPT] TA i våra län: ' + inRegion.length + ' (filtrerade bort ' + outsideRegion + ')');

  // Group by TrainIdent + Deviation text to deduplicate
  // (same train passes many stations, each gets a deviation entry)
  var trainGroups = {};

  for (var j = 0; j < inRegion.length; j++) {
    var a = inRegion[j];
    var trainId = a.AdvertisedTrainIdent || 'unknown';
    var devTexts = a.Deviation || [];
    if (!Array.isArray(devTexts)) devTexts = [devTexts];
    var devKey = trainId + '|' + devTexts.join(';');

    if (!trainGroups[devKey]) {
      trainGroups[devKey] = {
        trainId: trainId,
        deviation: devTexts,
        canceled: a.Canceled || false,
        advertisedTime: a.AdvertisedTimeAtLocation || null,
        estimatedTime: a.EstimatedTimeAtLocation || null,
        actualTime: a.TimeAtLocation || null,
        fromLocation: a.FromLocation || [],
        toLocation: a.ToLocation || [],
        productInfo: a.ProductInformation || [],
        modifiedTime: a.ModifiedTime || null,
        stations: [],
        countyNos: []
      };
    }

    var tg = trainGroups[devKey];
    var locSig2 = a.LocationSignature || '';

    // Add station
    if (locSig2) {
      var sName = resolveDisruptStationName(locSig2);
      var already = false;
      for (var si = 0; si < tg.stations.length; si++) {
        if (tg.stations[si].sig === locSig2) { already = true; break; }
      }
      if (!already) {
        tg.stations.push({ sig: locSig2, name: sName });
      }
    }

    // Merge counties
    var cNos = disruptStationCountyMap[locSig2] || [];
    for (var ci = 0; ci < cNos.length; ci++) {
      if (tg.countyNos.indexOf(cNos[ci]) === -1) {
        tg.countyNos.push(cNos[ci]);
      }
    }

    // Track latest time
    if (a.ModifiedTime && (!tg.modifiedTime || a.ModifiedTime > tg.modifiedTime)) {
      tg.modifiedTime = a.ModifiedTime;
    }
  }

  // Convert groups to parsed deviation objects
  var parsed = [];
  var groupKeys = Object.keys(trainGroups);
  console.log('[DISRUPT] TA grupperade: ' + groupKeys.length + ' unika tågavvikelser');

  for (var g = 0; g < groupKeys.length; g++) {
    var grp = trainGroups[groupKeys[g]];
    var devText = grp.deviation.join(', ');

    // Build route description from FromLocation/ToLocation
    var fromNames = [];
    var toNames = [];
    if (Array.isArray(grp.fromLocation)) {
      for (var fi = 0; fi < grp.fromLocation.length; fi++) {
        var fSig = grp.fromLocation[fi].LocationName || grp.fromLocation[fi];
        fromNames.push(resolveDisruptStationName(String(fSig)));
      }
    }
    if (Array.isArray(grp.toLocation)) {
      for (var ti = 0; ti < grp.toLocation.length; ti++) {
        var tSig = grp.toLocation[ti].LocationName || grp.toLocation[ti];
        toNames.push(resolveDisruptStationName(String(tSig)));
      }
    }

    var routeStr = '';
    if (fromNames.length > 0 && toNames.length > 0) {
      routeStr = fromNames.join('/') + ' → ' + toNames.join('/');
    }

    // Product info (e.g. "Öresundståg", "Pågatåg")
    var productStr = '';
    if (Array.isArray(grp.productInfo)) {
      var prods = [];
      for (var pi = 0; pi < grp.productInfo.length; pi++) {
        var p = grp.productInfo[pi];
        var pDesc = (typeof p === 'object' && p.Description) ? p.Description : String(p);
        if (pDesc && prods.indexOf(pDesc) === -1) prods.push(pDesc);
      }
      productStr = prods.join(', ');
    }

    // Header: "Tåg 1042 — Inställt" or "Tåg 587 — Försenad ca 15 min"
    var header = 'Tåg ' + grp.trainId;
    if (routeStr) header += '  ' + routeStr;

    // Severity from deviation text + canceled flag
    var severity = 'info';
    if (grp.canceled) {
      severity = 'high';
    } else {
      severity = classifyDisruptSeverity(devText, devText);
    }

    // Build description
    var descParts = [];
    if (devText) descParts.push(devText);
    if (productStr) descParts.push('Typ: ' + productStr);
    if (grp.advertisedTime) descParts.push('Planerad avg: ' + formatDisruptDateTime(grp.advertisedTime));
    if (grp.estimatedTime) descParts.push('Beräknad avg: ' + formatDisruptDateTime(grp.estimatedTime));

    // Sort stations alphabetically
    grp.stations.sort(function(a, b) {
      return (a.name || '').localeCompare(b.name || '', 'sv');
    });

    parsed.push({
      id: 'ta-' + grp.trainId + '-' + g,
      header: header,
      description: descParts.join('\n'),
      reasonCode: '',
      severity: severity,
      startTime: grp.advertisedTime,
      endTime: null,
      lastUpdated: grp.modifiedTime,
      countyNos: grp.countyNos,
      regionNames: getDisruptRegionNames(grp.countyNos),
      stations: grp.stations,
      isActive: true, // deviations are always current
      mediaType: '',
      status: grp.canceled ? 'Inställt' : '',
      stationCount: grp.stations.length,
      // Extra fields for train deviations
      isTrain: true,
      trainId: grp.trainId,
      deviationText: devText,
      route: routeStr,
      productInfo: productStr,
      canceled: grp.canceled
    });
  }

  // Sort: high severity first, then newest
  var severityOrder = { 'high': 0, 'medium': 1, 'low': 2, 'info': 3 };
  parsed.sort(function(a, b) {
    var sa = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 3;
    var sb = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 3;
    if (sa !== sb) return sa - sb;
    var ta = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
    var tb = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
    return tb - ta;
  });

  disruptTrainDeviations = parsed;
  console.log('[DISRUPT] TA klart: ' + parsed.length + ' avvikelser att visa');
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
  var now = new Date();
  var skippedOutsideRegion = 0;

  // Step 1: Group messages by FreeText (same disruption sent to multiple stations)
  var groups = {};  // FreeText → { msgs: [...], stations: [...], countyNos: [...] }

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
      continue;
    }

    // Use FreeText as grouping key
    if (!groups[freeText]) {
      groups[freeText] = {
        raw: msg,
        stations: [],
        countyNos: [],
        latestModified: msg.ModifiedTime || null
      };
    }

    var group = groups[freeText];

    // Add station if not already present
    if (locationCode) {
      var stationName = resolveDisruptStationName(locationCode);
      var alreadyAdded = false;
      for (var si = 0; si < group.stations.length; si++) {
        if (group.stations[si].sig === locationCode) { alreadyAdded = true; break; }
      }
      if (!alreadyAdded) {
        group.stations.push({ sig: locationCode, name: stationName });
      }
    }

    // Merge county numbers
    for (var ci = 0; ci < countyNos.length; ci++) {
      if (group.countyNos.indexOf(countyNos[ci]) === -1) {
        group.countyNos.push(countyNos[ci]);
      }
    }

    // Track latest ModifiedTime
    if (msg.ModifiedTime && (!group.latestModified || msg.ModifiedTime > group.latestModified)) {
      group.latestModified = msg.ModifiedTime;
    }
  }

  if (skippedOutsideRegion > 0) {
    console.log('[DISRUPT] Filtrerade bort ' + skippedOutsideRegion + ' meddelanden utanför våra län');
  }

  // Step 2: Convert groups to parsed messages
  var parsed = [];
  var groupKeys = Object.keys(groups);
  console.log('[DISRUPT] Grupperade till ' + groupKeys.length + ' unika meddelanden (från ' + (rawMessages.length - skippedOutsideRegion) + ')');

  for (var g = 0; g < groupKeys.length; g++) {
    var grp = groups[groupKeys[g]];
    var raw = grp.raw;
    var text = groupKeys[g];

    // Extract a short header from FreeText
    var cleanText = text.replace(/\n/g, ' ').trim();
    var header = cleanText;
    if (header.length > 90) {
      header = header.substring(0, 87) + '...';
    }

    // Severity classification
    var severity = classifyDisruptSeverity(header, text);

    // Region names from merged counties
    var regionNames = getDisruptRegionNames(grp.countyNos);

    // Active check
    var endDt = raw.EndDateTime ? new Date(raw.EndDateTime) : null;
    var isActive = !endDt || endDt.getTime() > now.getTime();

    // Sort stations alphabetically by name
    grp.stations.sort(function(a, b) {
      return (a.name || '').localeCompare(b.name || '', 'sv');
    });

    parsed.push({
      id: raw.Id || ('tsm-' + g),
      header: header,
      description: text,
      reasonCode: '',
      severity: severity,
      startTime: raw.StartDateTime || null,
      endTime: raw.EndDateTime || null,
      lastUpdated: grp.latestModified,
      countyNos: grp.countyNos,
      regionNames: regionNames,
      stations: grp.stations,
      isActive: isActive,
      mediaType: raw.MediaType || '',
      status: raw.Status || '',
      stationCount: grp.stations.length
    });
  }

  // Sort: high severity first, then medium, low, info; within same severity, newest first
  var severityOrder = { 'high': 0, 'medium': 1, 'low': 2, 'info': 3 };
  parsed.sort(function(a, b) {
    var sa = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 3;
    var sb = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 3;
    if (sa !== sb) return sa - sb;
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
 * Flow: fetch station map → fetch all data sources in parallel → merge → filter → render
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
    // 1. Load station-county mapping + station names (cached after first call)
    await fetchDisruptStationMap();
    if (typeof fetchDepStationNames === 'function') {
      await fetchDepStationNames();
    }

    // 2. Fetch all data sources in parallel:
    //    - TrainStationMessage (station messages)
    //    - TrainAnnouncement with Deviation (train-specific deviations)
    //    - ReasonCode (lookup table)
    var tsmPromise = fetch(DISRUPT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: buildDisruptXml()
    });

    var taPromise = fetchTrainDeviations().catch(function(e) {
      console.warn('[DISRUPT] TA-fetch misslyckades: ' + e.message);
    });

    var rcPromise = fetchReasonCodes().catch(function(e) {
      console.warn('[DISRUPT] ReasonCode-fetch misslyckades: ' + e.message);
    });

    // Wait for all three
    var results = await Promise.all([tsmPromise, taPromise, rcPromise]);
    var response = results[0];

    if (!response.ok) {
      var errorText = '';
      try { errorText = await response.text(); } catch (e) { /* ignore */ }
      console.warn('[DISRUPT] TSM HTTP ' + response.status + ': ' + errorText.substring(0, 200));
      throw new Error('HTTP ' + response.status);
    }

    var data = JSON.parse(await response.text());
    var rawMessages = [];
    if (data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
      rawMessages = data.RESPONSE.RESULT[0].TrainStationMessage || [];
    }

    console.log('[DISRUPT] TSM: ' + rawMessages.length + ' meddelanden från API');

    // 3. Parse station messages + filter by our 6 counties
    var stationParsed = parseDisruptMessages(rawMessages);

    // 4. Merge: station messages first, then train deviations
    var allParsed = stationParsed.concat(disruptTrainDeviations);
    console.log('[DISRUPT] Totalt: ' + stationParsed.length + ' stationsmeddelanden + ' + disruptTrainDeviations.length + ' tågavvikelser = ' + allParsed.length);

    // 5. Client-side time range filtering
    var now = new Date();
    if (disruptTimeRange === 'active') {
      disruptAllMessages = allParsed.filter(function(m) { return m.isActive; });
    } else {
      var msRanges = { '24h': 86400000, '3d': 259200000, '7d': 604800000 };
      var msAgo = msRanges[disruptTimeRange] || 86400000;
      var cutoff = new Date(now.getTime() - msAgo);
      disruptAllMessages = allParsed.filter(function(m) {
        var t = m.lastUpdated ? new Date(m.lastUpdated) : null;
        return t && t.getTime() >= cutoff.getTime();
      });
    }

    // 6. Sort merged list: severity → time
    var severityOrder = { 'high': 0, 'medium': 1, 'low': 2, 'info': 3 };
    disruptAllMessages.sort(function(a, b) {
      var sa = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 3;
      var sb = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 3;
      if (sa !== sb) return sa - sb;
      var ta = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
      var tb = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
      return tb - ta;
    });

    console.log('[DISRUPT] ' + disruptAllMessages.length + ' efter tidsfilter (' + disruptTimeRange + ')');

    // 7. Hide loading
    if (loadingEl) loadingEl.style.display = 'none';

    // 8. Update UI
    updateDisruptChipCounts();
    renderDisruptList();
    updateDisruptSummary();

    // 9. Update status bar with timestamp + countdown
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

    // Count train deviations vs station messages
    var trainCount = 0;
    for (var tc = 0; tc < filtered.length; tc++) {
      if (filtered[tc].isTrain) trainCount++;
    }
    var stationMsgCount = filtered.length - trainCount;

    var parts = [];
    if (stationMsgCount > 0 && trainCount > 0) {
      parts.push(stationMsgCount + ' meddelande' + (stationMsgCount !== 1 ? 'n' : '') + ' + ' + trainCount + ' tågavvikelse' + (trainCount !== 1 ? 'r' : ''));
    } else {
      parts.push(filtered.length + ' meddelande' + (filtered.length !== 1 ? 'n' : ''));
    }
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
 * Build HTML for a single disruption card.
 * Supports both station messages (TrainStationMessage) and
 * train deviations (TrainAnnouncement) with different layouts.
 */
function buildDisruptCard(msg) {
  var isExpanded = (disruptExpandedId === msg.id);
  var isTrain = msg.isTrain === true;
  var cardClass = 'disrupt-card severity-' + msg.severity
    + (isTrain ? ' disrupt-card-train' : '')
    + (isExpanded ? ' expanded' : '');

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

  // Card icon: train icon for deviations, message icon for station messages
  var cardIcon = isTrain ? '🚆' : '📋';

  // Title: for trains, show "Tåg XXXX  From → To" with train icon
  var titleHtml = '';
  if (isTrain) {
    titleHtml = '<span class="disrupt-train-icon">' + cardIcon + '</span> '
      + '<span class="disrupt-train-id">Tåg ' + escDisruptHtml(msg.trainId) + '</span>';
    if (msg.route) {
      titleHtml += ' <span class="disrupt-train-route">' + escDisruptHtml(msg.route) + '</span>';
    }
  } else {
    titleHtml = escDisruptHtml(msg.header);
  }

  // Description for expanded body
  var descHtml = '';
  if (isTrain) {
    // Train deviation: show deviation text prominently
    descHtml = '<div class="disrupt-deviation-text">' + escDisruptHtml(msg.deviationText) + '</div>';
    if (msg.productInfo) {
      descHtml += '<div class="disrupt-product-info">' + escDisruptHtml(msg.productInfo) + '</div>';
    }
    // Time info inline
    var trainTimeHtml = '';
    if (msg.startTime) {
      trainTimeHtml += '<span><span class="disrupt-time-label">Avg:</span> '
        + formatDisruptDateTime(msg.startTime).split(' ')[1] + '</span>';
    }
    if (descHtml.indexOf('Beräknad') === -1 && msg.description.indexOf('Beräknad') !== -1) {
      // EstimatedTime already in description
    }
    if (trainTimeHtml) {
      descHtml += '<div class="disrupt-time-detail">' + trainTimeHtml + '</div>';
    }
  } else {
    descHtml = escDisruptHtml(msg.description).replace(/\n/g, '<br>');
  }

  // Stations list (grouped — may have many stations per message)
  var stationsHtml = '';
  if (msg.stations && msg.stations.length > 0) {
    var stationTags = '';
    var maxShow = 8;
    var showCount = Math.min(msg.stations.length, maxShow);
    for (var s = 0; s < showCount; s++) {
      stationTags += '<span class="disrupt-station-tag">' + escDisruptHtml(msg.stations[s].name) + '</span>';
    }
    if (msg.stations.length > maxShow) {
      stationTags += '<span class="disrupt-station-tag disrupt-station-more">+' + (msg.stations.length - maxShow) + ' till</span>';
    }
    var stLabel = msg.stations.length === 1 ? 'Station' : 'Berörda stationer (' + msg.stations.length + ')';
    stationsHtml = '<div class="disrupt-stations">'
      + '<div class="disrupt-stations-label">' + stLabel + '</div>'
      + '<div class="disrupt-stations-list">' + stationTags + '</div>'
      + '</div>';
  }

  // Time details (for station messages — trains show time differently)
  var timeDetailHtml = '';
  if (!isTrain) {
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
  }

  // Train-specific: canceled badge
  var canceledBadge = '';
  if (isTrain && msg.canceled) {
    canceledBadge = '<span class="disrupt-severity-badge severity-high">Inställt</span>';
  }

  return '<div class="' + cardClass + '" data-id="' + escDisruptHtml(String(msg.id)) + '">'
    + '<div class="disrupt-card-header">'
    + '<div class="disrupt-card-top">'
    + '<div class="disrupt-card-title">' + titleHtml + '</div>'
    + '<span class="disrupt-card-expand">▸</span>'
    + '</div>'
    + '<div class="disrupt-card-meta">'
    + severityBadge
    + canceledBadge
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
  // Default: only Skåne active
  disruptActiveRegions = { 'all': false, '12': true };

  // Set initial chip visual state (only Skåne active)
  var chips = document.querySelectorAll('#disruptFilterChips .disrupt-chip');
  for (var c = 0; c < chips.length; c++) {
    var r = chips[c].getAttribute('data-region');
    var isActive = (r === '12');
    chips[c].classList.toggle('active', isActive);
    chips[c].addEventListener('click', handleDisruptChipClick);
  }

  // Setup collapsible filter toggle
  var toggleBtn = document.getElementById('disruptFilterToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', handleDisruptFilterToggle);
  }
  updateDisruptFilterToggleLabel();
}

/**
 * Toggle the region filter bar open/closed
 */
function handleDisruptFilterToggle() {
  disruptFiltersExpanded = !disruptFiltersExpanded;
  var chipsEl = document.getElementById('disruptFilterChips');
  var toggleBtn = document.getElementById('disruptFilterToggle');
  if (chipsEl) {
    chipsEl.classList.toggle('expanded', disruptFiltersExpanded);
  }
  if (toggleBtn) {
    toggleBtn.classList.toggle('expanded', disruptFiltersExpanded);
  }
}

/**
 * Update the filter toggle label to show selected regions
 */
function updateDisruptFilterToggleLabel() {
  var labelEl = document.getElementById('disruptFilterToggleLabel');
  if (!labelEl) return;

  var allActive = disruptActiveRegions['all'] === true;
  if (allActive) {
    labelEl.textContent = 'Alla regioner';
    return;
  }

  var activeNames = [];
  var keys = Object.keys(DISRUPT_COUNTY_NAMES);
  for (var i = 0; i < keys.length; i++) {
    if (disruptActiveRegions[keys[i]]) {
      activeNames.push(DISRUPT_COUNTY_NAMES[keys[i]]);
    }
  }

  if (activeNames.length === 0) {
    labelEl.textContent = 'Inga regioner valda';
  } else if (activeNames.length <= 3) {
    labelEl.textContent = activeNames.join(', ');
  } else {
    labelEl.textContent = activeNames.length + ' regioner';
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

  updateDisruptFilterToggleLabel();
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
