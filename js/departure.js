// ==========================================
// DEPARTURE BOARD (Avgång / Ankomst)
// ==========================================

let departureType = 'Avgang'; // 'Avgang' or 'Ankomst'
let departureRefreshTimer = null;
let departurePageActive = false;
const DEFAULT_TRAFIKVERKET_API_KEY = 'dbd424f3abd74e19be0b4f18009c4000';

// Train product filters — only show these train types
const ALLOWED_TRAIN_PRODUCTS = ['öresundståg', 'pågatågen'];

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
 * Initialize the departure page: event listeners
 */
function initDeparturePage() {
  var stationSelect = document.getElementById('departureStation');
  var btnAvgang = document.getElementById('depToggleAvgang');
  var btnAnkomst = document.getElementById('depToggleAnkomst');

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
      loadDepartures();
    });
  }

  if (btnAnkomst) {
    btnAnkomst.addEventListener('click', function() {
      departureType = 'Ankomst';
      btnAnkomst.classList.add('active');
      if (btnAvgang) btnAvgang.classList.remove('active');
      loadDepartures();
    });
  }

  // Trafikverket API key save
  var apiSaveBtn = document.getElementById('trafikverketApiKeySave');
  if (apiSaveBtn) {
    apiSaveBtn.addEventListener('click', saveTrafikverketApiKey);
  }

  // Collapsible header
  var tvHeader = document.getElementById('trafikverketHeader');
  var tvSection = document.getElementById('trafikverketSection');
  if (tvHeader && tvSection) {
    tvHeader.addEventListener('click', function() {
      tvSection.classList.toggle('expanded');
      // Load saved key when expanding
      if (tvSection.classList.contains('expanded')) {
        loadTrafikverketApiKeyUI();
      }
    });
  }
}

/**
 * Save API key to IndexedDB
 */
async function saveTrafikverketApiKey() {
  var input = document.getElementById('trafikverketApiKeyInput');
  var statusEl = document.getElementById('trafikverketApiKeyStatus');
  if (!input) return;

  var key = input.value.trim();
  if (!key) {
    if (statusEl) { statusEl.textContent = 'Ange en API-nyckel'; statusEl.className = 'api-key-status'; }
    return;
  }

  await saveSetting('trafikverketApiKey', key);
  if (statusEl) {
    statusEl.textContent = '✓ Sparad';
    statusEl.className = 'api-key-status saved';
  }
}

/**
 * Load API key into input field when settings section opens
 */
async function loadTrafikverketApiKeyUI() {
  var input = document.getElementById('trafikverketApiKeyInput');
  var statusEl = document.getElementById('trafikverketApiKeyStatus');
  if (!input) return;

  var savedKey = await loadSetting('trafikverketApiKey');
  if (savedKey) {
    input.value = savedKey;
    if (statusEl) {
      statusEl.textContent = '✓ Nyckel sparad';
      statusEl.className = 'api-key-status saved';
    }
  } else if (DEFAULT_TRAFIKVERKET_API_KEY) {
    input.value = DEFAULT_TRAFIKVERKET_API_KEY;
    if (statusEl) {
      statusEl.textContent = 'Standardnyckel aktiv';
      statusEl.className = 'api-key-status saved';
    }
  }
}

/**
 * Called when departure page becomes visible
 */
function onDeparturePageShow() {
  departurePageActive = true;
  loadDepartures();
  // Auto-refresh every 30 seconds
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
 * Load departures/arrivals from Trafikverket API
 */
async function loadDepartures() {
  var statusEl = document.getElementById('departureStatus');
  var tbodyEl = document.getElementById('departureTableBody');
  var titleEl = document.getElementById('departureBoardTitle');
  var stationSelect = document.getElementById('departureStation');

  if (!tbodyEl || !stationSelect) return;

  var stationSig = stationSelect.value;
  var stationName = stationNames[stationSig] || stationSig;

  // Update title and table header
  if (titleEl) {
    if (departureType === 'Avgang') {
      titleEl.textContent = 'Avgående tåg från ' + stationName;
    } else {
      titleEl.textContent = 'Ankommande tåg till ' + stationName;
    }
  }

  // Update column header (Till vs Från)
  var thRow = document.querySelector('.departure-table thead tr');
  if (thRow) {
    var ths = thRow.querySelectorAll('th');
    if (ths.length >= 2) {
      ths[1].textContent = departureType === 'Avgang' ? 'Till' : 'Från';
    }
  }

  // Check API key (use saved key or fall back to default)
  var apiKey = await loadSetting('trafikverketApiKey') || DEFAULT_TRAFIKVERKET_API_KEY;
  if (!apiKey) {
    tbodyEl.innerHTML = '';
    var boardEl = document.getElementById('departureBoard');
    if (boardEl) boardEl.style.display = 'none';
    if (statusEl) {
      statusEl.innerHTML = '<div class="dep-no-key">'
        + '<div class="dep-no-key-icon">🔑</div>'
        + '<p>API-nyckel saknas</p>'
        + '<p>Lägg till din Trafikverket API-nyckel i Inställningar</p>'
        + '<button class="dep-go-settings" onclick="showPage(\'settings\')">Gå till Inställningar</button>'
        + '</div>';
      statusEl.className = 'departure-status';
    }
    return;
  }

  // Show board, show loading
  var boardEl2 = document.getElementById('departureBoard');
  if (boardEl2) boardEl2.style.display = '';
  if (statusEl) {
    statusEl.innerHTML = '<span class="dep-loading-spinner"></span> Hämtar data...';
    statusEl.className = 'departure-status';
  }

  // Build XML request
  var locationField = departureType === 'Avgang' ? 'ToLocation' : 'FromLocation';
  var xml = '<REQUEST>'
    + '<LOGIN authenticationkey="' + apiKey + '" />'
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
    // Try text/xml first (works on most browsers), fall back to text/plain (avoids CORS preflight on iOS)
    var response;
    try {
      response = await fetch('https://api.trafikinfo.trafikverket.se/v2/data.json', {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml
      });
    } catch (fetchErr) {
      // Fallback: text/plain avoids CORS preflight
      response = await fetch('https://api.trafikinfo.trafikverket.se/v2/data.json', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: xml
      });
    }

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    var data = await response.json();
    var announcements = [];

    if (data && data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
      announcements = data.RESPONSE.RESULT[0].TrainAnnouncement || [];
    }

    // Filter to only allowed train products (Öresundståg, Pågatågen)
    if (ALLOWED_TRAIN_PRODUCTS.length > 0) {
      announcements = announcements.filter(function(a) {
        if (!a.ProductInformation || a.ProductInformation.length === 0) return false;
        for (var p = 0; p < a.ProductInformation.length; p++) {
          var desc = a.ProductInformation[p].Description || a.ProductInformation[p];
          if (typeof desc === 'string') {
            if (ALLOWED_TRAIN_PRODUCTS.indexOf(desc.toLowerCase()) !== -1) return true;
          } else if (desc && desc.Description) {
            if (ALLOWED_TRAIN_PRODUCTS.indexOf(desc.Description.toLowerCase()) !== -1) return true;
          }
        }
        return false;
      });
    }

    renderDepartureBoard(announcements, locationField);

    // Show refresh time
    var now = new Date();
    var timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
    if (statusEl) {
      statusEl.innerHTML = '<div class="dep-refresh-time">Uppdaterad ' + timeStr + ' · Nästa om 30s</div>';
      statusEl.className = 'departure-status';
    }

  } catch (err) {
    console.error('Departure fetch error:', JSON.stringify({message: err.message, stack: err.stack}));
    if (statusEl) {
      statusEl.innerHTML = '⚠️ Kunde inte hämta data: ' + (err.message || 'okänt fel') + '<div class="dep-refresh-time">Försöker igen om 30s</div>';
      statusEl.className = 'departure-status error';
    }
  }
}

/**
 * Render departure/arrival rows in the board table
 */
function renderDepartureBoard(announcements, locationField) {
  var tbodyEl = document.getElementById('departureTableBody');
  if (!tbodyEl) return;

  if (announcements.length === 0) {
    tbodyEl.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">Inga tåg hittades</td></tr>';
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
      // Get the last location (final destination)
      destName = locArr[locArr.length - 1].LocationName || '';
    }

    // Track
    var track = a.TrackAtLocation || '';

    // Train number
    var trainId = a.AdvertisedTrainIdent || '';

    // Product info + Deviation = Anmärkning
    var notes = [];
    if (a.ProductInformation && a.ProductInformation.length > 0) {
      for (var p = 0; p < a.ProductInformation.length; p++) {
        var desc = a.ProductInformation[p].Description || a.ProductInformation[p];
        if (typeof desc === 'string') notes.push(desc);
        else if (desc && desc.Description) notes.push(desc.Description);
      }
    }
    if (a.Deviation && a.Deviation.length > 0) {
      for (var d = 0; d < a.Deviation.length; d++) {
        var devDesc = a.Deviation[d].Description || a.Deviation[d];
        if (typeof devDesc === 'string') notes.push(devDesc);
        else if (devDesc && devDesc.Description) notes.push(devDesc.Description);
      }
    }

    var isCancelled = a.Canceled === true;
    if (isCancelled) notes.push('Inställt');

    var noteStr = notes.join(' ');
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

