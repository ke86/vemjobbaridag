/**
 * Train Follow (Följ tåg) — pick a train to track in realtime.
 * Shows next station, countdown, track, arrival/departure times, upcoming stops.
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

  // ==========================================
  // DOM REFS
  // ==========================================
  var followBtn = null;
  var modal = null;
  var inputEl = null;
  var suggestionsEl = null;
  var panelEl = null;

  // ==========================================
  // STATE
  // ==========================================
  var followedTrain = null;    // { trainNr }
  var announcements = [];       // all TrainAnnouncement for followed train
  var pollTimer = null;
  var countdownTimer = null;
  var nextStationData = null;   // computed from announcements

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
      + '<span class="ft-modal-title">🚆 Följ tåg</span>'
      + '<button class="ft-modal-close" id="ftModalClose">×</button>'
      + '</div>'
      + '<div class="ft-modal-body">'
      + '<label class="ft-label" for="ftTrainInput">Ange tågnummer</label>'
      + '<input class="ft-input" type="text" id="ftTrainInput" inputmode="numeric" pattern="[0-9]*" placeholder="T.ex. 1071" autocomplete="off">'
      + '<div class="ft-suggestions" id="ftSuggestions"></div>'
      + '</div>'
      + '<div class="ft-modal-footer">'
      + '<button class="ft-btn ft-btn-cancel" id="ftBtnCancel">Avbryt</button>'
      + '<button class="ft-btn ft-btn-follow" id="ftBtnFollow">Följ</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(div);

    modal = div;
    inputEl = document.getElementById('ftTrainInput');
    suggestionsEl = document.getElementById('ftSuggestions');

    document.getElementById('ftModalClose').addEventListener('click', closeModal);
    document.getElementById('ftBtnCancel').addEventListener('click', closeModal);
    document.getElementById('ftBtnFollow').addEventListener('click', onFollowClick);
    div.addEventListener('click', function(e) {
      if (e.target === div) closeModal();
    });

    inputEl.addEventListener('input', onInputChange);
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
    suggestionsEl.innerHTML = '';
    buildSuggestions('');
    setTimeout(function() { inputEl.focus(); }, 100);
  }

  function closeModal() {
    if (modal) modal.classList.remove('active');
  }

  // ==========================================
  // SUGGESTIONS FROM DAGVY
  // ==========================================

  function collectTodaysTrains() {
    var trains = [];
    var seen = {};
    if (typeof dagvyAllData === 'undefined' || typeof getDateKey === 'undefined' || typeof currentDate === 'undefined') return trains;

    var dateKey = getDateKey(currentDate);
    for (var name in dagvyAllData) {
      var doc = dagvyAllData[name];
      if (!doc || !doc.days) continue;
      var dayData = null;
      for (var i = 0; i < doc.days.length; i++) {
        if (doc.days[i].date === dateKey) { dayData = doc.days[i]; break; }
      }
      if (!dayData || !dayData.segments) continue;

      for (var j = 0; j < dayData.segments.length; j++) {
        var seg = dayData.segments[j];
        var trainNr = null;
        if (seg.trainNr && seg.trainNr.length > 0) {
          trainNr = seg.trainNr.replace(/\s.*/g, '').trim();
        } else if (seg.activity && /^\d{3,5}(\s+\S+)*$/i.test((seg.activity || '').trim())) {
          trainNr = (seg.activity || '').trim().replace(/\s.*/g, '').trim();
        }
        if (trainNr && !seen[trainNr]) {
          seen[trainNr] = true;
          var route = '';
          if (seg.fromStation && seg.toStation && seg.fromStation !== seg.toStation) {
            route = seg.fromStation + ' → ' + seg.toStation;
          }
          trains.push({ trainNr: trainNr, route: route, time: seg.timeStart || '' });
        }
      }
    }
    trains.sort(function(a, b) { return a.trainNr.localeCompare(b.trainNr, undefined, { numeric: true }); });
    return trains;
  }

  function buildSuggestions(filter) {
    var trains = collectTodaysTrains();
    var filterLower = (filter || '').trim();

    var filtered = trains;
    if (filterLower.length > 0) {
      filtered = trains.filter(function(t) { return t.trainNr.indexOf(filterLower) !== -1; });
    }

    if (filtered.length === 0) {
      suggestionsEl.innerHTML = filterLower.length > 0
        ? '<div class="ft-suggestion-empty">Inga tåg matchar</div>'
        : '<div class="ft-suggestion-empty">Inga tåg hittades i dagvy</div>';
      return;
    }

    suggestionsEl.innerHTML = filtered.slice(0, 8).map(function(t) {
      var routeHtml = t.route ? '<span class="ft-sug-route">' + t.route + '</span>' : '';
      return '<button class="ft-suggestion" data-train="' + t.trainNr + '">'
        + '<span class="ft-sug-nr">' + t.trainNr + '</span>'
        + routeHtml
        + '</button>';
    }).join('');

    var btns = suggestionsEl.querySelectorAll('.ft-suggestion');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function() {
        inputEl.value = this.getAttribute('data-train');
        buildSuggestions(this.getAttribute('data-train'));
      });
    }
  }

  function onInputChange() {
    buildSuggestions(inputEl.value);
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
    stopFollowing(true); // stop previous without removing panel yet
    followedTrain = { trainNr: trainNr };
    followBtn.classList.add('following');
    followBtn.textContent = '🚆 ' + trainNr;
    announcements = [];
    nextStationData = null;

    // Create or show panel
    createPanel();
    showPanelLoading();

    // Fetch immediately then poll
    fetchAndRender();
    pollTimer = setInterval(fetchAndRender, POLL_INTERVAL);
  }

  function stopFollowing(keepPanel) {
    followedTrain = null;
    announcements = [];
    nextStationData = null;

    if (followBtn) {
      followBtn.classList.remove('following');
      followBtn.textContent = '🚆 Följ tåg';
    }

    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

    if (!keepPanel && panelEl) {
      panelEl.classList.remove('active');
    }
  }

  // ==========================================
  // PANEL CREATION
  // ==========================================

  function createPanel() {
    if (panelEl) { panelEl.classList.add('active'); return; }

    var div = document.createElement('div');
    div.id = 'ftPanel';
    div.className = 'ft-panel active';
    div.innerHTML = '<div class="ft-panel-inner" id="ftPanelInner"></div>';

    // Insert after header
    var header = document.querySelector('.header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(div, header.nextSibling);
    } else {
      document.body.appendChild(div);
    }
    panelEl = div;
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
    // Group by location into stops
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
        if (actual) stop.passed = true; // arrived = passed
      } else if (a.ActivityType === 'Avgang') {
        stop.departure = timeObj;
        if (actual) stop.passed = true; // departed = definitely passed
      }
    }

    // Build ordered stops list
    var stops = stopsOrder.map(function(loc) { return stopsMap[loc]; });

    // Determine route (first and last station)
    var firstStation = stops.length > 0 ? stops[0].station : '';
    var lastStation = stops.length > 0 ? stops[stops.length - 1].station : '';

    // Find next station (first non-passed)
    var nextIdx = -1;
    for (var j = 0; j < stops.length; j++) {
      if (!stops[j].passed) { nextIdx = j; break; }
    }

    // Get product info from first announcement
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
    var trainNr = d.trainNr;
    var route = stationName(d.firstStation) + ' → ' + stationName(d.lastStation);
    var stops = d.stops;
    var nextIdx = d.nextIdx;

    // Determine delay status
    var statusClass = 'ft-status-ok';
    var delayMin = 0;
    if (nextIdx >= 0 && stops[nextIdx]) {
      var ns = stops[nextIdx];
      var timeInfo = ns.arrival || ns.departure;
      if (timeInfo && timeInfo.estimated && timeInfo.planned) {
        delayMin = calcDelayMin(timeInfo.planned, timeInfo.estimated);
        if (delayMin >= 6) statusClass = 'ft-status-major';
        else if (delayMin >= 1) statusClass = 'ft-status-minor';
      }
    }

    // Check if train completed route
    var trainCompleted = nextIdx === -1 && stops.length > 0;

    // === TOP BAR ===
    var html = '<div class="ft-topbar">'
      + '<div class="ft-topbar-left">'
      + '<span class="ft-train-badge ' + statusClass + '">' + trainNr + '</span>'
      + (d.product ? '<span class="ft-product">' + d.product + '</span>' : '')
      + '</div>'
      + '<div class="ft-topbar-right">'
      + '<span class="ft-route">' + route + '</span>'
      + '<button class="ft-close-btn" id="ftClosePanel">✕</button>'
      + '</div>'
      + '</div>';

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

      // Countdown target = arrival or departure
      var countdownTarget = '';
      var countdownLabel = 'AVGÅNG OM';
      if (arrTime && (!next.arrival || !next.arrival.actual)) {
        countdownTarget = arrTime;
        countdownLabel = 'ANKOMST OM';
      } else if (depTime && (!next.departure || !next.departure.actual)) {
        countdownTarget = depTime;
        countdownLabel = 'AVGÅNG OM';
      }

      // Show delay text
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
    document.getElementById('ftClosePanel').addEventListener('click', function() {
      stopFollowing(false);
    });

    var stopsToggle = document.getElementById('ftStopsToggle');
    if (stopsToggle) {
      stopsToggle.addEventListener('click', function() {
        var body = document.getElementById('ftStopsBody');
        var chevron = document.getElementById('ftStopsChevron');
        if (body) {
          var isOpen = body.classList.toggle('open');
          if (chevron) chevron.textContent = isOpen ? '▲' : '▼';
        }
      });
    }

    // Start countdown
    startCountdown();
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

    // Color based on urgency
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

    followBtn.addEventListener('click', function() {
      openModal();
    });
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
