/**
 * ui-realtime.js - Live Train Realtime Data & Badge Flip Animations
 * Fetches delay info from Trafikverket every 30s, updates train badges,
 * and handles flip animations for both train badges and rast (break) badges.
 *
 * Dependencies (from ui.js): getDateKey
 * Dependencies (globals): TRAFIKVERKET_API_KEY, TRAFIKVERKET_PROXY_URL, currentDate
 */

// ==========================================
// LIVE TRAIN REALTIME DATA
// Fetches delay info from Trafikverket every 30s
// and updates .train-live-badge elements
// ==========================================

// Store: trainNr → { delayMin: number, canceled: boolean, status: 'ontime'|'minor'|'major', delayText: string }
let trainRealtimeStore = {};
// Store: trainNr → { delayMin, status, delayText } specifically for destination station arrival
let trainDestStore = {};
let trainRealtimeTimer = null;

// Map station display names (from dagvy toStation) → Trafikverket LocationSignature
const STATION_NAME_TO_SIG = {
  'malmö c': 'Mc', 'malmö': 'Mc', 'mal': 'Mc',
  'hyllie': 'Hie',
  'triangeln': 'Tri',
  'lund c': 'Lu', 'lund': 'Lu',
  'hässleholm c': 'Hm', 'hässleholm': 'Hm',
  'helsingborg c': 'Hb', 'helsingborg': 'Hb',
  'kristianstad c': 'Cr', 'kristianstad': 'Cr',
  'karlskrona c': 'Ck', 'karlskrona': 'Ck',
  'kalmar c': 'Kac', 'kalmar': 'Kac',
  'halmstad c': 'Hd', 'halmstad': 'Hd',
  'göteborg c': 'G', 'göteborg': 'G',
  'växjö': 'Vö', 'alvesta': 'Av',
  'landskrona': 'Lkr', 'eslöv': 'El',
  'ramlösa': 'Rml', 'kävlinge': 'Käv',
  'höör': 'Hör', 'osby': 'Osb',
  'ängelholm': 'Äh', 'ängelholm c': 'Äh',
  'hassleholm c': 'Hm', 'hassleholm': 'Hm'
};

/**
 * Resolve a station display name to a Trafikverket LocationSignature.
 * E.g. "Malmö C" → "Mc", "Hässleholm" → "Hm"
 */
function stationNameToSig(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return STATION_NAME_TO_SIG[lower] || null;
}

/**
 * Collect unique train numbers from all visible .train-live-badge elements
 */
function collectVisibleTrainNumbers() {
  const badges = document.querySelectorAll('.train-live-badge[data-train-nr]');
  const numbers = new Set();
  badges.forEach(b => {
    const nr = b.getAttribute('data-train-nr');
    if (nr) numbers.add(nr);
  });
  return Array.from(numbers);
}

/**
 * Collect destination stations for finished trains.
 * Returns Map: trainNr → LocationSignature (e.g. "1071" → "Mc")
 */
function collectFinishedTrainDests() {
  const destMap = {};
  const badges = document.querySelectorAll('.train-live-badge[data-finished="1"]');
  badges.forEach(b => {
    const nr = b.getAttribute('data-train-nr');
    const dest = b.getAttribute('data-dest-station');
    if (nr && dest) {
      const sig = stationNameToSig(dest);
      if (sig) destMap[nr] = sig;
    }
  });
  return destMap;
}

/**
 * Fetch realtime train data from Trafikverket for a list of train numbers.
 * Queries ALL stations along each train's route and picks the most relevant
 * announcement per train:
 *   1. Next upcoming station (not yet passed) — shows current delay estimate
 *   2. Most recently passed station — shows last known actual delay
 *   3. Canceled announcement — always prioritized
 */
async function fetchTrainRealtimeData(trainNumbers) {
  if (!trainNumbers.length) return;
  if (typeof TRAFIKVERKET_API_KEY === 'undefined' || typeof TRAFIKVERKET_PROXY_URL === 'undefined') return;

  // Build OR filter for all train numbers
  const orParts = trainNumbers.map(nr =>
    '<EQ name="AdvertisedTrainIdent" value="' + nr + '" />'
  ).join('');

  const xml = '<REQUEST>'
    + '<LOGIN authenticationkey="' + TRAFIKVERKET_API_KEY + '" />'
    + '<QUERY objecttype="TrainAnnouncement" schemaversion="1.9" orderby="AdvertisedTimeAtLocation">'
    + '<FILTER>'
    + '<AND>'
    + '<OR>' + orParts + '</OR>'
    + '<EQ name="Advertised" value="true" />'
    + '<GT name="AdvertisedTimeAtLocation" value="$dateadd(-02:00:00)" />'
    + '<LT name="AdvertisedTimeAtLocation" value="$dateadd(08:00:00)" />'
    + '</AND>'
    + '</FILTER>'
    + '<INCLUDE>AdvertisedTrainIdent</INCLUDE>'
    + '<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>'
    + '<INCLUDE>EstimatedTimeAtLocation</INCLUDE>'
    + '<INCLUDE>TimeAtLocation</INCLUDE>'
    + '<INCLUDE>Canceled</INCLUDE>'
    + '<INCLUDE>ActivityType</INCLUDE>'
    + '<INCLUDE>LocationSignature</INCLUDE>'
    + '</QUERY>'
    + '</REQUEST>';

  try {
    const response = await fetch(TRAFIKVERKET_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();

    const announcements = (data && data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0])
      ? data.RESPONSE.RESULT[0].TrainAnnouncement || []
      : [];

    // Group announcements by train number
    const groupedByTrain = {};
    for (const a of announcements) {
      const nr = a.AdvertisedTrainIdent;
      if (!nr) continue;
      if (!groupedByTrain[nr]) groupedByTrain[nr] = [];
      groupedByTrain[nr].push(a);
    }

    const byTrain = {};

    // For each train, find the best announcement
    for (const nr of Object.keys(groupedByTrain)) {
      const anns = groupedByTrain[nr];
      let bestUpcoming = null;   // next station not yet passed
      let bestRecent = null;     // most recently passed station
      let isCanceled = false;

      for (const a of anns) {
        if (a.Canceled === true) { isCanceled = true; break; }

        const advTime = new Date(a.AdvertisedTimeAtLocation);
        const estTime = a.EstimatedTimeAtLocation ? new Date(a.EstimatedTimeAtLocation) : null;
        const actTime = a.TimeAtLocation ? new Date(a.TimeAtLocation) : null;

        if (!actTime) {
          // Not yet passed — upcoming station
          if (!bestUpcoming || advTime < bestUpcoming.advTime) {
            bestUpcoming = { advTime, estTime, actTime };
          }
        } else {
          // Already passed — recent station
          if (!bestRecent || actTime > bestRecent.actTime) {
            bestRecent = { advTime, estTime, actTime };
          }
        }
      }

      if (isCanceled) {
        byTrain[nr] = { delayMin: 999, canceled: true };
        continue;
      }

      // Prefer upcoming (estimated delay at next stop), fallback to most recently passed
      const pick = bestUpcoming || bestRecent;
      if (!pick) continue;

      let delayMin = 0;
      if (pick.actTime) {
        delayMin = Math.round((pick.actTime - pick.advTime) / 60000);
      } else if (pick.estTime) {
        delayMin = Math.round((pick.estTime - pick.advTime) / 60000);
      }

      byTrain[nr] = { delayMin, canceled: false };
    }

    // Update the store
    for (const nr of trainNumbers) {
      if (byTrain[nr]) {
        const t = byTrain[nr];
        let status = 'ontime';
        let delayText = 'I tid';

        if (t.canceled) {
          status = 'major';
          delayText = 'Inställt';
        } else if (t.delayMin >= 6) {
          status = 'major';
          delayText = '+' + t.delayMin + ' min';
        } else if (t.delayMin >= 1) {
          status = 'minor';
          delayText = '+' + t.delayMin + ' min';
        } else if (t.delayMin < 0) {
          status = 'ontime';
          delayText = t.delayMin + ' min';
        }

        trainRealtimeStore[nr] = { delayMin: t.delayMin, canceled: t.canceled, status, delayText };
      } else {
        // No data found — keep as unknown / default green
        if (!trainRealtimeStore[nr]) {
          trainRealtimeStore[nr] = { delayMin: 0, canceled: false, status: 'ontime', delayText: 'I tid' };
        }
      }
    }

    // === Destination-specific delay for finished trains ===
    const finishedDests = collectFinishedTrainDests();
    for (const nr of Object.keys(finishedDests)) {
      const destSig = finishedDests[nr];
      const anns = groupedByTrain[nr];
      if (!anns) continue;

      // Find arrival announcement at the destination station
      let destAnn = null;
      for (const a of anns) {
        if (a.LocationSignature === destSig && a.ActivityType === 'Ankomst') {
          destAnn = a;
          break;
        }
      }
      // Fallback: try departure at dest station (some stations only have departure)
      if (!destAnn) {
        for (const a of anns) {
          if (a.LocationSignature === destSig) {
            destAnn = a;
            break;
          }
        }
      }

      if (!destAnn) continue;

      if (destAnn.Canceled === true) {
        trainDestStore[nr] = { delayMin: 999, status: 'major', delayText: 'Inställt' };
        continue;
      }

      const advTime = new Date(destAnn.AdvertisedTimeAtLocation);
      const estTime = destAnn.EstimatedTimeAtLocation ? new Date(destAnn.EstimatedTimeAtLocation) : null;
      const actTime = destAnn.TimeAtLocation ? new Date(destAnn.TimeAtLocation) : null;

      let delayMin = 0;
      if (actTime) {
        delayMin = Math.round((actTime - advTime) / 60000);
      } else if (estTime) {
        delayMin = Math.round((estTime - advTime) / 60000);
      }

      let status = 'ontime';
      let delayText = 'I tid';
      if (delayMin >= 6) {
        status = 'major';
        delayText = '+' + delayMin + ' min';
      } else if (delayMin >= 1) {
        status = 'minor';
        delayText = '+' + delayMin + ' min';
      } else if (delayMin < 0) {
        status = 'ontime';
        delayText = delayMin + ' min';
      }

      trainDestStore[nr] = { delayMin, status, delayText };
    }

    // Update all badges in the DOM
    updateTrainBadgesDOM();

  } catch (err) {
    console.log('Train realtime fetch error: ' + err.message);
  }
}

/**
 * Update all .train-live-badge elements with current realtime data.
 * Finished badges use trainDestStore (destination-specific delay) if available,
 * falling back to "Ank HH:MM" from data-ank attribute.
 */
function updateTrainBadgesDOM() {
  let hasData = false;
  const badges = document.querySelectorAll('.train-live-badge[data-train-nr]');
  badges.forEach(badge => {
    const nr = badge.getAttribute('data-train-nr');
    const isFinished = badge.getAttribute('data-finished') === '1';

    if (isFinished) {
      // Finished badge: prefer destination-specific delay from trainDestStore
      const destInfo = trainDestStore[nr];
      if (destInfo) {
        hasData = true;
        badge.setAttribute('data-dest-status', destInfo.status);
        const delayEl = badge.querySelector('.train-live-delay');
        if (delayEl) {
          delayEl.textContent = destInfo.delayText;
        }
      }
      // If no destInfo, keep the fallback "Ank HH:MM" set during render
      return;
    }

    // Active badge: use general trainRealtimeStore
    const info = trainRealtimeStore[nr];
    if (!info) return;

    hasData = true;
    badge.setAttribute('data-status', info.status);

    // Update delay text element
    const delayEl = badge.querySelector('.train-live-delay');
    if (delayEl) {
      delayEl.textContent = info.delayText;
    }
  });

  // Start flip timer once we have realtime data
  if (hasData && !trainFlipTimer) {
    startTrainFlipTimer();
  }
}

/**
 * Start the realtime train polling (every 30 seconds)
 * Called after renderEmployees and whenever the schedule page is shown
 */
function startTrainRealtimePolling() {
  // Stop any existing timer
  stopTrainRealtimePolling();

  // Only poll if we're viewing today
  const todayCheck = getDateKey(currentDate) === getDateKey(new Date());
  if (!todayCheck) return;

  // Immediate first fetch
  const numbers = collectVisibleTrainNumbers();
  if (numbers.length > 0) {
    fetchTrainRealtimeData(numbers);
  }

  // Poll every 30 seconds
  trainRealtimeTimer = setInterval(() => {
    const nums = collectVisibleTrainNumbers();
    if (nums.length > 0) {
      fetchTrainRealtimeData(nums);
    }
  }, 30000);
}

/**
 * Stop the realtime polling and flip timer
 */
function stopTrainRealtimePolling() {
  if (trainRealtimeTimer) {
    clearInterval(trainRealtimeTimer);
    trainRealtimeTimer = null;
  }
  stopTrainFlipTimer();
}


// ==========================================
// TRAIN BADGE FLIP ANIMATION
// Flips between train number and delay every 5s
// ==========================================

let trainFlipTimer = null;
let trainFlipShowingDelay = false;

/**
 * Toggle all train badges between showing train number and delay text
 * Finished badges always flip (Sista tåg ↔ Ank HH:MM)
 */
function flipTrainBadges() {
  trainFlipShowingDelay = !trainFlipShowingDelay;
  const badges = document.querySelectorAll('.train-live-badge[data-train-nr]');
  badges.forEach(badge => {
    const isFinished = badge.getAttribute('data-finished') === '1';
    if (isFinished) {
      // Finished badges always flip
      badge.classList.toggle('show-delay', trainFlipShowingDelay);
      return;
    }
    const nr = badge.getAttribute('data-train-nr');
    const info = trainRealtimeStore[nr];
    // Only flip if we have realtime data
    if (!info) return;
    badge.classList.toggle('show-delay', trainFlipShowingDelay);
  });
}

/**
 * Start the 5-second flip timer
 */
function startTrainFlipTimer() {
  stopTrainFlipTimer();
  trainFlipShowingDelay = false;
  trainFlipTimer = setInterval(flipTrainBadges, 5000);
}

/**
 * Stop the flip timer and reset to showing train numbers
 */
function stopTrainFlipTimer() {
  if (trainFlipTimer) {
    clearInterval(trainFlipTimer);
    trainFlipTimer = null;
  }
  trainFlipShowingDelay = false;
  // Reset all badges to show train number
  const badges = document.querySelectorAll('.train-live-badge.show-delay');
  badges.forEach(b => b.classList.remove('show-delay'));
}


// ==========================================
// RAST (BREAK) FLIP ANIMATION
// Flips between rast time and city every 5s
// ==========================================

let rastFlipTimer = null;
let rastFlipShowingCity = false;

/**
 * Toggle all rast-flip elements between showing time and city
 */
function flipRastBadges() {
  rastFlipShowingCity = !rastFlipShowingCity;
  const flips = document.querySelectorAll('.rast-flip');
  flips.forEach(el => {
    // Only flip if we have a city to show
    const city = el.getAttribute('data-rast-city');
    if (!city) return;
    el.classList.toggle('show-city', rastFlipShowingCity);
  });
}

/**
 * Start the 5-second rast flip timer
 */
function startRastFlipTimer() {
  if (rastFlipTimer) return; // Already running
  rastFlipShowingCity = false;
  rastFlipTimer = setInterval(flipRastBadges, 5000);
}

/**
 * Stop the rast flip timer and reset to showing time
 */
function stopRastFlipTimer() {
  if (rastFlipTimer) {
    clearInterval(rastFlipTimer);
    rastFlipTimer = null;
  }
  rastFlipShowingCity = false;
  const flips = document.querySelectorAll('.rast-flip.show-city');
  flips.forEach(el => el.classList.remove('show-city'));
}
