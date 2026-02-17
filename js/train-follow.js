/**
 * Train Follow (Följ tåg) — pick a train to track in realtime.
 * Uses the app's page system (showPage('trainFollow')) — no overlays or fixed positioning.
 *
 * Persistence: cookie-based (per-device, valid until midnight).
 */

/* global showPage, trainRealtimeStore, pdfjsLib */

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
  var apiStationNames = {};         // LocationSignature → AdvertisedLocationName (from Trafikverket)
  var clockTimer = null;            // setInterval id for the live clock
  var autoUnfollowTimer = null;     // setTimeout id for auto-unfollow 5 min after final station

  // ==========================================
  // TKØ — K26 train number → PDF page(s)
  // ==========================================
  var TKO_PDF_URL = 'docs/K26-TKO.pdf';
  var TKO_TRAIN_MAP = {"1001":[1],"1004":[1,2],"1005":[2],"1007":[2,3],"1008":[3],"1009":[4],"1010":[4],"1012":[5],"1013":[5],"1015":[6],"1016":[6],"1017":[7],"1018":[7],"1019":[8],"1020":[8],"1021":[9],"1022":[9],"1023":[9,10],"1024":[10,11],"1025":[11],"1026":[12],"1027":[12],"1028":[12,13],"1029":[13],"1030":[14],"1031":[14],"1032":[15],"1033":[15],"1034":[16],"1035":[16],"1036":[16,17],"1037":[17],"1038":[18],"1039":[18],"1040":[19],"1041":[19],"1042":[20],"1043":[20],"1044":[20,21],"1045":[21],"1046":[22],"1047":[22],"1048":[23],"1049":[23],"1050":[24],"1051":[24],"1052":[25],"1053":[25],"1054":[26],"1055":[26],"1056":[27],"1057":[27],"1058":[28],"1059":[28],"1060":[29],"1061":[29],"1062":[30],"1063":[30],"1064":[31],"1065":[31],"1066":[32],"1067":[32],"1068":[33],"1069":[33],"1070":[34],"1071":[34],"1072":[35],"1073":[35],"1074":[36],"1075":[36],"1076":[37],"1077":[37],"1078":[38],"1079":[38],"1080":[39],"1081":[39],"1082":[40],"1083":[40],"1084":[41],"1085":[41],"1086":[42],"1087":[42],"1088":[43],"1089":[43],"1090":[44],"1091":[44],"1092":[45],"1093":[45],"1094":[46],"1095":[46],"1096":[47],"1097":[47],"1098":[48],"1099":[48],"1100":[49],"1101":[49],"1102":[50],"1103":[50],"1104":[51],"1105":[51],"1106":[52],"1107":[52],"1108":[53],"1109":[53],"1110":[54],"1111":[54],"1112":[55],"1113":[55],"1114":[56],"1115":[56],"1116":[57],"1117":[57],"1118":[58],"1119":[58],"1120":[59],"1121":[59],"1122":[60],"1124":[60],"1125":[61],"1127":[61],"1128":[62],"1129":[62],"1130":[63],"1132":[63],"1133":[64],"1135":[64],"1136":[65],"1137":[65],"1138":[66],"1140":[66],"1141":[67],"1143":[67],"1144":[68],"1145":[68],"1146":[69],"1148":[69],"1149":[70],"1151":[70],"1152":[71],"1153":[71],"1154":[72],"1156":[72],"1157":[73],"1159":[73],"1160":[73],"1162":[74],"1164":[74],"1165":[75],"1168":[75],"1177":[78],"1180":[78],"1181":[79],"1188":[79],"1189":[80]};
  var _tkoPageIdx = 0;   // current page index in pages array
  var _tkoPdfDoc = null;  // cached pdfjs document

  function getTkoPages(trainNr) {
    var nr = String(trainNr).replace(/\D/g, '');
    return TKO_TRAIN_MAP[nr] || null;
  }

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
          + '&format=json&accessId=' + REJSE_KEY
          + '&duration=360';
        var dbResp = await fetch(dbUrl);
        if (!dbResp.ok) {
          console.log('[DK-fetch] departureBoard ' + station.name + ' HTTP ' + dbResp.status);
          continue;
        }
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
            console.log('[DK-fetch] Found train ' + targetNr + ' at ' + station.name);
            break;
          }
        }
      } catch (e) {
        console.log('[DK-fetch] Error at ' + station.name + ': ' + e.message);
      }
      if (ref) break;
    }

    if (!ref) {
      console.log('[DK-fetch] No JourneyDetailRef found for train ' + targetNr);
      return null;
    }

    // Step 2 — fetch full journey detail
    try {
      var jdUrl = REJSE_BASE + '/journeyDetail?id=' + encodeURIComponent(ref)
        + '&format=json&accessId=' + REJSE_KEY;
      console.log('[DK-fetch] journeyDetail URL: ' + jdUrl);
      var jdResp = await fetch(jdUrl);
      if (!jdResp.ok) {
        console.log('[DK-fetch] journeyDetail HTTP ' + jdResp.status);
        return null;
      }
      var jdData = await jdResp.json();
      console.log('[DK-fetch] journeyDetail keys: ' + Object.keys(jdData).join(', '));

      var stops = null;
      if (jdData.Stops && jdData.Stops.Stop) {
        stops = jdData.Stops.Stop;
      } else if (jdData.JourneyDetail && jdData.JourneyDetail.Stop) {
        stops = jdData.JourneyDetail.Stop;
      } else if (jdData.Stop) {
        stops = jdData.Stop;
      }
      if (!stops || !Array.isArray(stops)) {
        console.log('[DK-fetch] No stops array found. Keys: ' + Object.keys(jdData).join(', '));
        return null;
      }

      console.log('[DK-fetch] Got ' + stops.length + ' stops from journeyDetail');

      // Map to our normalized format
      // API 2.0 uses rtDepPlatform/rtArrPlatform objects with .text for track
      // Filter: only keep Danish stops (extId starting with "86")
      // Rejseplanen returns the full cross-border route including Swedish stops
      var result = [];
      for (var i = 0; i < stops.length; i++) {
        var s = stops[i];
        var stopId = String(s.extId || s.id || '');
        // Danish station IDs start with "86", Swedish with "74" — keep only Danish
        if (stopId && !stopId.startsWith('86')) continue;
        // Track: rtDepPlatform.text > rtArrPlatform.text > legacy fields
        var depPlatform = (s.rtDepPlatform && s.rtDepPlatform.text) || s.rtDepTrack || s.depTrack || s.track || '';
        var arrPlatform = (s.rtArrPlatform && s.rtArrPlatform.text) || s.rtArrTrack || s.arrTrack || s.track || '';
        result.push({
          name:           s.name || '',
          extId:          stopId,
          depTime:        fmtDkTime(s.depTime),
          arrTime:        fmtDkTime(s.arrTime),
          rtDepTime:      fmtDkTime(s.rtDepTime),
          rtArrTime:      fmtDkTime(s.rtArrTime),
          depTrack:       depPlatform,
          rtDepTrack:     depPlatform,
          arrTrack:       arrPlatform,
          rtArrTrack:     arrPlatform,
          prognosisType:  s.depPrognosisType || s.arrPrognosisType || ''
        });
      }
      console.log('[DK-fetch] Filtered to ' + result.length + ' Danish stops (from ' + stops.length + ' total)');
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
      var liveResult = { source: 'live', stops: liveStops, direction: _inferDkDirection(liveStops) };
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
    // Skåne / Öresundståg
    'Mc': 'Malmö C', 'Hie': 'Hyllie', 'Tri': 'Triangeln', 'Lu': 'Lund C',
    'Klv': 'Kävlinge', 'Lkr': 'Landskrona', 'Hb': 'Helsingborg C',
    'Åp': 'Åstorp', 'Elv': 'Eslöv', 'Hör': 'Höör', 'Hm': 'Hässleholm C',
    'Kr': 'Kristianstad C', 'Tb': 'Trelleborg', 'Ys': 'Ystad', 'Sim': 'Simrishamn',
    'Äs': 'Arlöv', 'Brl': 'Burlöv', 'Sv': 'Svågertorp', 'Mö': 'Malmö Godsbangård',
    'Tye': 'Tygelsjö', 'Haa': 'Halmstad Arena', 'Öso': 'Östervärn',
    'Stp': 'Svedala', 'Skr': 'Skurup', 'Rö': 'Rydsgård',
    // Västkustbanan
    'Hd': 'Halmstad C', 'Fby': 'Falkenberg', 'Vb': 'Varberg', 'Vbc': 'Varberg C',
    'Kb': 'Kungsbacka', 'K': 'Kungsbacka', 'Mdn': 'Mölndal',
    'G': 'Göteborg C', 'Å': 'Ängelholm', 'Bå': 'Båstad', 'La': 'Laholm',
    'Hpbg': 'Höganäs',
    // Blekinge / Småland
    'Smp': 'Sölvesborg', 'Kh': 'Karlshamn', 'Rn': 'Ronneby',
    'Ck': 'Karlskrona C', 'Av': 'Alvesta', 'Vö': 'Växjö',
    'Eba': 'Emmaboda', 'Kac': 'Kalmar C',
    'Mh': 'Markaryd', 'Ay': 'Älmhult',
    'Jö': 'Jönköping C', 'Nä': 'Nässjö C', 'Ht': 'Hestra',
    'Bor': 'Borås', 'Bgs': 'Borås C', 'Vr': 'Värnamo',
    // Västra stambanan / Övriga
    'Cst': 'Stockholm C', 'Söc': 'Södertälje C', 'Fg': 'Flemingsberg',
    'Fa': 'Falköping C', 'Sk': 'Skövde C',
    'Lå': 'Linköping C', 'Nk': 'Norrköping C', 'Mjö': 'Mjölby',
    'Kn': 'Katrineholm C', 'Ö': 'Örebro C', 'Hr': 'Hallsberg',
    // Danmark-kopplade
    'Km': 'Köpenhamn', 'Kk': 'Kastrup'
  };

  function stationName(sig) {
    if (!sig) return sig;
    // Prefer API-provided name, then static fallback, then raw signature
    return apiStationNames[sig] || SIG_NAMES[sig] || sig;
  }

  /**
   * Fetch all TrainStation names from Trafikverket (one-time).
   * Populates apiStationNames { LocationSignature → AdvertisedLocationName }.
   */
  async function fetchStationNames() {
    if (Object.keys(apiStationNames).length > 0) return; // already loaded
    var xml = '<REQUEST>'
      + '<LOGIN authenticationkey="' + API_KEY + '" />'
      + '<QUERY objecttype="TrainStation" schemaversion="1">'
      + '<INCLUDE>LocationSignature</INCLUDE>'
      + '<INCLUDE>AdvertisedLocationName</INCLUDE>'
      + '</QUERY>'
      + '</REQUEST>';
    try {
      var resp = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml
      });
      if (!resp.ok) return;
      var data = await resp.json();
      var stations = data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]
        ? data.RESPONSE.RESULT[0].TrainStation : [];
      for (var i = 0; i < stations.length; i++) {
        var s = stations[i];
        if (s.LocationSignature && s.AdvertisedLocationName) {
          apiStationNames[s.LocationSignature] = s.AdvertisedLocationName;
        }
      }
      console.log('[FT] Loaded ' + Object.keys(apiStationNames).length + ' station names');
    } catch (e) {
      console.log('[FT] Could not load station names: ' + e.message);
    }
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

    // Load station names BEFORE first render, then fetch train data
    fetchStationNames().then(function() {
      fetchAndRender();
      pollTimer = setInterval(fetchAndRender, POLL_INTERVAL);
    });
  }

  function stopFollowing(keepPage) {
    followedTrain = null;
    announcements = [];
    nextStationData = null;
    dkStopsData = null;
    currentDelayInfo = { status: 'ontime', delayText: 'I tid', delayMin: 0 };
    activeTopbarTab = 'timetable';
    ftLaStracka = null;
    ftLaPage = null;
    _tkoPageIdx = 0;
    _tkoPdfDoc = null;
    _khToastShown = false;
    _khPulseActive = false;
    _khPulseStracka = null;
    clearCookie();
    stopBtnFlipTimer();
    if (autoUnfollowTimer) { clearTimeout(autoUnfollowTimer); autoUnfollowTimer = null; }
    updateButton();
    restoreHeader();

    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    stopClockTimer();

    if (!keepPage) {
      showPage('schedule');
    }

    // Notify auto-follow engine that following stopped
    if (window.trainFollow && typeof window.trainFollow.onStopCallback === 'function') {
      setTimeout(function() { window.trainFollow.onStopCallback(); }, 200);
    }
  }

  function updateButton() {
    if (!followBtn) return;
    followBtn.classList.remove('following', 'ft-btn-ontime', 'ft-btn-minor', 'ft-btn-major');

    if (followedTrain) {
      followBtn.classList.add('following');
      applyBtnDelayClass();
      followBtn.style.minWidth = '90px';
      // Flip between train number and delay text
      if (btnFlipShowingDelay) {
        followBtn.textContent = currentDelayInfo.delayText;
      } else {
        followBtn.textContent = 'Tåg ' + followedTrain.trainNr;
      }
    } else {
      followBtn.textContent = 'Följ tåg';
      followBtn.style.minWidth = '';
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
    // Don't flip when on the Följ tåg page — delay info already visible
    if (pageActive) {
      if (btnFlipShowingDelay) { btnFlipShowingDelay = false; updateButton(); }
      return;
    }
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

  /**
   * Build the route string "FirstStation → LastStation" including DK extensions.
   * Reused by both updateTopbar() and updateHeaderRoute().
   */
  function getRouteText() {
    if (!followedTrain || !nextStationData) return '';
    var trainNr = followedTrain.trainNr;
    var first = stationName(nextStationData.firstStation);
    var last = stationName(nextStationData.lastStation);

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

    return first + ' → ' + last;
  }

  /**
   * Update the app header to show route info when following a train.
   */
  function updateHeaderRoute() {
    var headerTitle = document.getElementById('headerTitle') || document.querySelector('.header-title');
    if (!headerTitle) return;
    var route = getRouteText() || ('Följ tåg ' + (followedTrain ? followedTrain.trainNr : ''));
    headerTitle.innerHTML = '<span class="marquee-inner">' + route.replace(/</g, '&lt;') + '</span>';
    headerTitle.classList.add('following-route');
    requestAnimationFrame(function() {
      if (typeof initMarqueeScrolls === 'function') {
        initMarqueeScrolls(headerTitle.parentElement);
      }
    });
  }

  /**
   * Restore the app header to default for current page.
   */
  function restoreHeader() {
    var headerTitle = document.getElementById('headerTitle') || document.querySelector('.header-title');
    if (headerTitle) {
      headerTitle.classList.remove('following-route', 'marquee-scroll');
      headerTitle.style.removeProperty('--marquee-distance');
      headerTitle.style.removeProperty('--marquee-duration');
    }
  }

  var activeTopbarTab = 'timetable'; // 'timetable', 'la' or 'tko'
  var ftLaStracka = null;   // '10' or '11', null = auto-detect
  var ftLaPage = null;      // 1 or 2, null = auto from getTargetPage()

  function updateTopbar() {
    if (!topbarEl || !followedTrain) return;

    // Update header with route
    updateHeaderRoute();

    var isTimetable = activeTopbarTab === 'timetable';
    var isLa = activeTopbarTab === 'la';
    var isTko = activeTopbarTab === 'tko';
    var hasTko = followedTrain && getTkoPages(followedTrain.trainNr);

    var tabsHtml =
        '<button class="ft-tab-btn' + (isTimetable ? ' ft-tab-active' : '') + '" data-tab="timetable">Följ tåg</button>'
      + '<button class="ft-tab-btn' + (isLa ? ' ft-tab-active' : '') + (_khPulseActive ? ' ft-tab-pulse' : '') + '" data-tab="la">LA</button>';
    if (hasTko) {
      tabsHtml += '<button class="ft-tab-btn' + (isTko ? ' ft-tab-active' : '') + '" data-tab="tko">TKØ</button>';
    }

    topbarEl.innerHTML =
      '<div class="ft-topbar-left">'
      + '<div class="ft-tab-toggle">'
      + tabsHtml
      + '</div>'
      + '</div>'
      + '<div class="ft-topbar-right">'
      + '<button class="ft-stop-follow-btn" id="ftStopFollow">Sluta följa</button>'
      + '<button class="ft-close-btn" id="ftClosePanel" title="Tillbaka">✕</button>'
      + '</div>';

    // Tab toggle listeners
    var tabBtns = topbarEl.querySelectorAll('.ft-tab-btn');
    for (var i = 0; i < tabBtns.length; i++) {
      tabBtns[i].addEventListener('click', function() {
        var tab = this.getAttribute('data-tab');
        if (tab === activeTopbarTab) return;
        activeTopbarTab = tab;
        updateTopbar();
        onTabSwitch(tab);
        // If switching to LA and pulse is active → show toast
        if (tab === 'la' && _khPulseActive && !_khToastShown) {
          _khPulseActive = false;
          _khToastShown = true;
          applyLaPulse(false);
          var strackaName = _khPulseStracka === '10' ? 'Sträcka 10' : 'Sträcka 11';
          // Small delay so LA content renders first
          setTimeout(function() {
            showKhLaToast(_khPulseStracka, strackaName);
          }, 300);
        }
      });
    }

    document.getElementById('ftClosePanel').addEventListener('click', function() {
      showPage('schedule');
    });
    document.getElementById('ftStopFollow').addEventListener('click', function() {
      stopFollowing(false);
    });
  }

  /**
   * Detect which Banedanmark sträcka (10 or 11) applies to current train.
   * Sträcka 10: KH – Österport (Kystbanen, norr om KH)
   * Sträcka 11: KH – Peberholm (Öresundståg, över bron)
   * Returns '10' or '11' (defaults to '11' for Öresundståg).
   */
  function detectStracka() {
    var dkState = followedTrain ? getDkTrackingState(followedTrain.trainNr) : null;
    if (!dkState || !dkState.stops || dkState.stops.length === 0) return '11';

    // Sträcka 10 = KH → Østerport/Helsingør (Kystbanen, norr om KH)
    // Sträcka 11 = KH → Peberholm (Öresundsbron, söder om KH)
    // We check the train's CURRENT position, not the full route.
    var stracka10Names = [
      'østerport', 'österport', 'nordhavn', 'svanemøllen', 'hellerup',
      'charlottenlund', 'ordrup', 'klampenborg', 'lyngby',
      'holte', 'birkerød', 'allerød', 'hillerød',
      'fredensborg', 'humlebæk', 'nivå', 'kokkedal',
      'rungsted kyst', 'hørsholm', 'snekkersten', 'helsingør',
      'nørreport'
    ];

    function isS10(stopName) {
      var n = (stopName || '').toLowerCase();
      for (var j = 0; j < stracka10Names.length; j++) {
        if (n.indexOf(stracka10Names[j]) >= 0) return true;
      }
      return false;
    }

    var nextIdx = dkState.nextIdx;

    if (nextIdx >= 0 && nextIdx < dkState.stops.length) {
      // Next stop is on Kystbanen → S10
      if (isS10(dkState.stops[nextIdx].name)) return '10';

      // Previous (just passed) stop was Kystbanen → train is between Kystbanen and KH → still S10
      if (nextIdx > 0 && dkState.stops[nextIdx - 1]._passed && isS10(dkState.stops[nextIdx - 1].name)) return '10';

      return '11';
    }

    // All DK stops passed — check last stop to see where train was last
    if (dkState.phase === 'allPassed') {
      var lastStop = dkState.stops[dkState.stops.length - 1];
      if (isS10(lastStop.name)) return '10';
    }

    return '11'; // default: Öresundståg via Peberholm
  }

  // ── LA-switch toast at København H ──────────────────
  var _khToastShown = false;
  var _khPulseActive = false;
  var _khPulseStracka = null;  // stash sträcka for deferred toast

  /**
   * Check if train has reached København H and prompt to switch LA sträcka.
   * If LA tab is active → show toast immediately.
   * If LA tab is NOT active → start pulsing the LA tab.
   */
  function checkKhLaToast() {
    if (_khToastShown) return;
    if (!followedTrain) return;

    var dkState = getDkTrackingState(followedTrain.trainNr);
    if (!dkState || !dkState.stops || dkState.stops.length === 0) return;

    // Find København H in the stop list
    var khIdx = -1;
    for (var i = 0; i < dkState.stops.length; i++) {
      var sName = (dkState.stops[i].name || '').toLowerCase();
      if (sName.indexOf('københavn h') >= 0 || sName === 'kh' || sName.indexOf('koebenhavn h') >= 0) {
        khIdx = i;
        break;
      }
    }
    if (khIdx === -1) return;

    var khStop = dkState.stops[khIdx];
    // Trigger when KH is passed or atStation
    if (!khStop._passed && khStop._phase !== 'atStation' && khStop._phase !== 'departed') return;

    // Determine the NEXT sträcka (the one covering the rest of the journey after KH)
    var nextStracka = detectStracka();

    // Only prompt if the current LA sträcka differs from what's needed
    if (ftLaStracka === nextStracka) return;

    if (activeTopbarTab === 'la') {
      // LA tab already open → show toast immediately
      _khToastShown = true;
      var strackaName = nextStracka === '10' ? 'Sträcka 10' : 'Sträcka 11';
      showKhLaToast(nextStracka, strackaName);
    } else if (!_khPulseActive) {
      // LA tab not open → pulse the tab
      _khPulseActive = true;
      _khPulseStracka = nextStracka;
      applyLaPulse(true);
    }
  }

  /** Add or remove pulse class on the LA tab button */
  function applyLaPulse(on) {
    var laBtn = topbarEl ? topbarEl.querySelector('.ft-tab-btn[data-tab="la"]') : null;
    if (!laBtn) return;
    if (on) {
      laBtn.classList.add('ft-tab-pulse');
    } else {
      laBtn.classList.remove('ft-tab-pulse');
    }
  }

  function showKhLaToast(newNr, strackaName) {
    // Remove any existing toast
    var existing = document.querySelector('.ft-la-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'ft-la-toast';
    toast.innerHTML =
      '<div class="ft-la-toast-content">'
      + '<div class="ft-la-toast-text">'
      + '<span class="ft-la-toast-icon">🔄</span>'
      + '<span>Tåget vid <strong>København H</strong><br>Byta till <strong>' + strackaName + '</strong>?</span>'
      + '</div>'
      + '<div class="ft-la-toast-actions">'
      + '<button class="ft-la-toast-btn ft-la-toast-no">Nej</button>'
      + '<button class="ft-la-toast-btn ft-la-toast-yes">Ja, byt</button>'
      + '</div>'
      + '</div>';

    // Wire up buttons
    toast.querySelector('.ft-la-toast-yes').addEventListener('click', function() {
      ftLaStracka = newNr;
      ftLaPage = getTargetPage(newNr, followedTrain.trainNr);
      renderFtLa();
      toast.classList.add('ft-la-toast-exit');
      setTimeout(function() { toast.remove(); }, 300);
    });
    toast.querySelector('.ft-la-toast-no').addEventListener('click', function() {
      toast.classList.add('ft-la-toast-exit');
      setTimeout(function() { toast.remove(); }, 300);
    });

    // Insert into the LA content area
    var laContent = document.getElementById('ftLaContent');
    if (laContent) {
      laContent.appendChild(toast);
    }
  }

  /**
   * Determine which PDF page to scroll to.
   * Jämnt tågnummer (mot Sverige): sträcka 10 → sida 2, sträcka 11 → sida 1
   * Ojämnt tågnummer (mot Danmark): sträcka 10 → sida 1, sträcka 11 → sida 2
   * Returns 1-based page number.
   */
  function getTargetPage(stracka, trainNr) {
    var num = parseInt(trainNr, 10);
    var isEven = num % 2 === 0; // jämnt = mot Sverige
    if (stracka === '10') {
      return isEven ? 2 : 1;
    } else {
      return isEven ? 1 : 2;
    }
  }

  /**
   * Show/hide the Följ tåg content vs LA content.
   */
  function showTabContent(tab) {
    var ftContent = document.getElementById('ftPageContent');
    var laContent = document.getElementById('ftLaContent');
    var tkoContent = document.getElementById('ftTkoContent');
    if (!ftContent || !laContent) return;

    ftContent.style.display = tab === 'timetable' ? '' : 'none';
    laContent.style.display = tab === 'la' ? '' : 'none';
    if (tkoContent) tkoContent.style.display = tab === 'tko' ? '' : 'none';
  }

  /**
   * Called when user switches between Följ tåg / LA tabs.
   */
  function onTabSwitch(tab) {
    showTabContent(tab);

    if (tab === 'la') {
      renderFtLa();
    } else if (tab === 'tko') {
      renderFtTko();
    }
  }

  /**
   * Render the LA PDF into the ftLaContent container.
   * Uses ftLaStracka / ftLaPage state (auto-detected on first call).
   */
  function renderFtLa() {
    var container = document.getElementById('ftLaContent');
    if (!container || !followedTrain) return;

    // Auto-detect on first open
    if (!ftLaStracka) ftLaStracka = detectStracka();
    if (!ftLaPage) ftLaPage = getTargetPage(ftLaStracka, followedTrain.trainNr);

    var nr = ftLaStracka;
    var page = ftLaPage;
    var today = _ftTodayStr();
    var strName = nr === '10' ? 'Sträcka 10' : 'Sträcka 11';
    var otherNr = nr === '10' ? '11' : '10';
    var otherName = nr === '10' ? 'Sträcka 11' : 'Sträcka 10';

    // Build sträcka-bar
    var barHtml =
      '<div class="ft-la-bar">'
      + '<div class="ft-la-bar-left">'
      +   '<span class="ft-la-bar-label"><span class="ft-la-bar-label-text">' + strName + ' — ' + today + '</span></span>'
      + '</div>'
      + '<div class="ft-la-bar-right">'
      +   '<div class="ft-tab-toggle ft-la-page-toggle">'
      +     '<button class="ft-tab-btn' + (page === 1 ? ' ft-tab-active' : '') + '" data-page="1">sida 1</button>'
      +     '<button class="ft-tab-btn' + (page === 2 ? ' ft-tab-active' : '') + '" data-page="2">sida 2</button>'
      +   '</div>'
      +   '<button class="ft-la-stracka-btn" id="ftLaStrackaBtn">' + strName + '</button>'
      + '</div>'
      + '</div>';

    // Build layout
    container.innerHTML =
      barHtml
      + '<div class="ft-la-wrapper">'
      + '<div class="ft-la-mini-tt" id="ftLaMiniTt"></div>'
      + '<div class="ft-la-pdf" id="ftLaPdf">'
      +   '<div class="la-viewer-loading"><div class="la-spinner"></div><span>Hämtar ' + strName + '...</span></div>'
      + '</div>'
      + '</div>';

    // Wire up sträcka-bar events — page toggle buttons
    var pageBtns = container.querySelectorAll('.ft-la-page-toggle .ft-tab-btn');
    for (var i = 0; i < pageBtns.length; i++) {
      pageBtns[i].addEventListener('click', function() {
        var p = parseInt(this.getAttribute('data-page'), 10);
        if (p === ftLaPage) return;
        ftLaPage = p;
        renderFtLa();
      });
    }

    // Sträcka switch button
    document.getElementById('ftLaStrackaBtn').addEventListener('click', function() {
      ftLaStracka = ftLaStracka === '10' ? '11' : '10';
      ftLaPage = getTargetPage(ftLaStracka, followedTrain.trainNr);
      renderFtLa();
    });

    // Fetch and render PDF
    if (!window.laApi) {
      document.getElementById('ftLaPdf').innerHTML =
        '<div class="la-viewer-error"><div class="la-viewer-error-icon">⚠️</div>'
        + '<div class="la-viewer-error-text">LA-modulen är inte laddad.</div></div>';
      return;
    }

    window.laApi.fetchPdf(nr, today).then(function(result) {
      var pdfContainer = document.getElementById('ftLaPdf');
      if (!pdfContainer) return;
      pdfContainer.innerHTML = '';
      // Render only the selected page
      window.laApi.renderPdfPage(result.buffer, pdfContainer, page);
    }).catch(function(err) {
      var pdfContainer = document.getElementById('ftLaPdf');
      if (!pdfContainer) return;

      var msg = '⚠️ Kunde inte hämta PDF.';
      if (err.message === 'NOT_PUBLISHED') {
        msg = '📭 LA finns inte än — prova senare.';
      } else if (err.message === 'OFFLINE') {
        msg = '📴 Du är offline. Denna PDF är inte sparad.';
      }
      pdfContainer.innerHTML =
        '<div class="la-viewer-error"><div class="la-viewer-error-icon">' + msg.charAt(0) + '</div>'
        + '<div class="la-viewer-error-text">' + msg + '</div></div>';
    });

    // Render mini timetable
    renderMiniTimetable();

    // Detect overflow on sträcka-bar label and add marquee animation
    detectBarLabelOverflow();
  }

  // ==========================================
  // TKØ — Render K26 PDF page for followed train
  // ==========================================

  /**
   * Render the TKØ PDF page(s) into ftTkoContent.
   * Shows a bar with train info + page toggle (if multi-page), then renders the PDF page.
   */
  function renderFtTko() {
    var container = document.getElementById('ftTkoContent');
    if (!container || !followedTrain) return;

    var pages = getTkoPages(followedTrain.trainNr);
    if (!pages) {
      container.innerHTML =
        '<div class="ft-tko-no-data">'
        + '<div class="ft-tko-no-data-icon">🚆</div>'
        + '<div class="ft-tko-no-data-text">Tåg ' + followedTrain.trainNr + ' finns inte i K26 TKØ.</div>'
        + '</div>';
      return;
    }

    // Clamp page index
    if (_tkoPageIdx >= pages.length) _tkoPageIdx = 0;
    var currentPage = pages[_tkoPageIdx];

    // Build info bar
    var barHtml = '<div class="ft-tko-bar">'
      + '<div class="ft-tko-bar-left">'
      + '<span class="ft-tko-bar-label">K26 TKØ — Tåg ' + followedTrain.trainNr + '</span>'
      + '</div>';

    if (pages.length > 1) {
      barHtml += '<div class="ft-tko-bar-right">'
        + '<div class="ft-tab-toggle ft-tko-page-toggle">';
      for (var i = 0; i < pages.length; i++) {
        barHtml += '<button class="ft-tab-btn' + (i === _tkoPageIdx ? ' ft-tab-active' : '') + '" data-tko-idx="' + i + '">sida ' + pages[i] + '</button>';
      }
      barHtml += '</div></div>';
    }
    barHtml += '</div>';

    container.innerHTML = barHtml
      + '<div class="ft-tko-pdf" id="ftTkoPdf">'
      + '<div class="la-viewer-loading"><div class="la-spinner"></div><span>Hämtar TKØ sida ' + currentPage + '...</span></div>'
      + '</div>';

    // Wire up page toggle buttons
    if (pages.length > 1) {
      var pageBtns = container.querySelectorAll('.ft-tko-page-toggle .ft-tab-btn');
      for (var j = 0; j < pageBtns.length; j++) {
        pageBtns[j].addEventListener('click', function() {
          var idx = parseInt(this.getAttribute('data-tko-idx'), 10);
          if (idx === _tkoPageIdx) return;
          _tkoPageIdx = idx;
          renderFtTko();
        });
      }
    }

    // Load and render the PDF page
    loadTkoPage(currentPage);
  }

  /**
   * Load the K26 TKØ PDF (cached) and render a specific page number into #ftTkoPdf.
   * Uses the same DPR-sharp rendering pattern as documents.js.
   */
  function loadTkoPage(pageNum) {
    var pdfContainer = document.getElementById('ftTkoPdf');
    if (!pdfContainer) return;

    function doRender(pdfDoc) {
      pdfDoc.getPage(pageNum).then(function(page) {
        var containerWidth = pdfContainer.clientWidth || 360;
        var dpr = window.devicePixelRatio || 1;
        if (dpr < 2) dpr = 2;

        var baseVp = page.getViewport({ scale: 1 });
        var cssScale = containerWidth / baseVp.width;
        var renderScale = cssScale * dpr;
        var viewport = page.getViewport({ scale: renderScale });

        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = (viewport.width / dpr) + 'px';
        canvas.style.height = (viewport.height / dpr) + 'px';
        canvas.className = 'ft-tko-canvas';

        var ctx = canvas.getContext('2d');
        page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
          pdfContainer.innerHTML = '';
          var wrap = document.createElement('div');
          wrap.className = 'ft-tko-wrap';
          wrap.appendChild(canvas);
          pdfContainer.appendChild(wrap);

          // Enable pinch-to-zoom
          if (typeof window.setupPinchZoom === 'function') {
            window.setupPinchZoom(wrap, canvas);
          }
        });
      }).catch(function() {
        pdfContainer.innerHTML =
          '<div class="la-viewer-error"><div class="la-viewer-error-icon">⚠️</div>'
          + '<div class="la-viewer-error-text">Kunde inte rendera sida ' + pageNum + '.</div></div>';
      });
    }

    // Use cached PDF doc or load fresh
    if (_tkoPdfDoc) {
      doRender(_tkoPdfDoc);
    } else {
      if (typeof pdfjsLib === 'undefined') {
        pdfContainer.innerHTML =
          '<div class="la-viewer-error"><div class="la-viewer-error-icon">⚠️</div>'
          + '<div class="la-viewer-error-text">PDF-modulen är inte laddad.</div></div>';
        return;
      }
      pdfjsLib.getDocument(TKO_PDF_URL).promise.then(function(pdfDoc) {
        _tkoPdfDoc = pdfDoc;
        doRender(pdfDoc);
      }).catch(function() {
        pdfContainer.innerHTML =
          '<div class="la-viewer-error"><div class="la-viewer-error-icon">⚠️</div>'
          + '<div class="la-viewer-error-text">Kunde inte ladda K26 TKØ PDF.</div></div>';
      });
    }
  }

  /**
   * Build a combined list of all stops (SE + DK) in travel order,
   * each with: { name, arr, dep, track, passed, isNext, isDk }
   */
  function buildCombinedStops() {
    var combined = [];
    var stops = nextStationData ? nextStationData.stops : [];
    var nextIdx = nextStationData ? nextStationData.nextIdx : -1;
    var dkState = followedTrain ? getDkTrackingState(followedTrain.trainNr) : null;

    // SE stops
    var seStops = [];
    for (var i = 0; i < stops.length; i++) {
      var s = stops[i];
      seStops.push({
        name: stationName(s.station),
        arr: s.arrival ? (s.arrival.actual || s.arrival.estimated || s.arrival.planned || '') : '',
        dep: s.departure ? (s.departure.actual || s.departure.estimated || s.departure.planned || '') : '',
        track: s.track || '',
        passed: !!s.passed,
        isNext: i === nextIdx,
        isDk: false
      });
    }

    // DK stops
    var dkStops = [];
    if (dkState && dkState.stops && dkState.stops.length > 0) {
      for (var j = 0; j < dkState.stops.length; j++) {
        var ds = dkState.stops[j];
        dkStops.push({
          name: ds.name,
          arr: ds.rtArr || ds.arrPlanned || ds.arr || '',
          dep: ds.rtDep || ds.depPlanned || ds.dep || '',
          track: ds.track || '',
          passed: !!ds._passed,
          isNext: !!ds._isNext,
          isDk: true
        });
      }
    }

    // Combine in travel order
    if (dkState && dkState.direction === 'toSE') {
      combined = dkStops.concat(seStops);
    } else {
      combined = seStops.concat(dkStops);
    }

    return combined;
  }

  /**
   * Render mini timetable in LA view: 1 station before, current, 1 station after.
   */
  function renderMiniTimetable() {
    var el = document.getElementById('ftLaMiniTt');
    if (!el) return;

    var all = buildCombinedStops();
    if (all.length === 0) {
      el.innerHTML = '';
      return;
    }

    // Find the "next" station index
    var nextI = -1;
    for (var i = 0; i < all.length; i++) {
      if (all[i].isNext) { nextI = i; break; }
    }
    // If no next station (all passed), use last
    if (nextI < 0) nextI = all.length - 1;

    // Window: 1 before, current, 1 after
    var startI = Math.max(0, nextI - 1);
    var endI = Math.min(all.length - 1, nextI + 1);
    var slice = [];
    for (var k = startI; k <= endI; k++) {
      slice.push(all[k]);
    }

    var hasTrack = false;
    for (var t = 0; t < slice.length; t++) {
      if (slice[t].track) { hasTrack = true; break; }
    }

    var html = '<table class="ft-mini-table"><tbody>';
    for (var r = 0; r < slice.length; r++) {
      var st = slice[r];
      var cls = st.isNext ? 'ft-mini-next' : (st.passed ? 'ft-mini-passed' : '');
      var check = st.passed ? '<span class="ft-check">✓</span> ' : '';
      var marker = st.isNext ? '<span class="ft-marker">▶</span> ' : '';
      var flag = st.isDk ? '<span class="ft-mini-flag">🇩🇰</span> ' : '';

      html += '<tr class="' + cls + '">'
        + '<td class="ft-mini-station">' + check + marker + flag + st.name + '</td>'
        + '<td class="ft-mini-time">' + st.arr + '</td>'
        + '<td class="ft-mini-time">' + st.dep + '</td>'
        + (hasTrack ? '<td class="ft-mini-track">' + st.track + '</td>' : '')
        + '</tr>';
    }
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  /**
   * Detect if sträcka-bar label text overflows and toggle marquee class.
   */
  function detectBarLabelOverflow() {
    var label = document.querySelector('.ft-la-bar-label');
    var text = label ? label.querySelector('.ft-la-bar-label-text') : null;
    if (!label || !text) return;
    if (text.scrollWidth > label.clientWidth + 2) {
      label.style.setProperty('--ft-bar-w', label.clientWidth + 'px');
      label.classList.add('ft-la-bar-marquee');
    } else {
      label.classList.remove('ft-la-bar-marquee');
    }
  }

  /**
   * Today's date as YYYY-MM-DD.
   */
  function _ftTodayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + dd;
  }

  /**
   * Infer direction from live Rejseplanen stops (DK-only, Swedish stops filtered out).
   * Border stations (CPH Lufthavn, Tårnby, Ørestad) are near the SE border.
   *   toSE: train goes DK→SE, border stations are LAST  (e.g. Østerport→...→CPH)
   *   toDK: train goes SE→DK, border stations are FIRST (e.g. CPH→...→Østerport)
   */
  function _inferDkDirection(stops) {
    if (!stops || !stops.length) return 'toDK';
    var borderIds = ['8600858', '8600857', '8600856']; // CPH, Tårnby, Ørestad
    // Check if first or last stop is a border station
    var firstId = String(stops[0].extId || '');
    var lastId = String(stops[stops.length - 1].extId || '');
    var firstIsBorder = borderIds.indexOf(firstId) !== -1;
    var lastIsBorder = borderIds.indexOf(lastId) !== -1;
    if (lastIsBorder && !firstIsBorder) return 'toSE';
    if (firstIsBorder && !lastIsBorder) return 'toDK';
    // Fallback: check position of first border station
    for (var i = 0; i < stops.length; i++) {
      if (borderIds.indexOf(String(stops[i].extId || '')) !== -1) {
        return i >= stops.length / 2 ? 'toSE' : 'toDK';
      }
    }
    return 'toDK';
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
    var isLiveData = stop._isLive ? ' data-is-live="1"' : '';
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
      html += '<div class="ft-next-card ft-card-departed"' + isLiveData + '>'
        + '<div class="ft-next-label">AVGÅTT FRÅN</div>'
        + '<div class="ft-next-station">' + stop.name + '</div>'
        + '<div class="ft-countdown-row" data-target="' + stop.dep + '" data-direction="up">'
        + '<span class="ft-countdown-label">AVGÅNG FÖR</span>'
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
      html += '<div class="ft-next-card ft-card-atstation"' + isLiveData + '>'
        + '<div class="ft-next-label">VID STATION ' + delayHtml + '</div>'
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
        html += '<div class="ft-next-card"' + isLiveData + '>'
          + '<div class="ft-next-label">NÄSTA STATION ' + delayHtml + '</div>'
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
        html += '<div class="ft-next-card"' + isLiveData + '>'
          + '<div class="ft-next-label">AVGÅNG FRÅN</div>'
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
      html += '<div class="ft-next-card"' + isLiveData + '>'
        + '<div class="ft-next-label">NÄSTA STATION ' + delayHtml + '</div>'
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
        var infoHtml = '';
        var tableHtml = '';

        if (dkState.phase === 'allPassed') {
          // All DK stops passed, waiting for Swedish data
          infoHtml += '<div class="ft-next-card">'
            + '<div class="ft-next-label">PÅ VÄG MOT SVERIGE</div>'
            + '<div class="ft-next-station">Väntar på tågdata...</div>'
            + '</div>';
        } else {
          infoHtml += buildDkNextCard(dkState);
        }

        // Stops list — check if track data exists
        var earlyHasTrack = false;
        for (var eti = 0; eti < dkState.stops.length; eti++) {
          if (dkState.stops[eti].track) { earlyHasTrack = true; break; }
        }
        var earlyColSpan = earlyHasTrack ? '4' : '3';
        var earlyLive = dkState.source === 'live' ? ' <span class="ft-dk-live">LIVE</span>' : '';
        tableHtml += '<div class="ft-stops-card">'
          + '<table class="ft-stops-table"><thead><tr>'
          + '<th>Station</th><th>Ank.</th><th>Avg.</th>'
          + (earlyHasTrack ? '<th>Spår</th>' : '')
          + '</tr></thead><tbody>';
        // DK separator removed (v4.25.57)
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

          tableHtml += '<tr class="' + dkRowClass + '">'
            + '<td>' + dkCheck + dkMarker + '<span class="ft-scroll-wrap"><span class="ft-scroll-text">' + ds.name + '</span></span></td>'
            + '<td>' + earlyArr + '</td>'
            + '<td>' + earlyDep + '</td>'
            + earlyTrack
            + '</tr>';
        }
        // SE separator removed (v4.25.57)
        tableHtml += '<tr><td colspan="' + earlyColSpan + '" class="ft-waiting-api">Väntar på tågdata...</td></tr>';
        tableHtml += '</tbody></table></div>';

        contentEl.innerHTML = '<div class="ft-sticky-info">' + infoHtml + '</div>'
          + '<div class="ft-stops-scroll">' + tableHtml + '</div>';
        startCountdown();
        detectScrollOverflows();
        scrollToNextStop();
        startClockTimer();
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

    // Auto-unfollow: 5 min after train reaches final station
    // Also check DK part — if toDK train still has DK stops remaining, it's not truly done
    var trulyCompleted = trainCompleted;
    if (trulyCompleted && dkState && dkState.direction === 'toDK' && dkState.phase !== 'allPassed') {
      trulyCompleted = false; // still running in Denmark
    }
    if (trulyCompleted && !autoUnfollowTimer) {
      console.log('[FT] Train completed — auto-unfollow in 5 minutes');
      autoUnfollowTimer = setTimeout(function() {
        console.log('[FT] Auto-unfollow triggered');
        autoUnfollowTimer = null;
        stopFollowing(false);
      }, 5 * 60 * 1000);
    } else if (!trulyCompleted && autoUnfollowTimer) {
      // Train not completed anymore (edge case: data refresh changed state)
      clearTimeout(autoUnfollowTimer);
      autoUnfollowTimer = null;
    }

    // Detect "at origin, not departed" = nextIdx is 0 and nothing is passed
    var seNotStarted = nextIdx === 0 && stops.length > 0 && !stops[0].passed;
    // If train comes from DK (toSE), first SE stop is NOT origin — it's an arrival
    var atOrigin = seNotStarted && !(dkState && dkState.direction === 'toSE');

    updateTopbar();

    var infoHtml = '';
    var tableHtml = '';

    // === NEXT STATION CARD ===
    // Check if DK tracking should take over (toSE train still in DK, or toDK train entering DK)
    var dkCardUsed = false;

    if (trainCompleted && dkState && dkState.direction === 'toDK' && dkState.phase !== 'allPassed') {
      // Train completed Swedish part, now entering Denmark
      dkCardUsed = true;
      infoHtml += buildDkNextCard(dkState);
    } else if (seNotStarted && dkState && dkState.direction === 'toSE' && dkState.phase !== 'allPassed') {
      // Train hasn't departed Sweden yet — still in DK
      dkCardUsed = true;
      infoHtml += buildDkNextCard(dkState);
    } else if (trainCompleted) {
      // Determine actual final station name + arrival time:
      // For toDK trains with DK data → last DK stop (e.g. Østerport)
      // For toSE trains with DK data → last SE stop (already d.lastStation)
      // No DK data → last SE stop
      var arrivedName = stationName(d.lastStation);
      var arrivedFlag = '';
      var arrivedTime = '';
      // SE arrival time: last stop's actual arrival
      var lastStop = stops[stops.length - 1];
      if (lastStop && lastStop.arrival && lastStop.arrival.actual) {
        arrivedTime = lastStop.arrival.actual;
      }
      // DK override for toDK trains
      if (dkState && dkState.stops && dkState.stops.length > 0 && dkState.direction === 'toDK') {
        var lastDk = dkState.stops[dkState.stops.length - 1];
        arrivedName = lastDk.name;
        arrivedFlag = '';
        arrivedTime = lastDk.rtArr || lastDk.arrPlanned || lastDk.arr || arrivedTime;
      }
      var arrivedTimeHtml = arrivedTime ? '<div class="ft-arrived-time">Ankom ' + arrivedTime + '</div>' : '';
      infoHtml += '<div class="ft-next-card">'
        + '<div class="ft-next-label">TÅGET HAR ANKOMMIT' + arrivedFlag + '</div>'
        + '<div class="ft-next-station">' + arrivedName + '</div>'
        + arrivedTimeHtml
        + '</div>';
    }

    if (!dkCardUsed && !trainCompleted && nextIdx >= 0) {
      var next = stops[nextIdx];
      var arrTime = next.arrival ? (next.arrival.estimated || next.arrival.planned) : '';
      var depTime = next.departure ? (next.departure.estimated || next.departure.planned) : '';
      var trackStr = next.track || '—';

      var delayHtml = '';
      if (delayMin > 0) {
        delayHtml = '<span class="ft-delay-text ft-delay-' + (delayMin >= 6 ? 'major' : 'minor') + '">+' + delayMin + ' min</span>';
      }

      // SE departed hold — show "AVGÅTT FRÅN" with count-up
      if (next._phase === 'departed') {
        var seDepartedTime = next.departure ? next.departure.actual : depTime;
        infoHtml += '<div class="ft-next-card ft-card-departed">'
          + '<div class="ft-next-label">AVGÅTT FRÅN</div>'
          + '<div class="ft-next-station">' + stationName(next.station) + '</div>'
          + '<div class="ft-countdown-row" data-target="' + seDepartedTime + '" data-direction="up">'
          + '<span class="ft-countdown-label">AVGÅNG FÖR</span>'
          + '<span class="ft-countdown-value" id="ftCountdown">0:00</span>'
          + '</div>'
          + '<div class="ft-detail-row">'
          + '<div class="ft-track-circle"><span class="ft-track-nr">' + trackStr + '</span><span class="ft-track-label">SPÅR</span></div>'
          + '<div class="ft-times">'
          + (depTime ? '<div class="ft-time-box"><span class="ft-time-label">AVGÅNG</span><span class="ft-time-value">' + depTime + '</span></div>' : '')
          + '</div>'
          + '</div>'
          + '</div>';
      } else if (next._phase === 'atStation') {
      // SE at station — arrived but not yet departed
      var seArrActual = next.arrival ? (next.arrival.actual || next.arrival.estimated || next.arrival.planned) : '';
      var seDepPlanned = next.departure ? (next.departure.estimated || next.departure.planned) : '';
      infoHtml += '<div class="ft-next-card ft-card-atstation">'
        + '<div class="ft-next-label">VID STATION ' + delayHtml + '</div>'
        + '<div class="ft-next-station">' + stationName(next.station) + '</div>'
        + '<div class="ft-countdown-row" data-target="' + seDepPlanned + '">'
        + '<span class="ft-countdown-label">AVGÅNG OM</span>'
        + '<span class="ft-countdown-value" id="ftCountdown">--:--</span>'
        + '</div>'
        + '<div class="ft-detail-row">'
        + '<div class="ft-track-circle"><span class="ft-track-nr">' + trackStr + '</span><span class="ft-track-label">SPÅR</span></div>'
        + '<div class="ft-times">'
        + (seArrActual ? '<div class="ft-time-box"><span class="ft-time-label">ANKOMST</span><span class="ft-time-value">' + seArrActual + '</span></div>' : '')
        + (seDepPlanned ? '<div class="ft-time-box"><span class="ft-time-label">AVGÅNG</span><span class="ft-time-value">' + seDepPlanned + '</span></div>' : '')
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

      infoHtml += '<div class="ft-next-card">'
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
      var arrPlanned = s.arrival ? (s.arrival.planned || '') : '';
      var arrRt = s.arrival ? (s.arrival.actual || s.arrival.estimated || '') : '';
      var depPlanned = s.departure ? (s.departure.planned || '') : '';
      var depRt = s.departure ? (s.departure.actual || s.departure.estimated || '') : '';
      var seIsNext = (k === nextIdx) && !dkCardUsed;
      upcomingStops.push({
        station: stationName(s.station),
        arrPlanned: arrPlanned,
        arrRt: arrRt,
        depPlanned: depPlanned,
        depRt: depRt,
        passed: s.passed,
        isNext: seIsNext
      });
    }

    // Build Danish stop rows helper — returns array of { html, passed }
    function buildDkRows() {
      var rows = [];
      if (!dkState || !dkState.stops.length) return rows;
      var hasTrack = false;
      for (var ti = 0; ti < dkState.stops.length; ti++) {
        if (dkState.stops[ti].track) { hasTrack = true; break; }
      }
      var colSpan = hasTrack ? '4' : '3';
      var liveSrc = dkState.source === 'live' ? ' <span class="ft-dk-live">LIVE</span>' : '';
      // DK separator removed (v4.25.57)
      for (var di = 0; di < dkState.stops.length; di++) {
        var dkStop = dkState.stops[di];
        var dkIsNext = dkStop._isNext && dkCardUsed;
        var rowCls = dkStop._passed ? 'ft-stop-passed ft-dk-stop' : (dkIsNext ? 'ft-stop-next ft-dk-stop' : 'ft-dk-stop');
        var chk = dkStop._passed ? '<span class="ft-check">✓</span> ' : '';
        var mrk = dkIsNext ? '<span class="ft-marker">▶</span> ' : '';

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

        rows.push({
          passed: !!dkStop._passed,
          html: '<tr class="' + rowCls + '">'
            + '<td>' + chk + mrk + '<span class="ft-scroll-wrap"><span class="ft-scroll-text">' + dkStop.name + '</span></span></td>'
            + '<td>' + arrCell + '</td>'
            + '<td>' + depCell + '</td>'
            + trackCell
            + '</tr>'
        });
      }
      return rows;
    }

    // Check if DK rows have track data (affects column count)
    var comboHasTrack = false;
    if (dkState && dkState.stops) {
      for (var cti = 0; cti < dkState.stops.length; cti++) {
        if (dkState.stops[cti].track) { comboHasTrack = true; break; }
      }
    }
    var comboColSpan = comboHasTrack ? '4' : '3';

    // Build Swedish stop rows helper — returns array of { html, passed }
    function buildSeRows() {
      var rows = [];
      var hasDk = dkState && dkState.stops.length > 0;
      // SE separator removed (v4.25.57)
      for (var m = 0; m < upcomingStops.length; m++) {
        var st = upcomingStops[m];
        var rowClass = st.passed ? 'ft-stop-passed' : '';
        if (st.isNext) rowClass = 'ft-stop-next';
        var check = st.passed ? '<span class="ft-check">✓</span> ' : '';
        var marker = st.isNext ? '<span class="ft-marker">▶</span> ' : '';

        // Arrival cell: show realtime if different from planned
        var arrCell = '';
        if (st.arrRt && st.arrPlanned && st.arrRt !== st.arrPlanned) {
          arrCell = '<span class="ft-dk-planned">' + st.arrPlanned + '</span> <span class="ft-dk-rt">' + st.arrRt + '</span>';
        } else {
          arrCell = st.arrRt || st.arrPlanned || '';
        }

        // Departure cell: show realtime if different from planned
        var depCell = '';
        if (st.depRt && st.depPlanned && st.depRt !== st.depPlanned) {
          depCell = '<span class="ft-dk-planned">' + st.depPlanned + '</span> <span class="ft-dk-rt">' + st.depRt + '</span>';
        } else {
          depCell = st.depRt || st.depPlanned || '';
        }

        rows.push({
          passed: st.passed,
          html: '<tr class="' + rowClass + '">'
            + '<td>' + check + marker + '<span class="ft-scroll-wrap"><span class="ft-scroll-text">' + st.station + '</span></span></td>'
            + '<td>' + arrCell + '</td>'
            + '<td>' + depCell + '</td>'
            + (comboHasTrack ? '<td></td>' : '')
            + '</tr>'
        });
      }
      return rows;
    }

    tableHtml += '<div class="ft-stops-card">'
      + '<table class="ft-stops-table"><thead><tr>'
      + '<th>Station</th><th>Ank.</th><th>Avg.</th>'
      + (comboHasTrack ? '<th>Spår</th>' : '')
      + '</tr></thead><tbody>';

    // Order: DK first for trains FROM Denmark, SE first for trains TO Denmark
    var allRowObjs;
    if (dkState && dkState.direction === 'toSE') {
      allRowObjs = buildDkRows().concat(buildSeRows());
    } else {
      allRowObjs = buildSeRows().concat(buildDkRows());
    }

    // --- Collapse old passed stations (keep last 2 visible) ---
    var passedIndices = [];
    for (var pi = 0; pi < allRowObjs.length; pi++) {
      if (allRowObjs[pi].passed) passedIndices.push(pi);
    }
    var hiddenCount = 0;
    if (passedIndices.length > 2) {
      var hideUpTo = passedIndices[passedIndices.length - 2];
      for (var hi = 0; hi < passedIndices.length - 2; hi++) {
        allRowObjs[passedIndices[hi]].collapsed = true;
        hiddenCount++;
      }
    }

    // Build final HTML
    var finalRows = '';
    if (hiddenCount > 0) {
      var toggleIcon = _passedExpanded ? '▾' : '▸';
      var toggleText = _passedExpanded
        ? 'Dölj tidigare'
        : hiddenCount + ' tidigare station' + (hiddenCount > 1 ? 'er' : '');
      finalRows += '<tr class="ft-toggle-row" onclick="window._ftTogglePassed()">'
        + '<td colspan="' + comboColSpan + '">'
        + '<span class="ft-toggle-icon">' + toggleIcon + '</span> '
        + '<span class="ft-toggle-text">' + toggleText + '</span>'
        + '</td></tr>';
    }
    for (var ri = 0; ri < allRowObjs.length; ri++) {
      if (allRowObjs[ri].collapsed) {
        var display = _passedExpanded ? 'table-row' : 'none';
        finalRows += allRowObjs[ri].html.replace('<tr class="', '<tr style="display:' + display + '" class="ft-collapsed-row ');
      } else {
        finalRows += allRowObjs[ri].html;
      }
    }

    tableHtml += finalRows + '</tbody></table></div>';

    contentEl.innerHTML = '<div class="ft-sticky-info">' + infoHtml + '</div>'
      + '<div class="ft-stops-scroll">' + tableHtml + '</div>';

    startCountdown();
    detectScrollOverflows();
    scrollToNextStop();
    startClockTimer();
  }

  // --- Toggle collapsed passed stations ---
  var _passedExpanded = false;
  window._ftTogglePassed = function() {
    _passedExpanded = !_passedExpanded;
    var rows = document.querySelectorAll('.ft-collapsed-row');
    var toggleRow = document.querySelector('.ft-toggle-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].style.display = _passedExpanded ? 'table-row' : 'none';
    }
    if (toggleRow) {
      var icon = toggleRow.querySelector('.ft-toggle-icon');
      var text = toggleRow.querySelector('.ft-toggle-text');
      if (icon) icon.textContent = _passedExpanded ? '▾' : '▸';
      if (text) text.textContent = _passedExpanded
        ? 'Dölj tidigare'
        : rows.length + ' tidigare station' + (rows.length > 1 ? 'er' : '');
    }
  };

  /**
   * Auto-scroll the stops table so the marked station (.ft-stop-next)
   * appears as the 3rd visible data row (2 data rows above it shown).
   * Directly calculates desired position using getBoundingClientRect.
   */
  function scrollToNextStop() {
    setTimeout(function() {
      var scrollContainer = document.querySelector('.ft-stops-scroll');
      if (!scrollContainer) return;
      var nextRow = scrollContainer.querySelector('.ft-stop-next');
      if (!nextRow) return;

      var thead = scrollContainer.querySelector('thead');
      var theadH = thead ? thead.getBoundingClientRect().height : 0;
      var rowH = nextRow.getBoundingClientRect().height;
      var containerRect = scrollContainer.getBoundingClientRect();
      var nextRect = nextRow.getBoundingClientRect();

      // Place nextRow at 3rd data-row position = theadH + 2 * rowH below container top
      var desiredOffset = theadH + 2 * rowH;
      var currentOffset = nextRect.top - containerRect.top;
      var delta = currentOffset - desiredOffset;
      scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop + delta);
    }, 150);
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
      // Update mini timetable if LA tab is active
      if (activeTopbarTab === 'la') {
        renderMiniTimetable();
      }
      // Check KH toast regardless of active tab (may pulse LA tab)
      checkKhLaToast();
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
        // Don't mark passed on arrival — wait for departure
      } else if (a.ActivityType === 'Avgang') {
        stop.departure = timeObj;
        if (actual) stop.passed = true;
      }
    }

    var stops = stopsOrder.map(function(loc) { return stopsMap[loc]; });
    var firstStation = stops.length > 0 ? stops[0].station : '';
    var lastStation = stops.length > 0 ? stops[stops.length - 1].station : '';

    // Last station (terminus) has only arrival, no departure — mark passed on actual arrival
    var terminus = stops.length > 0 ? stops[stops.length - 1] : null;
    if (terminus && !terminus.departure && terminus.arrival && terminus.arrival.actual) {
      terminus.passed = true;
    }

    var nextIdx = -1;
    for (var j = 0; j < stops.length; j++) {
      if (!stops[j].passed) { nextIdx = j; break; }
    }

    // Detect atStation: train arrived but not yet departed
    if (nextIdx >= 0) {
      var atStop = stops[nextIdx];
      if (atStop.arrival && atStop.arrival.actual &&
          atStop.departure && (!atStop.departure.actual)) {
        atStop._phase = 'atStation';
      }
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
  // LIVE CLOCK  (HH:MM:SS in the info card)
  // ==========================================

  function updateClock() {
    var el = document.querySelector('.ft-live-clock');
    if (!el) return;
    var now = new Date();
    var hh = (now.getHours() < 10 ? '0' : '') + now.getHours();
    var mm = (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    var ss = (now.getSeconds() < 10 ? '0' : '') + now.getSeconds();
    el.textContent = hh + ':' + mm + ':' + ss;
  }

  /**
   * Inject the clock element (and LIVE badge below it) into the first .ft-next-card.
   * Called after rendering content.
   */
  function injectClock() {
    var card = document.querySelector('.ft-next-card');
    if (!card) return;
    if (card.querySelector('.ft-clock-wrapper')) return;

    // Create wrapper for clock + optional LIVE badge
    var wrapper = document.createElement('div');
    wrapper.className = 'ft-clock-wrapper';

    var clockSpan = document.createElement('span');
    clockSpan.className = 'ft-live-clock';
    wrapper.appendChild(clockSpan);

    // Add LIVE badge if card has live DK data
    if (card.getAttribute('data-is-live') === '1') {
      var liveBadge = document.createElement('span');
      liveBadge.className = 'ft-dk-live';
      liveBadge.textContent = 'LIVE';
      wrapper.appendChild(liveBadge);
    }

    card.appendChild(wrapper);
  }

  function startClockTimer() {
    stopClockTimer();
    injectClock();
    updateClock();
    clockTimer = setInterval(updateClock, 1000);
  }

  function stopClockTimer() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }

  // ==========================================
  // COUNTDOWN
  // ==========================================

  /**
   * Detect scroll-wrap elements that overflow and add ft-overflows class.
   * Called after rendering to enable scroll animation only where needed.
   */
  function detectScrollOverflows() {
    var wraps = document.querySelectorAll('.ft-scroll-wrap');
    for (var i = 0; i < wraps.length; i++) {
      var wrap = wraps[i];
      var text = wrap.querySelector('.ft-scroll-text');
      if (text && text.scrollWidth > wrap.clientWidth + 2) {
        wrap.classList.add('ft-overflows');
      } else {
        wrap.classList.remove('ft-overflows');
      }
    }
  }

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

    // Set header title to route (or fallback)
    updateHeaderRoute();

    if (followedTrain) {
      updateTopbar();
      // Restore correct tab view
      showTabContent(activeTopbarTab);
      if (activeTopbarTab === 'la') {
        renderFtLa();
      } else if (activeTopbarTab === 'tko') {
        renderFtTko();
      } else if (nextStationData) {
        renderPage();
      } else {
        showLoading();
      }
    } else {
      // No train followed — show prompt
      if (topbarEl) topbarEl.innerHTML = '';
      showTabContent('timetable');
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
    // Restore header title when leaving the train follow page
    restoreHeader();
    // Clear LA + TKØ content to free memory
    var laContent = document.getElementById('ftLaContent');
    if (laContent) laContent.innerHTML = '';
    var tkoContent = document.getElementById('ftTkoContent');
    if (tkoContent) tkoContent.innerHTML = '';
    // Keep polling in background — button still needs updates
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
    start: function(nr) { startFollowing(nr); },
    stop: function() { stopFollowing(false); },
    getFollowed: function() { return followedTrain; },
    getRouteText: function() { return getRouteText(); },
    getNextStationData: function() { return nextStationData; },
    getDkStopsData: function() { return dkStopsData; },
    getActiveTab: function() { return activeTopbarTab; },
    onStopCallback: null // set by auto-follow engine
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
