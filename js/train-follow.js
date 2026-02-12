/**
 * Train Follow (Följ tåg) — pick a train to track in realtime.
 * Shows next station, countdown, track, arrival/departure times, upcoming stops.
 *
 * Persistence: cookie-based (per-device, valid until midnight).
 * Panel: fullscreen overlay below header.
 */

(function() {
  'use strict';

  // ==========================================
  // CONFIG
  // ==========================================
  var API_KEY = 'dbd424f3abd74e19be0b4f18009c4000';
  var PROXY_URL = 'https://trafikverket-proxy.kenny-eriksson1986.workers.dev';
  var POLL_INTERVAL = 30000; // 30s
  var COUNTDOWN_INTERVAL = 1000; // 1s
  var COOKIE_NAME = 'ft_train';

  // ==========================================
  // DOM REFS
  // ==========================================
  var followBtn = null;
  var modal = null;
  var inputEl = null;
  var panelEl = null;
  var subheaderEl = null;

  // ==========================================
  // STATE
  // ==========================================
  var followedTrain = null;    // { trainNr }
  var announcements = [];
  var pollTimer = null;
  var countdownTimer = null;
  var btnFlipTimer = null;
  var btnFlipShowingDelay = false;
  var nextStationData = null;
  var panelVisible = false;
  var currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };

  // ==========================================
  // STATION NAME MAP (signature → display name)
  // ==========================================
  var SIG_NAMES = {
    'Mc': 'Malmö C', 'Hie': 'Hyllie', 'Tri': 'Triangeln', 'Lu': 'Lund C',
    'Klv': 'Kävlinge', 'Lkr': 'Landskrona', 'Hb': 'Helsingborg C',
    'Åp': 'Åstorp', 'Elv': 'Eslöv', 'Hör': 'Höör', 'Hm': 'Hässleholm C',
    'Kr': 'Kristianstad C', 'Hd': 'Halmstad C', 'Av': 'Alvesta',
    'Vö': 'Växjö', 'Eba': 'Emmaboda', 'Kac': 'Kalmar C', 'Ck': 'Karlskrona C',
    'Tb': 'Trelleborg', 'Ys': 'Ystad', 'Sim': 'Simrishamn',
    'G': 'Göteborg C', 'Cst': 'Stockholm C', 'Mö': 'Malmö Godsbangård',
    'Smp': 'Sölvesborg', 'Bgs': 'Borås C', 'Fby': 'Falkenberg',
    'Vb': 'Varberg', 'K': 'Kungsbacka', 'Fa': 'Falköping C',
    'Sk': 'Skövde C', 'Lå': 'Linköping C', 'Nk': 'Norrköping C',
    'Kn': 'Katrineholm C', 'Söc': 'Södertälje C', 'Fg': 'Flemingsberg',
    'Äs': 'Arlöv', 'Brl': 'Burlöv', 'Sv': 'Svågertorp',
    'Kh': 'Karlshamn', 'Rn': 'Ronneby', 'Hpbg': 'Höganäs',
    'Å': 'Ängelholm', 'Bå': 'Båstad', 'La': 'Laholm',
    'Mh': 'Markaryd', 'Ay': 'Älmhult', 'Ö': 'Örebro C',
    'Hr': 'Hallsberg', 'Mjö': 'Mjölby', 'Km': 'Köpenhamn',
    'Kk': 'Kastrup', 'Jö': 'Jönköping C', 'Nä': 'Nässjö C',
    'Ht': 'Hestra', 'Bor': 'Borås', 'Vr': 'Värnamo'
  };

  function stationName(sig) {
    if (!sig) return sig;
    return SIG_NAMES[sig] || sig;
  }

  // ==========================================
  // COOKIE HELPERS (persists until midnight)
  // ==========================================

  function saveCookie(trainNr) {
    var midnight = new Date();
    midnight.setHours(23, 59, 59, 0);
    document.cookie = COOKIE_NAME + '=' + encodeURIComponent(trainNr)
      + '; expires=' + midnight.toUTCString() + '; path=/; SameSite=Lax';
  }

  function readCookie() {
    var match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function clearCookie() {
    document.cookie = COOKIE_NAME + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
  }

  // ==========================================
  // MODAL CREATION
  // ==========================================

  function createModal() {
    if (document.getElementById('followTrainModal')) return;

    var div = document.createElement('div');
    div.id = 'followTrainModal';
    div.className = 'ft-modal-overlay';
    div.innerHTML =
      '<div class="ft-modal">'
      + '<div class="ft-modal-header">'
      + '<span class="ft-modal-title">Följ tåg</span>'
      + '<button class="ft-modal-close" id="ftModalClose">×</button>'
      + '</div>'
      + '<div class="ft-modal-body">'
      + '<label class="ft-label" for="ftTrainInput">Ange tågnummer</label>'
      + '<input class="ft-input" type="text" id="ftTrainInput" inputmode="numeric" pattern="[0-9]*" placeholder="T.ex. 1071" autocomplete="off">'
      + '</div>'
      + '<div class="ft-modal-footer">'
      + '<button class="ft-btn ft-btn-cancel" id="ftBtnCancel">Avbryt</button>'
      + '<button class="ft-btn ft-btn-follow" id="ftBtnFollow">Följ</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(div);

    modal = div;
    inputEl = document.getElementById('ftTrainInput');

    document.getElementById('ftModalClose').addEventListener('click', closeModal);
    document.getElementById('ftBtnCancel').addEventListener('click', closeModal);
    document.getElementById('ftBtnFollow').addEventListener('click', onFollowClick);
    div.addEventListener('click', function(e) {
      if (e.target === div) closeModal();
    });

    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') onFollowClick();
    });
  }

  // ==========================================
  // OPEN / CLOSE MODAL
  // ==========================================

  function openModal() {
    createModal();
    modal.classList.add('active');
    inputEl.value = '';
    setTimeout(function() { inputEl.focus(); }, 100);
  }

  function closeModal() {
    if (modal) modal.classList.remove('active');
  }

  // ==========================================
  // BUTTON CLICK LOGIC
  // ==========================================

  function onButtonClick() {
    if (!followedTrain) {
      // No train followed → open modal to pick one
      openModal();
    } else if (panelVisible) {
      // Panel is showing → hide it (but keep following)
      hidePanel();
    } else {
      // Panel hidden, but we have a train → show it
      showPanel();
    }
  }

  // ==========================================
  // FOLLOW / STOP
  // ==========================================

  function onFollowClick() {
    var trainNr = (inputEl.value || '').trim();
    if (!trainNr || !/^\d{1,5}$/.test(trainNr)) {
      inputEl.classList.add('ft-input-error');
      setTimeout(function() { inputEl.classList.remove('ft-input-error'); }, 600);
      return;
    }

    startFollowing(trainNr);
    closeModal();
  }

  function startFollowing(trainNr) {
    stopFollowing(true); // stop previous without hiding panel yet
    followedTrain = { trainNr: trainNr };
    currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
    updateButton();
    saveCookie(trainNr);

    announcements = [];
    nextStationData = null;

    // Create and show panel
    createPanel();
    showPanel();
    showPanelLoading();

    // Start button flip timer
    startBtnFlipTimer();

    // Fetch immediately then poll
    fetchAndRender();
    pollTimer = setInterval(fetchAndRender, POLL_INTERVAL);
  }

  function stopFollowing(keepPanel) {
    followedTrain = null;
    announcements = [];
    nextStationData = null;
    currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
    clearCookie();
    stopBtnFlipTimer();
    updateButton();

    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

    if (!keepPanel) {
      hidePanel();
    }
  }

  function updateButton() {
    if (!followBtn) return;
    // Clear all status classes
    followBtn.classList.remove('following', 'ft-btn-ontime', 'ft-btn-minor', 'ft-btn-major');

    if (followedTrain) {
      followBtn.classList.add('following');
      // Apply delay color class
      applyBtnDelayClass();
      // Show train nr or delay based on flip state
      if (btnFlipShowingDelay) {
        followBtn.textContent = currentDelayInfo.delayText;
      } else {
        followBtn.textContent = 'Tåg ' + followedTrain.trainNr;
      }
    } else {
      followBtn.textContent = 'Följ tåg';
    }
  }

  function applyBtnDelayClass() {
    if (!followBtn || !followedTrain) return;
    followBtn.classList.remove('ft-btn-ontime', 'ft-btn-minor', 'ft-btn-major');
    if (currentDelayInfo.status === 'ontime') {
      followBtn.classList.add('ft-btn-ontime');
    } else if (currentDelayInfo.status === 'minor') {
      followBtn.classList.add('ft-btn-minor');
    } else if (currentDelayInfo.status === 'major') {
      followBtn.classList.add('ft-btn-major');
    }
  }

  /**
   * Compute delay info from trainRealtimeStore (if available) or from nextStationData.
   * Uses same rules as "Vem jobbar idag" badges:
   *   0 min or negative → ontime, "I tid"
   *   1-5 min → minor (yellow), "+X min"
   *   6+ min → major (red), "+X min"
   *   Canceled → major, "Inställt"
   */
  function computeDelayInfo() {
    if (!followedTrain) return;
    var trainNr = followedTrain.trainNr;

    // Try trainRealtimeStore from ui.js first (most accurate, shared data)
    if (typeof trainRealtimeStore !== 'undefined' && trainRealtimeStore[trainNr]) {
      var info = trainRealtimeStore[trainNr];
      currentDelayInfo = {
        status: info.status || 'ontime',
        delayText: info.delayText || 'I tid',
        delayMin: info.delayMin || 0
      };
      return;
    }

    // Fallback: compute from own nextStationData
    if (!nextStationData || nextStationData.nextIdx < 0) {
      currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
      return;
    }

    var stops = nextStationData.stops;
    var next = stops[nextStationData.nextIdx];
    if (!next) {
      currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
      return;
    }

    var timeInfo = next.arrival || next.departure;
    if (!timeInfo || !timeInfo.estimated || !timeInfo.planned) {
      currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
      return;
    }

    if (timeInfo.canceled) {
      currentDelayInfo = { status: 'major', delayText: 'Inställt', delayMin: 999 };
      return;
    }

    var dm = calcDelayMin(timeInfo.planned, timeInfo.estimated);
    if (dm >= 6) {
      currentDelayInfo = { status: 'major', delayText: '+' + dm + ' min', delayMin: dm };
    } else if (dm >= 1) {
      currentDelayInfo = { status: 'minor', delayText: '+' + dm + ' min', delayMin: dm };
    } else {
      currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
    }
  }

  // ==========================================
  // BUTTON FLIP TIMER (every 5s)
  // ==========================================

  function startBtnFlipTimer() {
    stopBtnFlipTimer();
    btnFlipShowingDelay = false;
    btnFlipTimer = setInterval(flipButton, 5000);
  }

  function stopBtnFlipTimer() {
    if (btnFlipTimer) { clearInterval(btnFlipTimer); btnFlipTimer = null; }
    btnFlipShowingDelay = false;
  }

  function flipButton() {
    if (!followedTrain || !followBtn) return;
    btnFlipShowingDelay = !btnFlipShowingDelay;
    updateButton();
  }

  // ==========================================
  // SUBHEADER + PANEL CREATION
  // ==========================================

  function createSubheader() {
    if (subheaderEl) return;
    var div = document.createElement('div');
    div.id = 'ftSubheader';
    div.className = 'ft-subheader';
    div.innerHTML = '<div class="ft-subheader-inner" id="ftSubheaderInner"></div>';
    // Insert after header
    var header = document.querySelector('.header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(div, header.nextSibling);
    } else {
      document.body.appendChild(div);
    }
    subheaderEl = div;
  }

  function updateSubheader() {
    createSubheader();
    if (!nextStationData || !followedTrain) {
      subheaderEl.classList.remove('active');
      return;
    }
    var d = nextStationData;
    var trainNr = d.trainNr;
    var route = d.firstStation + ' → ' + d.lastStation;

    // Delay status class for badge
    var statusClass = 'ft-status-ok';
    if (currentDelayInfo.status === 'major') statusClass = 'ft-status-major';
    else if (currentDelayInfo.status === 'minor') statusClass = 'ft-status-minor';

    var inner = document.getElementById('ftSubheaderInner');
    if (inner) {
      inner.innerHTML =
        '<div class="ft-topbar-left">'
        + '<span class="ft-train-badge ' + statusClass + '">' + trainNr + '</span>'
        + '<span class="ft-route">' + route + '</span>'
        + '</div>'
        + '<div class="ft-topbar-right">'
        + '<button class="ft-stop-follow-btn" id="ftStopFollow" title="Sluta följa">Sluta följa</button>'
        + '<button class="ft-close-btn" id="ftClosePanel" title="Stäng">✕</button>'
        + '</div>';

      document.getElementById('ftClosePanel').addEventListener('click', function() {
        hidePanel();
      });
      document.getElementById('ftStopFollow').addEventListener('click', function() {
        stopFollowing(false);
      });
    }
    subheaderEl.classList.add('active');
  }

  function hideSubheader() {
    if (subheaderEl) subheaderEl.classList.remove('active');
  }

  function createPanel() {
    if (panelEl) return;

    var div = document.createElement('div');
    div.id = 'ftPanel';
    div.className = 'ft-panel';
    div.innerHTML = '<div class="ft-panel-inner" id="ftPanelInner"></div>';

    // Insert after subheader (or header)
    var after = subheaderEl || document.querySelector('.header');
    if (after && after.nextSibling) {
      after.parentNode.insertBefore(div, after.nextSibling);
    } else if (after) {
      after.parentNode.appendChild(div);
    } else {
      document.body.appendChild(div);
    }
    panelEl = div;
  }

  function recalcPanelTop() {
    var header = document.querySelector('.header');
    var headerH = header ? header.offsetHeight : 56;

    // Position subheader right below header
    if (subheaderEl) {
      subheaderEl.style.top = headerH + 'px';
    }

    // Position panel below header + subheader
    if (panelEl) {
      var top = headerH;
      if (subheaderEl && subheaderEl.classList.contains('active')) {
        top += subheaderEl.offsetHeight;
      }
      panelEl.style.top = top + 'px';
    }
  }

  function showPanel() {
    createPanel();
    recalcPanelTop();
    panelEl.classList.add('active');
    panelVisible = true;
    document.body.classList.add('ft-panel-open');
  }

  function hidePanel() {
    if (panelEl) panelEl.classList.remove('active');
    panelVisible = false;
    document.body.classList.remove('ft-panel-open');
    hideSubheader();
  }

  function showPanelLoading() {
    var inner = document.getElementById('ftPanelInner');
    if (!inner) return;
    inner.innerHTML =
      '<div class="ft-loading">'
      + '<div class="ft-loading-spinner"></div>'
      + '<span>Hämtar tågdata...</span>'
      + '</div>';
  }

  // ==========================================
  // API FETCH
  // ==========================================

  async function fetchAndRender() {
    if (!followedTrain) return;
    var trainNr = followedTrain.trainNr;

    try {
      var xml = '<REQUEST>'
        + '<LOGIN authenticationkey="' + API_KEY + '" />'
        + '<QUERY objecttype="TrainAnnouncement" schemaversion="1.9" orderby="AdvertisedTimeAtLocation">'
        + '<FILTER>'
        + '<AND>'
        + '<EQ name="AdvertisedTrainIdent" value="' + trainNr + '" />'
        + '<GT name="AdvertisedTimeAtLocation" value="$dateadd(-12:00:00)" />'
        + '<LT name="AdvertisedTimeAtLocation" value="$dateadd(12:00:00)" />'
        + '</AND>'
        + '</FILTER>'
        + '<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>'
        + '<INCLUDE>EstimatedTimeAtLocation</INCLUDE>'
        + '<INCLUDE>TimeAtLocation</INCLUDE>'
        + '<INCLUDE>TrackAtLocation</INCLUDE>'
        + '<INCLUDE>AdvertisedTrainIdent</INCLUDE>'
        + '<INCLUDE>LocationSignature</INCLUDE>'
        + '<INCLUDE>ActivityType</INCLUDE>'
        + '<INCLUDE>ToLocation</INCLUDE>'
        + '<INCLUDE>FromLocation</INCLUDE>'
        + '<INCLUDE>Canceled</INCLUDE>'
        + '<INCLUDE>ProductInformation</INCLUDE>'
        + '</QUERY>'
        + '</REQUEST>';

      var response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();

      var result = [];
      if (data && data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
        result = data.RESPONSE.RESULT[0].TrainAnnouncement || [];
      }

      announcements = result;
      processAnnouncements();
      computeDelayInfo();
      updateButton();
      renderPanel();
    } catch (err) {
      var inner = document.getElementById('ftPanelInner');
      if (inner && announcements.length === 0) {
        inner.innerHTML =
          '<div class="ft-error">Kunde inte hämta data. Försöker igen...</div>';
      }
    }
  }

  // ==========================================
  // PROCESS ANNOUNCEMENTS → STOPS
  // ==========================================

  function processAnnouncements() {
    var stopsMap = {};
    var stopsOrder = [];

    for (var i = 0; i < announcements.length; i++) {
      var a = announcements[i];
      var loc = a.LocationSignature;
      if (!stopsMap[loc]) {
        stopsMap[loc] = { station: loc, arrival: null, departure: null, track: null, passed: false };
        stopsOrder.push(loc);
      }
      var stop = stopsMap[loc];

      var planned = a.AdvertisedTimeAtLocation ? a.AdvertisedTimeAtLocation.substring(11, 16) : '';
      var estimated = a.EstimatedTimeAtLocation ? a.EstimatedTimeAtLocation.substring(11, 16) : '';
      var actual = a.TimeAtLocation ? a.TimeAtLocation.substring(11, 16) : '';
      var track = a.TrackAtLocation || '';
      var canceled = a.Canceled || false;

      if (track) stop.track = track;

      var timeObj = {
        planned: planned,
        estimated: estimated,
        actual: actual,
        canceled: canceled,
        advertisedFull: a.AdvertisedTimeAtLocation || '',
        estimatedFull: a.EstimatedTimeAtLocation || ''
      };

      if (a.ActivityType === 'Ankomst') {
        stop.arrival = timeObj;
        if (actual) stop.passed = true;
      } else if (a.ActivityType === 'Avgang') {
        stop.departure = timeObj;
        if (actual) stop.passed = true;
      }
    }

    var stops = stopsOrder.map(function(loc) { return stopsMap[loc]; });
    var firstStation = stops.length > 0 ? stops[0].station : '';
    var lastStation = stops.length > 0 ? stops[stops.length - 1].station : '';

    var nextIdx = -1;
    for (var j = 0; j < stops.length; j++) {
      if (!stops[j].passed) { nextIdx = j; break; }
    }

    var product = '';
    if (announcements.length > 0 && announcements[0].ProductInformation) {
      var pi = announcements[0].ProductInformation;
      product = Array.isArray(pi) ? pi[0] : pi;
      if (typeof product === 'object' && product.Description) product = product.Description;
    }

    nextStationData = {
      stops: stops,
      nextIdx: nextIdx,
      firstStation: firstStation,
      lastStation: lastStation,
      product: product,
      trainNr: followedTrain ? followedTrain.trainNr : ''
    };
  }

  // ==========================================
  // RENDER PANEL
  // ==========================================

  function renderPanel() {
    var inner = document.getElementById('ftPanelInner');
    if (!inner || !nextStationData) return;

    var d = nextStationData;
    var stops = d.stops;
    var nextIdx = d.nextIdx;

    // Determine delay for next-station card
    var delayMin = 0;
    if (nextIdx >= 0 && stops[nextIdx]) {
      var ns = stops[nextIdx];
      var timeInfo = ns.arrival || ns.departure;
      if (timeInfo && timeInfo.estimated && timeInfo.planned) {
        delayMin = calcDelayMin(timeInfo.planned, timeInfo.estimated);
      }
    }

    var trainCompleted = nextIdx === -1 && stops.length > 0;

    // Update sticky subheader
    updateSubheader();
    recalcPanelTop();

    var html = '';

    // === NEXT STATION CARD ===
    if (trainCompleted) {
      html += '<div class="ft-next-card">'
        + '<div class="ft-next-label">TÅGET HAR ANKOMMIT</div>'
        + '<div class="ft-next-station">' + stationName(d.lastStation) + '</div>'
        + '</div>';
    } else if (nextIdx >= 0) {
      var next = stops[nextIdx];
      var arrTime = next.arrival ? (next.arrival.estimated || next.arrival.planned) : '';
      var depTime = next.departure ? (next.departure.estimated || next.departure.planned) : '';
      var trackStr = next.track || '—';

      var countdownTarget = '';
      var countdownLabel = 'AVGÅNG OM';
      if (arrTime && (!next.arrival || !next.arrival.actual)) {
        countdownTarget = arrTime;
        countdownLabel = 'ANKOMST OM';
      } else if (depTime && (!next.departure || !next.departure.actual)) {
        countdownTarget = depTime;
        countdownLabel = 'AVGÅNG OM';
      }

      var delayHtml = '';
      if (delayMin > 0) {
        delayHtml = '<span class="ft-delay-text ft-delay-' + (delayMin >= 6 ? 'major' : 'minor') + '">+' + delayMin + ' min</span>';
      }

      html += '<div class="ft-next-card">'
        + '<div class="ft-next-label">NÄSTA STATION ' + delayHtml + '</div>'
        + '<div class="ft-next-station">' + stationName(next.station) + '</div>'
        + '<div class="ft-countdown-row" data-target="' + countdownTarget + '">'
        + '<span class="ft-countdown-label">' + countdownLabel + '</span>'
        + '<span class="ft-countdown-value" id="ftCountdown">--:--</span>'
        + '</div>'
        + '<div class="ft-detail-row">'
        + '<div class="ft-track-circle"><span class="ft-track-nr">' + trackStr + '</span><span class="ft-track-label">SPÅR</span></div>'
        + '<div class="ft-times">'
        + (arrTime ? '<div class="ft-time-box"><span class="ft-time-label">ANKOMST</span><span class="ft-time-value">' + arrTime + '</span></div>' : '')
        + (depTime ? '<div class="ft-time-box"><span class="ft-time-label">AVGÅNG</span><span class="ft-time-value">' + depTime + '</span></div>' : '')
        + '</div>'
        + '</div>'
        + '</div>';
    }

    // === UPCOMING STOPS ===
    var upcomingStops = [];
    for (var k = 0; k < stops.length; k++) {
      var s = stops[k];
      var arr = s.arrival ? (s.arrival.actual || s.arrival.estimated || s.arrival.planned) : '';
      var dep = s.departure ? (s.departure.actual || s.departure.estimated || s.departure.planned) : '';
      upcomingStops.push({
        station: stationName(s.station),
        arr: arr,
        dep: dep,
        passed: s.passed,
        isNext: k === nextIdx
      });
    }

    html += '<div class="ft-stops-card">'
      + '<div class="ft-stops-header" id="ftStopsToggle">'
      + '<span>Alla stopp</span>'
      + '<span class="ft-stops-chevron" id="ftStopsChevron">▼</span>'
      + '</div>'
      + '<div class="ft-stops-body" id="ftStopsBody">'
      + '<table class="ft-stops-table"><thead><tr>'
      + '<th>Station</th><th>Ank.</th><th>Avg.</th>'
      + '</tr></thead><tbody>';

    for (var m = 0; m < upcomingStops.length; m++) {
      var st = upcomingStops[m];
      var rowClass = st.passed ? 'ft-stop-passed' : '';
      if (st.isNext) rowClass = 'ft-stop-next';
      var check = st.passed ? '<span class="ft-check">✓</span> ' : '';
      var marker = st.isNext ? '<span class="ft-marker">▶</span> ' : '';
      html += '<tr class="' + rowClass + '">'
        + '<td>' + check + marker + st.station + '</td>'
        + '<td>' + st.arr + '</td>'
        + '<td>' + st.dep + '</td>'
        + '</tr>';
    }

    html += '</tbody></table></div></div>';

    inner.innerHTML = html;

    // Event listeners
    var stopsToggle = document.getElementById('ftStopsToggle');
    if (stopsToggle) {
      stopsToggle.addEventListener('click', function() {
        var body = document.getElementById('ftStopsBody');
        var chevron = document.getElementById('ftStopsChevron');
        if (body) {
          var isOpen = body.classList.toggle('open');
          if (chevron) chevron.textContent = isOpen ? '▲' : '▼';
          // Auto-scroll to next station row when opening
          if (isOpen) {
            scrollToNextStop(body);
          }
        }
      });
    }

    startCountdown();
  }

  // ==========================================
  // AUTO-SCROLL STOPS TABLE
  // ==========================================

  function scrollToNextStop(container) {
    setTimeout(function() {
      var nextRow = container.querySelector('.ft-stop-next');
      if (nextRow) {
        // Scroll so next row is roughly centered
        var rowTop = nextRow.offsetTop - container.offsetTop;
        var containerH = container.clientHeight;
        container.scrollTop = Math.max(0, rowTop - containerH / 3);
      }
    }, 50); // slight delay to let max-height transition start
  }

  // ==========================================
  // COUNTDOWN TIMER
  // ==========================================

  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    updateCountdown();
    countdownTimer = setInterval(updateCountdown, COUNTDOWN_INTERVAL);
  }

  function updateCountdown() {
    var row = document.querySelector('.ft-countdown-row');
    var el = document.getElementById('ftCountdown');
    if (!row || !el) return;

    var target = row.getAttribute('data-target');
    if (!target) { el.textContent = '--:--'; return; }

    var now = new Date();
    var parts = target.split(':');
    var targetDate = new Date();
    targetDate.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);

    var diff = Math.floor((targetDate - now) / 1000);

    if (diff <= 0) {
      el.textContent = 'Nu';
      el.className = 'ft-countdown-value ft-countdown-now';
      return;
    }

    var min = Math.floor(diff / 60);
    var sec = diff % 60;

    if (min > 0) {
      el.textContent = min + ' min ' + (sec < 10 ? '0' : '') + sec + ' sek';
    } else {
      el.textContent = sec + ' sek';
    }

    if (diff <= 60) {
      el.className = 'ft-countdown-value ft-countdown-urgent';
    } else if (diff <= 180) {
      el.className = 'ft-countdown-value ft-countdown-soon';
    } else {
      el.className = 'ft-countdown-value';
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  function calcDelayMin(planned, estimated) {
    if (!planned || !estimated) return 0;
    var pp = planned.split(':');
    var ep = estimated.split(':');
    var pMin = parseInt(pp[0]) * 60 + parseInt(pp[1]);
    var eMin = parseInt(ep[0]) * 60 + parseInt(ep[1]);
    return Math.max(0, eMin - pMin);
  }

  // ==========================================
  // INIT / EXPOSE
  // ==========================================

  function init() {
    followBtn = document.getElementById('followTrainBtn');
    if (!followBtn) return;

    followBtn.addEventListener('click', onButtonClick);

    // Restore from cookie if present
    var saved = readCookie();
    if (saved && /^\d{1,5}$/.test(saved)) {
      startFollowing(saved);
    }
  }

  window.trainFollow = {
    open: function() { openModal(); },
    close: function() { closeModal(); },
    stop: function() { stopFollowing(false); },
    getFollowed: function() { return followedTrain; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
