/**
 * Train Follow (Följ tåg) — pick a train to track in realtime.
 * Uses the app's page system (showPage('trainFollow')) — no overlays or fixed positioning.
 *
 * Persistence: cookie-based (per-device, valid until midnight).
 */

/* global showPage, trainRealtimeStore */

(function() {
  'use strict';

  // ==========================================
  // CONFIG
  // ==========================================
  var API_KEY = 'dbd424f3abd74e19be0b4f18009c4000';
  var PROXY_URL = 'https://trafikverket-proxy.kenny-eriksson1986.workers.dev';
  var POLL_INTERVAL = 30000;
  var COUNTDOWN_INTERVAL = 1000;
  var COOKIE_NAME = 'ft_train';

  // ==========================================
  // DOM REFS  (resolved in init)
  // ==========================================
  var followBtn = null;
  var modal = null;
  var inputEl = null;
  var topbarEl = null;   // #ftPageTopbar
  var contentEl = null;  // #ftPageContent

  // ==========================================
  // STATE
  // ==========================================
  var followedTrain = null;
  var announcements = [];
  var pollTimer = null;
  var countdownTimer = null;
  var btnFlipTimer = null;
  var btnFlipShowingDelay = false;
  var nextStationData = null;
  var pageActive = false;
  var currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
  var originDepartureTarget = null; // HH:MM string when waiting at origin
  var dkStopsCache = {};            // trainNr → { ts, data }
  var DK_CACHE_TTL = 60000;         // 1 min
  var dkStopsData = null;           // latest getDkStopsAsync() result for current train

  // ==========================================
  // REJSEPLANEN DK STOPS  (two-step: departureBoard → journeyDetail)
  // ==========================================

  var REJSE_BASE = 'https://www.rejseplanen.dk/api';
  var REJSE_KEY  = '91f18a75-699b-4901-aa3e-eb7d52d0a034';
  // All DK stations where Öresundståg can appear
  var REJSE_SCAN_STATIONS = [
    { id: '8600650', name: 'Østerport' },
    { id: '8600646', name: 'Nørreport' },
    { id: '8600626', name: 'København H' },
    { id: '8600858', name: 'CPH Lufthavn' },
    { id: '8600857', name: 'Tårnby' },
    { id: '8600856', name: 'Ørestad' }
  ];

  /**
   * Format Rejseplanen time string "HH:MM:SS" or "HH:MM" → "HH:MM"
   */
  function fmtDkTime(t) {
    if (!t) return '';
    return t.substring(0, 5);
  }

  /**
   * Calculate delay in minutes between planned "HH:MM" and realtime "HH:MM".
   * Returns positive number for delays, 0 for on-time / negative.
   */
  function dkStopDelay(planned, realtime) {
    if (!planned || !realtime) return 0;
    var pp = planned.split(':');
    var rp = realtime.split(':');
    var pMin = parseInt(pp[0]) * 60 + parseInt(pp[1]);
    var rMin = parseInt(rp[0]) * 60 + parseInt(rp[1]);
    return Math.max(0, rMin - pMin);
  }

  /**
   * Two-step Rejseplanen fetch:
   *  1) departureBoard for each scan station → find matching train → get JourneyDetailRef
   *  2) journeyDetail with that ref → full stop list with realtime data
   *
   * Returns array of stop objects or null on failure:
   *   { name, extId, depTime, arrTime, rtDepTime, rtArrTime, depTrack, rtDepTrack, prognosisType }
   */
  async function fetchDkStopsFromRejseplanen(trainNr) {
    var targetNr = String(trainNr);

    // Step 1 — scan departure boards to find JourneyDetailRef
    var ref = null;
    for (var si = 0; si < REJSE_SCAN_STATIONS.length; si++) {
      var station = REJSE_SCAN_STATIONS[si];
      try {
        var dbUrl = REJSE_BASE + '/departureBoard?id=' + station.id
          + '&format=json&accessId=' + REJSE_KEY;
        var dbResp = await fetch(dbUrl);
        if (!dbResp.ok) continue;
        var dbData = await dbResp.json();
        var deps = dbData.DepartureBoard ? dbData.DepartureBoard.Departure : (dbData.Departure || []);
        if (!Array.isArray(deps)) deps = [deps];

        for (var di = 0; di < deps.length; di++) {
          var item = deps[di];
          var num = String(item.displayNumber || item.num || '');
          if (!num && item.name) {
            var m = item.name.match(/\d+/);
            if (m) num = m[0];
          }
          if (num === targetNr && item.JourneyDetailRef && item.JourneyDetailRef.ref) {
            ref = item.JourneyDetailRef.ref;
            break;
          }
        }
      } catch (e) {
        // ignore, try next station
      }
      if (ref) break;
    }

    if (!ref) return null;

    // Step 2 — fetch full journey detail
    try {
      var jdUrl = REJSE_BASE + '/journeyDetail?id=' + encodeURIComponent(ref)
        + '&format=json&accessId=' + REJSE_KEY;
      var jdResp = await fetch(jdUrl);
      if (!jdResp.ok) return null;
      var jdData = await jdResp.json();

      var stops = null;
      if (jdData.JourneyDetail && jdData.JourneyDetail.Stop) {
        stops = jdData.JourneyDetail.Stop;
      } else if (jdData.Stop) {
        stops = jdData.Stop;
      }
      if (!stops || !Array.isArray(stops)) return null;

      // Debug: log raw first stop to see actual field names from API
      if (stops.length > 0) {
        console.log('[DK-track debug] Raw stop keys: ' + Object.keys(stops[0]).join(', '));
        console.log('[DK-track debug] First stop: ' + JSON.stringify(stops[0]));
      }

      // Map to our normalized format
      // Rejseplanen journeyDetail uses "track"/"rtTrack" as primary field names
      var result = [];
      for (var i = 0; i < stops.length; i++) {
        var s = stops[i];
        var trackVal = s.track || s.depTrack || s.arrTrack || '';
        var rtTrackVal = s.rtTrack || s.rtDepTrack || s.rtArrTrack || '';
        result.push({
          name:           s.name || '',
          extId:          s.extId || s.id || '',
          depTime:        fmtDkTime(s.depTime),
          arrTime:        fmtDkTime(s.arrTime),
          rtDepTime:      fmtDkTime(s.rtDepTime),
          rtArrTime:      fmtDkTime(s.rtArrTime),
          depTrack:       trackVal,
          rtDepTrack:     rtTrackVal,
          arrTrack:       trackVal,
          rtArrTrack:     rtTrackVal,
          prognosisType:  s.depPrognosisType || s.arrPrognosisType || ''
        });
      }
      return result.length > 0 ? result : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Cache-wrapper: returns Rejseplanen DK stops (async), falls back to static denmark.js.
   * Returns { source: 'live'|'static', stops: [...] } or null.
   */
  async function getDkStopsAsync(trainNr) {
    if (!trainNr) return null;
    var key = String(trainNr);
    var now = Date.now();

    // Check cache
    if (dkStopsCache[key] && (now - dkStopsCache[key].ts) < DK_CACHE_TTL) {
      return dkStopsCache[key].data;
    }

    // Try Rejseplanen
    var liveStops = await fetchDkStopsFromRejseplanen(key);
    if (liveStops && liveStops.length > 0) {
      var liveResult = { source: 'live', stops: liveStops };
      dkStopsCache[key] = { ts: now, data: liveResult };
      return liveResult;
    }

    // Fallback to static denmark.js
    if (typeof denmark !== 'undefined') {
      var dkInfo = denmark.getDanishStops(key);
      if (dkInfo && dkInfo.stops && dkInfo.stops.length > 0) {
        // Convert static stops to same shape for consistency
        var staticStops = [];
        for (var i = 0; i < dkInfo.stops.length; i++) {
          var st = dkInfo.stops[i];
          if (!st.pax) continue; // only passenger stops
          staticStops.push({
            name:           st.name || '',
            extId:          '',
            depTime:        st.dep || '',
            arrTime:        st.arr || '',
            rtDepTime:      '',
            rtArrTime:      '',
            depTrack:       '',
            rtDepTrack:     '',
            arrTrack:       '',
            rtArrTrack:     '',
            prognosisType:  ''
          });
        }
        var staticResult = { source: 'static', stops: staticStops, direction: dkInfo.direction, route: dkInfo.route };
        dkStopsCache[key] = { ts: now, data: staticResult };
        return staticResult;
      }
    }

    return null;
  }

  // ==========================================
  // STATION NAME MAP
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
  // COOKIE HELPERS
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
  // MODAL
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
  // HEADER BUTTON
  // ==========================================

  function onButtonClick() {
    if (!followedTrain) {
      openModal();
    } else {
      // Navigate to the train follow page
      showPage('trainFollow');
    }
  }

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

  // ==========================================
  // FOLLOW / STOP
  // ==========================================

  function startFollowing(trainNr) {
    stopFollowing(true);
    followedTrain = { trainNr: trainNr };
    currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
    updateButton();
    saveCookie(trainNr);

    announcements = [];
    nextStationData = null;

    startBtnFlipTimer();

    // Navigate to train page & show loading
    showPage('trainFollow');
    showLoading();

    // Fetch immediately then poll
    fetchAndRender();
    pollTimer = setInterval(fetchAndRender, POLL_INTERVAL);
  }

  function stopFollowing(keepPage) {
    followedTrain = null;
    announcements = [];
    nextStationData = null;
    dkStopsData = null;
    currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
    clearCookie();
    stopBtnFlipTimer();
    updateButton();

    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

    if (!keepPage) {
      showPage('schedule');
    }
  }

  function updateButton() {
    if (!followBtn) return;
    followBtn.classList.remove('following', 'ft-btn-ontime', 'ft-btn-minor', 'ft-btn-major');

    if (followedTrain) {
      followBtn.classList.add('following');
      applyBtnDelayClass();
      if (btnFlipShowingDelay) {
        // If waiting at origin, show countdown instead of "I tid"
        if (originDepartureTarget) {
          followBtn.textContent = getOriginCountdownText();
        } else {
          followBtn.textContent = currentDelayInfo.delayText;
        }
      } else {
        followBtn.textContent = 'Tåg ' + followedTrain.trainNr;
      }
    } else {
      followBtn.textContent = 'Följ tåg';
    }
  }

  /**
   * Compute a short countdown text for the header button when at origin.
   */
  function getOriginCountdownText() {
    if (!originDepartureTarget) return 'I tid';
    var parts = originDepartureTarget.split(':');
    var now = new Date();
    var target = new Date();
    target.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
    var diff = Math.floor((target - now) / 1000);
    if (diff <= 0) return 'Avgår nu';
    var min = Math.floor(diff / 60);
    var sec = diff % 60;
    var mm = (min < 10 ? '0' : '') + min;
    var ss = (sec < 10 ? '0' : '') + sec;
    return 'Avg. ' + mm + ':' + ss;
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

  // ==========================================
  // DELAY COMPUTATION
  // ==========================================

  function computeDelayInfo() {
    if (!followedTrain) return;
    var trainNr = followedTrain.trainNr;

    if (typeof trainRealtimeStore !== 'undefined' && trainRealtimeStore[trainNr]) {
      var info = trainRealtimeStore[trainNr];
      currentDelayInfo = {
        status: info.status || 'ontime',
        delayText: info.delayText || 'I tid',
        delayMin: info.delayMin || 0
      };
      return;
    }

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
  // BUTTON FLIP TIMER
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
  // PAGE RENDERING  (uses #ftPageTopbar + #ftPageContent)
  // ==========================================

  function showLoading() {
    if (!contentEl) return;
    contentEl.innerHTML =
      '<div class="ft-loading">'
      + '<div class="ft-loading-spinner"></div>'
      + '<span>Hämtar tågdata...</span>'
      + '</div>';
  }

  function updateTopbar() {
    if (!topbarEl || !followedTrain) return;

    var trainNr = followedTrain.trainNr;
    var route = '';
    if (nextStationData) {
      var first = stationName(nextStationData.firstStation);
      var last = stationName(nextStationData.lastStation);

      // Extend route with Danish stops — prefer live Rejseplanen data
      if (dkStopsData && dkStopsData.stops && dkStopsData.stops.length > 0) {
        var dkDir = dkStopsData.direction || _inferDkDirection(dkStopsData.stops);
        var dkFirst = dkStopsData.stops[0];
        var dkLast = dkStopsData.stops[dkStopsData.stops.length - 1];
        if (dkDir === 'toDK') {
          last = dkLast.name;
        } else {
          first = dkFirst.name;
        }
      } else if (typeof denmark !== 'undefined') {
        var dkInfo = denmark.getDanishStops(trainNr);
        if (dkInfo && dkInfo.stops.length > 0) {
          if (dkInfo.direction === 'toDK') {
            var dkLastSt = dkInfo.stops[dkInfo.stops.length - 1];
            if (dkLastSt.pax) last = dkLastSt.name;
          } else {
            var dkFirstSt = dkInfo.stops[0];
            if (dkFirstSt.pax) first = dkFirstSt.name;
          }
        }
      }

      route = first + ' → ' + last;
    }

    var statusClass = 'ft-status-ok';
    if (currentDelayInfo.status === 'major') statusClass = 'ft-status-major';
    else if (currentDelayInfo.status === 'minor') statusClass = 'ft-status-minor';

    topbarEl.innerHTML =
      '<div class="ft-topbar-left">'
      + '<span class="ft-train-badge ' + statusClass + '">' + trainNr + '</span>'
      + '<span class="ft-route">' + route + '</span>'
      + '</div>'
      + '<div class="ft-topbar-right">'
      + '<button class="ft-stop-follow-btn" id="ftStopFollow">Sluta följa</button>'
      + '<button class="ft-close-btn" id="ftClosePanel" title="Tillbaka">✕</button>'
      + '</div>';

    document.getElementById('ftClosePanel').addEventListener('click', function() {
      showPage('schedule');
    });
    document.getElementById('ftStopFollow').addEventListener('click', function() {
      stopFollowing(false);
    });
  }

  /**
   * Infer direction from live Rejseplanen stops by checking if SE border
   * station (Ørestad/Tårnby/CPH) comes first (toSE) or last (toDK).
   */
  function _inferDkDirection(stops) {
    if (!stops || !stops.length) return 'toDK';
    var borderIds = ['8600858', '8600857', '8600856']; // CPH, Tårnby, Ørestad
    var firstBorder = -1;
    var lastBorder = -1;
    for (var i = 0; i < stops.length; i++) {
      if (borderIds.indexOf(stops[i].extId) !== -1) {
        if (firstBorder === -1) firstBorder = i;
        lastBorder = i;
      }
    }
    // If border station is in the first half → toSE, otherwise toDK
    if (firstBorder === -1) return 'toDK';
    return firstBorder < stops.length / 2 ? 'toSE' : 'toDK';
  }

  /**
   * Compute DK tracking state based on current time vs timetable.
   * Uses live Rejseplanen data (dkStopsData) if available, else static denmark.js.
   * Returns { phase, direction, stops[], nextIdx, route, source } or null.
   * phase: 'beforeDeparture' | 'enRoute' | 'allPassed'
   * Each stop gets ._passed, ._isNext, and optional realtime fields.
   */
  function getDkTrackingState(trainNr) {
    if (!trainNr) return null;

    function timeToMin(t) {
      if (!t) return -1;
      var p = t.split(':');
      return parseInt(p[0]) * 60 + parseInt(p[1]);
    }

    var now = new Date();
    var nowTotal = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    var paxStops = [];
    var direction = 'toDK';
    var route = '';
    var source = 'static';

    // === Try live Rejseplanen data first ===
    if (dkStopsData && dkStopsData.stops && dkStopsData.stops.length > 0) {
      source = dkStopsData.source || 'live';
      direction = dkStopsData.direction || _inferDkDirection(dkStopsData.stops);
      var dkS = dkStopsData.stops;
      route = dkS[0].name + ' → ' + dkS[dkS.length - 1].name;

      for (var i = 0; i < dkS.length; i++) {
        var ls = dkS[i];
        // Use realtime times if available, otherwise planned
        var dep = ls.rtDepTime || ls.depTime || '';
        var arr = ls.rtArrTime || ls.arrTime || '';
        paxStops.push({
          name:       ls.name,
          dep:        dep,
          arr:        arr,
          depPlanned: ls.depTime || '',
          arrPlanned: ls.arrTime || '',
          rtDep:      ls.rtDepTime || '',
          rtArr:      ls.rtArrTime || '',
          track:      ls.rtDepTrack || ls.depTrack || ls.rtArrTrack || ls.arrTrack || '',
          prognosis:  ls.prognosisType || '',
          _passed:    false,
          _isNext:    false,
          _isLive:    source === 'live'
        });
      }
    }
    // === Fallback to static denmark.js ===
    else if (typeof denmark !== 'undefined') {
      var dkInfo = denmark.getDanishStops(trainNr);
      if (!dkInfo || !dkInfo.stops.length) return null;
      direction = dkInfo.direction;
      route = dkInfo.route;

      for (var j = 0; j < dkInfo.stops.length; j++) {
        if (dkInfo.stops[j].pax) {
          var st = dkInfo.stops[j];
          paxStops.push({
            name:       st.name,
            dep:        st.dep || '',
            arr:        st.arr || '',
            depPlanned: st.dep || '',
            arrPlanned: st.arr || '',
            rtDep:      '',
            rtArr:      '',
            track:      '',
            prognosis:  '',
            _passed:    false,
            _isNext:    false,
            _isLive:    false
          });
        }
      }
    } else {
      return null;
    }

    if (!paxStops.length) return null;

    // Three-phase tracking with 30s hold after departure
    var HOLD_MIN = 0.5; // 30 seconds in minutes
    var nextIdx = -1;

    for (var k = 0; k < paxStops.length; k++) {
      var depM = timeToMin(paxStops[k].dep);
      var arrM = timeToMin(paxStops[k].arr);
      var isLast = (k === paxStops.length - 1);
      var isFirst = (k === 0);

      if (isFirst && !paxStops[k].arr) {
        // First stop — only departure
        if (depM >= 0 && nowTotal < depM) {
          paxStops[k]._phase = 'approaching';
        } else if (depM >= 0 && nowTotal < depM + HOLD_MIN) {
          paxStops[k]._phase = 'departed';
        } else if (depM >= 0) {
          paxStops[k]._phase = 'passed';
          paxStops[k]._passed = true;
        } else {
          paxStops[k]._phase = 'approaching';
        }
      } else if (isLast && !paxStops[k].dep) {
        // Last stop — only arrival
        if (arrM >= 0 && nowTotal < arrM) {
          paxStops[k]._phase = 'approaching';
        } else if (arrM >= 0) {
          paxStops[k]._phase = 'passed';
          paxStops[k]._passed = true;
        } else {
          paxStops[k]._phase = 'approaching';
        }
      } else if (arrM >= 0 && depM >= 0) {
        // Mid stop — has both arrival and departure
        if (nowTotal < arrM) {
          paxStops[k]._phase = 'approaching';
        } else if (nowTotal < depM) {
          paxStops[k]._phase = 'atStation';
        } else if (nowTotal < depM + HOLD_MIN) {
          paxStops[k]._phase = 'departed';
        } else {
          paxStops[k]._phase = 'passed';
          paxStops[k]._passed = true;
        }
      } else {
        // Fallback — use whichever time exists
        var t = depM >= 0 ? depM : arrM;
        if (t >= 0 && nowTotal >= t + HOLD_MIN) {
          paxStops[k]._phase = 'passed';
          paxStops[k]._passed = true;
        } else if (t >= 0 && nowTotal >= t) {
          paxStops[k]._phase = 'departed';
        } else {
          paxStops[k]._phase = 'approaching';
        }
      }

      // First non-passed stop becomes nextIdx
      if (!paxStops[k]._passed && nextIdx === -1) {
        nextIdx = k;
        paxStops[k]._isNext = true;
      }
    }

    var phase;
    if (nextIdx === -1) {
      phase = 'allPassed';
    } else if (nextIdx === 0 && (paxStops[0]._phase === 'approaching')) {
      phase = 'beforeDeparture';
    } else {
      phase = 'enRoute';
    }

    return {
      phase: phase,
      direction: direction,
      stops: paxStops,
      nextIdx: nextIdx,
      route: route,
      source: source
    };
  }

  /**
   * Build the DK "next station" card HTML based on tracking state.
   * Uses per-stop _phase: approaching, atStation, departed.
   * Shows realtime delay, track, and LIVE badge when live data is available.
   */
  function buildDkNextCard(dkState) {
    var html = '';
    var stop = dkState.stops[dkState.nextIdx];
    if (!stop) return html;

    var stopPhase = stop._phase || 'approaching';
    var liveBadge = stop._isLive ? '<span class="ft-dk-live">LIVE</span>' : '';
    var trackHtml = '';
    if (stop.track) {
      trackHtml = '<div class="ft-track-circle"><span class="ft-track-nr">' + stop.track + '</span><span class="ft-track-label">SPÅR</span></div>';
    }

    // Delay calculation for DK stop
    var dkDelay = 0;
    if (stop.rtArr && stop.arrPlanned) {
      dkDelay = dkStopDelay(stop.arrPlanned, stop.rtArr);
    } else if (stop.rtDep && stop.depPlanned) {
      dkDelay = dkStopDelay(stop.depPlanned, stop.rtDep);
    }
    var delayHtml = '';
    if (dkDelay > 0) {
      delayHtml = '<span class="ft-delay-text ' + (dkDelay >= 6 ? 'ft-delay-major' : 'ft-delay-minor') + '">+' + dkDelay + ' min</span>';
    }

    // Time display helpers: show realtime with planned struck through if different
    function timeVal(planned, rt) {
      if (rt && planned && rt !== planned) {
        return '<span class="ft-dk-planned">' + planned + '</span> <span class="ft-dk-rt">' + rt + '</span>';
      }
      return planned || rt || '';
    }

    var arrDisplay = timeVal(stop.arrPlanned, stop.rtArr);
    var depDisplay = timeVal(stop.depPlanned, stop.rtDep);

    if (stopPhase === 'departed') {
      // === AVGÅTT — count up from departure time ===
      html += '<div class="ft-next-card ft-card-departed">'
        + '<div class="ft-next-label">AVGÅTT FRÅN <span class="ft-dk-badge">🇩🇰</span> ' + liveBadge + '</div>'
        + '<div class="ft-next-station">' + stop.name + '</div>'
        + '<div class="ft-countdown-row" data-target="' + stop.dep + '" data-direction="up">'
        + '<span class="ft-countdown-label">AVGICK FÖR</span>'
        + '<span class="ft-countdown-value" id="ftCountdown">0:00</span>'
        + '</div>'
        + '<div class="ft-detail-row">'
        + trackHtml
        + '<div class="ft-times">'
        + (stop.dep ? '<div class="ft-time-box"><span class="ft-time-label">AVGÅNG</span><span class="ft-time-value">' + depDisplay + '</span></div>' : '')
        + '</div>'
        + '</div>'
        + '</div>';
    } else if (stopPhase === 'atStation') {
      // === VID STATION — countdown to departure ===
      originDepartureTarget = stop.dep;
      html += '<div class="ft-next-card ft-card-atstation">'
        + '<div class="ft-next-label">VID STATION <span class="ft-dk-badge">🇩🇰</span> ' + liveBadge + ' ' + delayHtml + '</div>'
        + '<div class="ft-next-station">' + stop.name + '</div>'
        + '<div class="ft-countdown-row" data-target="' + stop.dep + '">'
        + '<span class="ft-countdown-label">AVGÅNG OM</span>'
        + '<span class="ft-countdown-value" id="ftCountdown">--:--</span>'
        + '</div>'
        + '<div class="ft-detail-row">'
        + trackHtml
        + '<div class="ft-times">'
        + (stop.arr ? '<div class="ft-time-box"><span class="ft-time-label">ANKOMST</span><span class="ft-time-value">' + arrDisplay + '</span></div>' : '')
        + (stop.dep ? '<div class="ft-time-box"><span class="ft-time-label">AVGÅNG</span><span class="ft-time-value">' + depDisplay + '</span></div>' : '')
        + '</div>'
        + '</div>'
        + '</div>';
    } else if (dkState.phase === 'beforeDeparture') {
      // Check if this is truly origin (toDK = coming from SE, so first DK stop is arrival, not origin)
      if (dkState.direction === 'toDK') {
        // === ARRIVING at first DK stop (not origin) — countdown to arrival ===
        var arrTarget = stop.arr || stop.dep || '';
        var arrLabel = stop.arr ? 'ANKOMST OM' : 'AVGÅNG OM';
        html += '<div class="ft-next-card">'
          + '<div class="ft-next-label">NÄSTA STATION <span class="ft-dk-badge">🇩🇰</span> ' + liveBadge + ' ' + delayHtml + '</div>'
          + '<div class="ft-next-station">' + stop.name + '</div>'
          + '<div class="ft-countdown-row" data-target="' + arrTarget + '">'
          + '<span class="ft-countdown-label">' + arrLabel + '</span>'
          + '<span class="ft-countdown-value" id="ftCountdown">--:--</span>'
          + '</div>'
          + '<div class="ft-detail-row">'
          + trackHtml
          + '<div class="ft-times">'
          + (stop.arr ? '<div class="ft-time-box"><span class="ft-time-label">ANKOMST</span><span class="ft-time-value">' + arrDisplay + '</span></div>' : '')
          + (stop.dep ? '<div class="ft-time-box"><span class="ft-time-label">AVGÅNG</span><span class="ft-time-value">' + depDisplay + '</span></div>' : '')
          + '</div>'
          + '</div>'
          + '</div>';
      } else {
        // === TRUE ORIGIN (toSE) — countdown to departure ===
        originDepartureTarget = stop.dep;
        html += '<div class="ft-next-card">'
          + '<div class="ft-next-label">AVGÅNG FRÅN ' + liveBadge + '</div>'
          + '<div class="ft-next-station">' + stop.name + '</div>'
          + '<div class="ft-countdown-row" data-target="' + stop.dep + '">'
          + '<span class="ft-countdown-label">AVGÅNG OM</span>'
          + '<span class="ft-countdown-value" id="ftCountdown">--:--</span>'
          + '</div>'
          + '<div class="ft-detail-row">'
          + trackHtml
          + '<div class="ft-times">'
          + '<div class="ft-time-box"><span class="ft-time-label">AVGÅNG</span><span class="ft-time-value">' + depDisplay + '</span></div>'
          + '</div>'
          + '</div>'
          + '</div>';
      }
    } else {
      // === APPROACHING — countdown to arrival ===
      var countdownTarget = stop.arr || stop.dep || '';
      var countdownLabel = stop.arr ? 'ANKOMST OM' : 'AVGÅNG OM';
      html += '<div class="ft-next-card">'
        + '<div class="ft-next-label">NÄSTA STATION <span class="ft-dk-badge">🇩🇰</span> ' + liveBadge + ' ' + delayHtml + '</div>'
        + '<div class="ft-next-station">' + stop.name + '</div>'
        + '<div class="ft-countdown-row" data-target="' + countdownTarget + '">'
        + '<span class="ft-countdown-label">' + countdownLabel + '</span>'
        + '<span class="ft-countdown-value" id="ftCountdown">--:--</span>'
        + '</div>'
        + '<div class="ft-detail-row">'
        + trackHtml
        + '<div class="ft-times">'
        + (stop.arr ? '<div class="ft-time-box"><span class="ft-time-label">ANKOMST</span><span class="ft-time-value">' + arrDisplay + '</span></div>' : '')
        + (stop.dep ? '<div class="ft-time-box"><span class="ft-time-label">AVGÅNG</span><span class="ft-time-value">' + depDisplay + '</span></div>' : '')
        + '</div>'
        + '</div>'
        + '</div>';
    }
    return html;
  }

  function renderPage() {
    if (!contentEl) return;

    // Reset origin departure target (will be set if at origin)
    originDepartureTarget = null;

    // Get DK tracking state (used in multiple branches)
    var dkState = followedTrain ? getDkTrackingState(followedTrain.trainNr) : null;

    // If no API data yet, use DK timetable tracking
    if (!nextStationData || nextStationData.stops.length === 0) {
      updateTopbar();

      if (dkState && dkState.stops.length > 0) {
        var html = '';

        if (dkState.phase === 'allPassed') {
          // All DK stops passed, waiting for Swedish data
          html += '<div class="ft-next-card">'
            + '<div class="ft-next-label">PÅ VÄG MOT SVERIGE <span class="ft-dk-badge">🇩🇰→🇸🇪</span></div>'
            + '<div class="ft-next-station">Väntar på tågdata...</div>'
            + '</div>';
        } else {
          html += buildDkNextCard(dkState);
        }

        // Stops list — check if track data exists
        var earlyHasTrack = false;
        for (var eti = 0; eti < dkState.stops.length; eti++) {
          if (dkState.stops[eti].track) { earlyHasTrack = true; break; }
        }
        var earlyColSpan = earlyHasTrack ? '4' : '3';
        var earlyLive = dkState.source === 'live' ? ' <span class="ft-dk-live">LIVE</span>' : '';
        html += '<div class="ft-stops-card">'
          + '<table class="ft-stops-table"><thead><tr>'
          + '<th>Station</th><th>Ank.</th><th>Avg.</th>'
          + (earlyHasTrack ? '<th>Spår</th>' : '')
          + '</tr></thead><tbody>';
        html += '<tr class="ft-dk-separator"><td colspan="' + earlyColSpan + '">🇩🇰 Danmark' + earlyLive + '</td></tr>';
        for (var dj = 0; dj < dkState.stops.length; dj++) {
          var ds = dkState.stops[dj];
          var dkRowClass = ds._passed ? 'ft-stop-passed ft-dk-stop' : (ds._isNext ? 'ft-stop-next ft-dk-stop' : 'ft-dk-stop');
          var dkCheck = ds._passed ? '<span class="ft-check">✓</span> ' : '';
          var dkMarker = ds._isNext ? '<span class="ft-marker">▶</span> ' : '';

          // Realtime arrival
          var earlyArr = '';
          if (ds.rtArr && ds.arrPlanned && ds.rtArr !== ds.arrPlanned) {
            earlyArr = '<span class="ft-dk-planned">' + ds.arrPlanned + '</span> <span class="ft-dk-rt">' + ds.rtArr + '</span>';
          } else {
            earlyArr = ds.arrPlanned || ds.arr || '';
          }
          // Realtime departure
          var earlyDep = '';
          if (ds.rtDep && ds.depPlanned && ds.rtDep !== ds.depPlanned) {
            earlyDep = '<span class="ft-dk-planned">' + ds.depPlanned + '</span> <span class="ft-dk-rt">' + ds.rtDep + '</span>';
          } else {
            earlyDep = ds.depPlanned || ds.dep || '';
          }
          var earlyTrack = earlyHasTrack ? '<td class="ft-dk-track">' + (ds.track || '') + '</td>' : '';

          html += '<tr class="' + dkRowClass + '">'
            + '<td>' + dkCheck + dkMarker + ds.name + '</td>'
            + '<td>' + earlyArr + '</td>'
            + '<td>' + earlyDep + '</td>'
            + earlyTrack
            + '</tr>';
        }
        html += '<tr class="ft-se-separator"><td colspan="' + earlyColSpan + '">🇸🇪 Sverige</td></tr>';
        html += '<tr><td colspan="' + earlyColSpan + '" class="ft-waiting-api">Väntar på tågdata...</td></tr>';
        html += '</tbody></table></div>';

        contentEl.innerHTML = html;
        startCountdown();
        return;
      }

      // No DK data either — just return (loading state shown elsewhere)
      return;
    }

    var d = nextStationData;
    var stops = d.stops;
    var nextIdx = d.nextIdx;

    var delayMin = 0;
    if (nextIdx >= 0 && stops[nextIdx]) {
      var ns = stops[nextIdx];
      var timeInfo = ns.arrival || ns.departure;
      if (timeInfo && timeInfo.estimated && timeInfo.planned) {
        delayMin = calcDelayMin(timeInfo.planned, timeInfo.estimated);
      }
    }

    var trainCompleted = nextIdx === -1 && stops.length > 0;

    // Detect "at origin, not departed" = nextIdx is 0 and nothing is passed
    var atOrigin = nextIdx === 0 && stops.length > 0 && !stops[0].passed;
    // If train comes from DK (toSE), first SE stop is NOT origin — it's an arrival
    if (atOrigin && dkState && dkState.direction === 'toSE') {
      atOrigin = false;
    }

    updateTopbar();

    var html = '';

    // === NEXT STATION CARD ===
    // Check if DK tracking should take over (toSE train still in DK, or toDK train entering DK)
    var dkCardUsed = false;

    if (trainCompleted && dkState && dkState.direction === 'toDK' && dkState.phase !== 'allPassed') {
      // Train completed Swedish part, now entering Denmark
      dkCardUsed = true;
      html += buildDkNextCard(dkState);
    } else if (atOrigin && dkState && dkState.direction === 'toSE' && dkState.phase !== 'allPassed') {
      // Train hasn't departed Sweden yet — still in DK
      dkCardUsed = true;
      html += buildDkNextCard(dkState);
    } else if (trainCompleted) {
      html += '<div class="ft-next-card">'
        + '<div class="ft-next-label">TÅGET HAR ANKOMMIT</div>'
        + '<div class="ft-next-station">' + stationName(d.lastStation) + '</div>'
        + '</div>';
    }

    if (!dkCardUsed && !trainCompleted && nextIdx >= 0) {
      var next = stops[nextIdx];
      var arrTime = next.arrival ? (next.arrival.estimated || next.arrival.planned) : '';
      var depTime = next.departure ? (next.departure.estimated || next.departure.planned) : '';
      var trackStr = next.track || '—';

      // SE departed hold — show "AVGÅTT FRÅN" with count-up
      if (next._phase === 'departed') {
        var seDepartedTime = next.departure ? next.departure.actual : depTime;
        html += '<div class="ft-next-card ft-card-departed">'
          + '<div class="ft-next-label">AVGÅTT FRÅN</div>'
          + '<div class="ft-next-station">' + stationName(next.station) + '</div>'
          + '<div class="ft-countdown-row" data-target="' + seDepartedTime + '" data-direction="up">'
          + '<span class="ft-countdown-label">AVGICK FÖR</span>'
          + '<span class="ft-countdown-value" id="ftCountdown">0:00</span>'
          + '</div>'
          + '<div class="ft-detail-row">'
          + '<div class="ft-track-circle"><span class="ft-track-nr">' + trackStr + '</span><span class="ft-track-label">SPÅR</span></div>'
          + '<div class="ft-times">'
          + (depTime ? '<div class="ft-time-box"><span class="ft-time-label">AVGÅNG</span><span class="ft-time-value">' + depTime + '</span></div>' : '')
          + '</div>'
          + '</div>'
          + '</div>';
      } else {
      // Normal SE station card
      var countdownTarget = '';
      var countdownLabel = 'AVGÅNG OM';
      var cardLabel = 'NÄSTA STATION';

      if (atOrigin) {
        cardLabel = 'AVGÅNG FRÅN';
        if (depTime) {
          countdownTarget = depTime;
          countdownLabel = 'AVGÅNG OM';
          originDepartureTarget = depTime;
        }
      } else if (arrTime && (!next.arrival || !next.arrival.actual)) {
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
        + '<div class="ft-next-label">' + cardLabel + ' ' + delayHtml + '</div>'
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
      } // end else (normal SE card)
    }

    // === ALL STOPS ===
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

    // Build Danish stop rows helper with tracking state + realtime
    function buildDkRows() {
      var dkHtml = '';
      if (!dkState || !dkState.stops.length) return dkHtml;
      var hasTrack = false;
      for (var ti = 0; ti < dkState.stops.length; ti++) {
        if (dkState.stops[ti].track) { hasTrack = true; break; }
      }
      var colSpan = hasTrack ? '4' : '3';
      var liveSrc = dkState.source === 'live' ? ' <span class="ft-dk-live">LIVE</span>' : '';
      dkHtml += '<tr class="ft-dk-separator"><td colspan="' + colSpan + '">🇩🇰 Danmark' + liveSrc + '</td></tr>';
      for (var di = 0; di < dkState.stops.length; di++) {
        var dkStop = dkState.stops[di];
        var rowCls = dkStop._passed ? 'ft-stop-passed ft-dk-stop' : (dkStop._isNext ? 'ft-stop-next ft-dk-stop' : 'ft-dk-stop');
        var chk = dkStop._passed ? '<span class="ft-check">✓</span> ' : '';
        var mrk = dkStop._isNext ? '<span class="ft-marker">▶</span> ' : '';

        // Arrival cell: show realtime if different from planned
        var arrCell = '';
        if (dkStop.rtArr && dkStop.arrPlanned && dkStop.rtArr !== dkStop.arrPlanned) {
          arrCell = '<span class="ft-dk-planned">' + dkStop.arrPlanned + '</span> <span class="ft-dk-rt">' + dkStop.rtArr + '</span>';
        } else {
          arrCell = dkStop.arrPlanned || dkStop.arr || '';
        }

        // Departure cell
        var depCell = '';
        if (dkStop.rtDep && dkStop.depPlanned && dkStop.rtDep !== dkStop.depPlanned) {
          depCell = '<span class="ft-dk-planned">' + dkStop.depPlanned + '</span> <span class="ft-dk-rt">' + dkStop.rtDep + '</span>';
        } else {
          depCell = dkStop.depPlanned || dkStop.dep || '';
        }

        var trackCell = hasTrack ? '<td class="ft-dk-track">' + (dkStop.track || '') + '</td>' : '';

        dkHtml += '<tr class="' + rowCls + '">'
          + '<td>' + chk + mrk + dkStop.name + '</td>'
          + '<td>' + arrCell + '</td>'
          + '<td>' + depCell + '</td>'
          + trackCell
          + '</tr>';
      }
      return dkHtml;
    }

    // Check if DK rows have track data (affects column count)
    var comboHasTrack = false;
    if (dkState && dkState.stops) {
      for (var cti = 0; cti < dkState.stops.length; cti++) {
        if (dkState.stops[cti].track) { comboHasTrack = true; break; }
      }
    }
    var comboColSpan = comboHasTrack ? '4' : '3';

    // Build Swedish stop rows helper
    function buildSeRows() {
      var seHtml = '';
      var hasDk = dkState && dkState.stops.length > 0;
      if (hasDk) {
        seHtml += '<tr class="ft-se-separator"><td colspan="' + comboColSpan + '">🇸🇪 Sverige</td></tr>';
      }
      for (var m = 0; m < upcomingStops.length; m++) {
        var st = upcomingStops[m];
        var rowClass = st.passed ? 'ft-stop-passed' : '';
        if (st.isNext) rowClass = 'ft-stop-next';
        var check = st.passed ? '<span class="ft-check">✓</span> ' : '';
        var marker = st.isNext ? '<span class="ft-marker">▶</span> ' : '';
        seHtml += '<tr class="' + rowClass + '">'
          + '<td>' + check + marker + st.station + '</td>'
          + '<td>' + st.arr + '</td>'
          + '<td>' + st.dep + '</td>'
          + (comboHasTrack ? '<td></td>' : '')
          + '</tr>';
      }
      return seHtml;
    }

    html += '<div class="ft-stops-card">'
      + '<table class="ft-stops-table"><thead><tr>'
      + '<th>Station</th><th>Ank.</th><th>Avg.</th>'
      + (comboHasTrack ? '<th>Spår</th>' : '')
      + '</tr></thead><tbody>';

    // Order: DK first for trains FROM Denmark, SE first for trains TO Denmark
    if (dkState && dkState.direction === 'toSE') {
      html += buildDkRows() + buildSeRows();
    } else {
      html += buildSeRows() + buildDkRows();
    }

    html += '</tbody></table></div>';

    contentEl.innerHTML = html;

    startCountdown();
  }

  function scrollToNextStop(container) {
    setTimeout(function() {
      var nextRow = container.querySelector('.ft-stop-next');
      if (nextRow) {
        var rowTop = nextRow.offsetTop - container.offsetTop;
        var containerH = container.clientHeight;
        container.scrollTop = Math.max(0, rowTop - containerH / 3);
      }
    }, 50);
  }

  // ==========================================
  // API FETCH
  // ==========================================

  async function fetchAndRender() {
    if (!followedTrain) return;
    var trainNr = followedTrain.trainNr;

    // Build SE (Trafikverket) request
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

    // Parallel fetch: SE Trafikverket + DK Rejseplanen
    var seFetch = fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });

    var dkFetch = getDkStopsAsync(trainNr);

    try {
      var results = await Promise.all([
        seFetch.catch(function() { return null; }),
        dkFetch.catch(function() { return null; })
      ]);

      var seData = results[0];
      var dkResult = results[1];

      // Process SE data
      var seAnnouncements = [];
      if (seData && seData.RESPONSE && seData.RESPONSE.RESULT && seData.RESPONSE.RESULT[0]) {
        seAnnouncements = seData.RESPONSE.RESULT[0].TrainAnnouncement || [];
      }
      announcements = seAnnouncements;
      processAnnouncements();

      // Store DK data
      if (dkResult) {
        dkStopsData = dkResult;
      }

      computeDelayInfo();
      updateButton();
      renderPage();
    } catch (err) {
      if (contentEl && announcements.length === 0) {
        contentEl.innerHTML =
          '<div class="ft-error">Kunde inte hämta data. Försöker igen...</div>';
      }
    }
  }

  // ==========================================
  // PROCESS ANNOUNCEMENTS
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

    // 30s hold: if previous stop departed within 30s, hold on it
    var SE_HOLD_MS = 30000;
    var now = new Date();
    if (nextIdx > 0) {
      var prevStop = stops[nextIdx - 1];
      if (prevStop.departure && prevStop.departure.actual) {
        var pp = prevStop.departure.actual.split(':');
        var depDate = new Date();
        depDate.setHours(parseInt(pp[0]), parseInt(pp[1]), 0, 0);
        var elapsed = now - depDate;
        if (elapsed >= 0 && elapsed < SE_HOLD_MS) {
          prevStop.passed = false;
          prevStop._phase = 'departed';
          prevStop._departedSecsAgo = Math.floor(elapsed / 1000);
          nextIdx = nextIdx - 1;
        }
      }
    }
    // Also handle: all stops passed but last departure within 90s
    if (nextIdx === -1 && stops.length > 0) {
      var lastDep = stops[stops.length - 1];
      if (lastDep.departure && lastDep.departure.actual) {
        var lp = lastDep.departure.actual.split(':');
        var ldDate = new Date();
        ldDate.setHours(parseInt(lp[0]), parseInt(lp[1]), 0, 0);
        var lElapsed = now - ldDate;
        if (lElapsed >= 0 && lElapsed < SE_HOLD_MS) {
          lastDep.passed = false;
          lastDep._phase = 'departed';
          lastDep._departedSecsAgo = Math.floor(lElapsed / 1000);
          nextIdx = stops.length - 1;
        }
      }
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
  // COUNTDOWN
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

    var direction = row.getAttribute('data-direction') || 'down';
    var now = new Date();
    var parts = target.split(':');
    var targetDate = new Date();
    targetDate.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);

    // === COUNT UP (departed) ===
    if (direction === 'up') {
      var elapsed = Math.floor((now - targetDate) / 1000);
      if (elapsed < 0) elapsed = 0;
      var eMin = Math.floor(elapsed / 60);
      var eSec = elapsed % 60;
      if (eMin > 0) {
        el.textContent = eMin + ' min ' + (eSec < 10 ? '0' : '') + eSec + ' sek sedan';
      } else {
        el.textContent = eSec + ' sek sedan';
      }
      el.className = 'ft-countdown-value ft-countdown-departed';
      return;
    }

    // === COUNT DOWN (normal) ===
    var diff = Math.floor((targetDate - now) / 1000);

    if (diff <= 0) {
      el.textContent = 'Nu';
      el.className = 'ft-countdown-value ft-countdown-now';
      // Also update header button when at origin
      if (originDepartureTarget && btnFlipShowingDelay) updateButton();
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

    // Keep header button countdown updated every second when at origin
    if (originDepartureTarget && btnFlipShowingDelay) updateButton();
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
  // PAGE LIFECYCLE HOOKS (called from navigation.js)
  // ==========================================

  window.onTrainFollowPageShow = function() {
    pageActive = true;
    topbarEl = document.getElementById('ftPageTopbar');
    contentEl = document.getElementById('ftPageContent');

    // Set header title
    var headerTitle = document.getElementById('headerTitle') || document.querySelector('.header-title');
    if (headerTitle) {
      headerTitle.textContent = followedTrain ? 'Följ tåg ' + followedTrain.trainNr : 'Följ tåg';
    }

    if (followedTrain) {
      updateTopbar();
      if (nextStationData) {
        renderPage();
      } else {
        showLoading();
      }
    } else {
      // No train followed — show prompt
      if (topbarEl) topbarEl.innerHTML = '';
      if (contentEl) {
        contentEl.innerHTML =
          '<div class="ft-empty">'
          + '<p>Inget tåg följs just nu.</p>'
          + '<button class="ft-btn ft-btn-follow ft-empty-btn" id="ftEmptyFollow">Välj tåg</button>'
          + '</div>';
        document.getElementById('ftEmptyFollow').addEventListener('click', function() {
          openModal();
        });
      }
    }
  };

  window.onTrainFollowPageHide = function() {
    pageActive = false;
    // Keep polling in background — button flip still needs updates
  };

  // ==========================================
  // INIT
  // ==========================================

  function init() {
    followBtn = document.getElementById('followTrainBtn');
    if (!followBtn) return;

    followBtn.addEventListener('click', onButtonClick);

    // Restore from cookie
    var saved = readCookie();
    if (saved && /^\d{1,5}$/.test(saved)) {
      // Just restore state, don't navigate
      followedTrain = { trainNr: saved };
      currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
      updateButton();
      startBtnFlipTimer();

      // Start fetching in background
      fetchAndRender();
      pollTimer = setInterval(fetchAndRender, POLL_INTERVAL);
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
