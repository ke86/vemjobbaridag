/**
 * firebase.js - Firebase Integration
 * Handles all Firebase/Firestore operations
 */

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Data storage objects
const registeredEmployees = {};
const employeesData = {};

// Color index for assigning colors to new employees
let colorIndex = 0;

// Single-doc schedule listener state (for quota optimization)
let currentScheduleUnsubscribe = null;
let currentScheduleDateKey = null;

// Sync icon element reference
let syncIconEl = null;
let syncTimeout = null;

/**
 * Update sync icon status
 * @param {'connected'|'syncing'|'offline'} status
 */
function updateSyncStatus(status) {
  if (!syncIconEl) {
    syncIconEl = document.getElementById('syncIcon');
  }
  if (!syncIconEl) return;

  // Clear any pending timeout
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  // Remove all status classes
  syncIconEl.classList.remove('connected', 'syncing', 'offline');

  // Add the new status class
  syncIconEl.classList.add(status);

  // If syncing, revert to connected after 1.5 seconds
  if (status === 'syncing') {
    syncTimeout = setTimeout(() => {
      syncIconEl.classList.remove('syncing');
      syncIconEl.classList.add('connected');
    }, 1500);
  }
}

/**
 * Get next available color for new employee
 */
function getNextColor() {
  const color = employeeColors[colorIndex % employeeColors.length];
  colorIndex++;
  return color;
}

// ---- Schedule + employees cache (localStorage) ----
var SCHEDULE_CACHE_KEY = 'schedule_cache';
var SCHEDULE_CACHE_MAX_AGE_DAYS = 3;

/**
 * Save employees + schedules to localStorage cache.
 */
function saveScheduleToCache() {
  try {
    var payload = {
      savedAt: new Date().toISOString(),
      employees: registeredEmployees,
      schedules: employeesData
    };
    localStorage.setItem(SCHEDULE_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Schedule cache save failed:', e.message);
  }
}

/**
 * Load employees + schedules from localStorage cache.
 * Returns { savedAt, employees, schedules } or null.
 */
function loadScheduleFromCache() {
  try {
    var raw = localStorage.getItem(SCHEDULE_CACHE_KEY);
    if (!raw) return null;
    var payload = JSON.parse(raw);
    if (!payload || !payload.savedAt || !payload.employees) return null;
    var ageMs = Date.now() - new Date(payload.savedAt).getTime();
    var maxMs = SCHEDULE_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    if (ageMs > maxMs) {
      localStorage.removeItem(SCHEDULE_CACHE_KEY);
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Remove schedule cache if older than max age.
 */
function cleanOldScheduleCache() {
  try {
    var raw = localStorage.getItem(SCHEDULE_CACHE_KEY);
    if (!raw) return;
    var payload = JSON.parse(raw);
    if (!payload || !payload.savedAt) {
      localStorage.removeItem(SCHEDULE_CACHE_KEY);
      return;
    }
    var ageMs = Date.now() - new Date(payload.savedAt).getTime();
    if (ageMs > SCHEDULE_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SCHEDULE_CACHE_KEY);
    }
  } catch (e) {
    localStorage.removeItem(SCHEDULE_CACHE_KEY);
  }
}

// ---- Dagvy auto-check / manual sync ----
// Track last successful dagvy fetch per time-window to avoid repeated calls
let dagvyLastCheckWindow = null; // e.g. "2026-02-13_06" or "2026-02-13_12"
let dagvyAutoCheckTimer = null;

/**
 * Determine current time-window key (used for dedup).
 * Returns e.g. "2026-02-13_06" if hour is 06 or 07, "2026-02-13_12" if 12 or 13, else null.
 */
function dagvyWindowKey() {
  var now = new Date();
  var h = now.getHours();
  var d = now.toISOString().slice(0, 10); // YYYY-MM-DD
  if (h === 6 || h === 7) return d + '_06';
  if (h === 12 || h === 13) return d + '_12';
  return null;
}

/**
 * Check if an automatic dagvy refresh should run.
 * Returns true if we're inside the 06–07 or 12–13 window AND haven't fetched this window yet.
 */
function shouldAutoCheckDagvy() {
  var key = dagvyWindowKey();
  if (!key) return false;
  return key !== dagvyLastCheckWindow;
}

/**
 * Fetch all dagvy docs from Firebase (one-shot getDocs).
 * Replaces the old onSnapshot listener to save quota.
 * @param {string} source - descriptive label for logging ('startup'|'auto'|'manual')
 */
async function fetchDagvyFromFirebase(source) {
  try {
    console.log('[DAGVY-SYNC] Fetching from Firebase (' + source + ')…');

    // Smart merge: remember which persons existed before this fetch
    var previousNames = {};
    if (typeof dagvyAllData !== 'undefined') {
      for (var pn in dagvyAllData) {
        if (dagvyAllData.hasOwnProperty(pn)) {
          previousNames[pn] = true;
        }
      }
    }

    var snapshot = await db.collection('dagvy').get();
    var latestScrapedAt = null;
    var newNames = {};

    snapshot.forEach(function(doc) {
      var empName = doc.id;
      var dagvyData = doc.data();

      // Clear any previous fromPrevious flag on fresh data
      delete dagvyData.fromPrevious;

      if (dagvyData.scrapedAt) {
        if (!latestScrapedAt || dagvyData.scrapedAt > latestScrapedAt) {
          latestScrapedAt = dagvyData.scrapedAt;
        }
      }
      if (typeof dagvyAllData !== 'undefined' && typeof normalizeName === 'function') {
        var norm = normalizeName(empName);
        dagvyAllData[norm] = dagvyData;
        newNames[norm] = true;
      }
      if (typeof dagvyCache !== 'undefined' && typeof normalizeName === 'function') {
        dagvyCache[normalizeName(empName)] = { data: dagvyData, timestamp: Date.now() };
      }
      if (typeof applyDagvyToSchedule === 'function') {
        applyDagvyToSchedule(empName, dagvyData);
      }
    });

    // Smart merge: keep persons that existed before but are missing in this fetch
    var kept = [];
    for (var oldName in previousNames) {
      if (!newNames[oldName] && dagvyAllData[oldName]) {
        // Mark as kept from previous dagvy (don't overwrite, just flag)
        dagvyAllData[oldName].fromPrevious = true;
        kept.push(oldName);
        // Update dagvyCache so popup sees fromPrevious flag
        if (typeof dagvyCache !== 'undefined') {
          dagvyCache[oldName] = { data: dagvyAllData[oldName], timestamp: Date.now() };
        }
        // Re-apply so schedule stays correct
        if (typeof applyDagvyToSchedule === 'function') {
          applyDagvyToSchedule(oldName, dagvyAllData[oldName]);
        }
      }
    }
    if (kept.length > 0) {
      console.log('[DAGVY-SYNC] Smart merge: kept ' + kept.length + ' from previous dagvy:', kept.join(', '));
    }

    if (typeof updateDagvyTimestamp === 'function') {
      updateDagvyTimestamp(latestScrapedAt);
    }
    if (typeof saveDagvyToCache === 'function') {
      saveDagvyToCache();
    }

    // Mark this time-window as checked
    var wk = dagvyWindowKey();
    if (wk) dagvyLastCheckWindow = wk;

    console.log('[DAGVY-SYNC] Done (' + source + '): ' + snapshot.size + ' from Firebase + ' + kept.length + ' kept from previous');
    return snapshot.size;
  } catch (err) {
    console.error('[DAGVY-SYNC] Error (' + source + '):', err);
    throw err;
  }
}

/**
 * Start the interval that auto-checks dagvy at 06 and 12.
 * Checks every 10 minutes, but only fetches when inside the correct window.
 */
function startDagvyAutoCheck() {
  if (dagvyAutoCheckTimer) return; // already running
  dagvyAutoCheckTimer = setInterval(function() {
    if (shouldAutoCheckDagvy()) {
      fetchDagvyFromFirebase('auto');
    }
  }, 10 * 60 * 1000); // every 10 min
  console.log('[DAGVY-SYNC] Auto-check timer started (06:00 & 12:00 windows)');
}

/**
 * Manual dagvy sync triggered from hamburger menu button.
 * Always fetches regardless of time window.
 */
async function manualDagvySync() {
  var btn = document.getElementById('dagvySyncBtn');
  var icon = btn ? btn.querySelector('.icon') : null;
  try {
    if (icon) icon.textContent = '⏳';
    if (btn) btn.classList.add('syncing');
    var count = await fetchDagvyFromFirebase('manual');
    if (icon) icon.textContent = '✅';
    setTimeout(function() {
      if (icon) icon.textContent = '🔄';
      if (btn) btn.classList.remove('syncing');
    }, 2000);
  } catch (err) {
    if (icon) icon.textContent = '❌';
    setTimeout(function() {
      if (icon) icon.textContent = '🔄';
      if (btn) btn.classList.remove('syncing');
    }, 3000);
  }
}

/**
 * Load initial data from Firebase
 */
async function loadDataFromFirebase() {
  // Load employees
  const employeesSnapshot = await db.collection('employees').get();
  employeesSnapshot.forEach(doc => {
    registeredEmployees[doc.id] = doc.data();
  });

  // Load schedule data
  const scheduleSnapshot = await db.collection('schedules').get();
  scheduleSnapshot.forEach(doc => {
    employeesData[doc.id] = doc.data().shifts || [];
  });

  console.log('Data loaded from Firebase:', Object.keys(registeredEmployees).length, 'employees');
}

/**
 * Setup realtime listeners for automatic updates
 */
function setupRealtimeListeners() {
  // Track if initial load is done
  let employeesInitialLoad = true;
  let schedulesInitialLoad = true;

  try {
    // Load cached schedule + employees from localStorage (instant display before Firebase)
    cleanOldScheduleCache();
    var cachedSchedule = loadScheduleFromCache();
    if (cachedSchedule) {
      // Restore employees
      if (cachedSchedule.employees) {
        var empKeys = Object.keys(cachedSchedule.employees);
        for (var ei = 0; ei < empKeys.length; ei++) {
          registeredEmployees[empKeys[ei]] = cachedSchedule.employees[empKeys[ei]];
        }
      }
      // Restore schedules
      if (cachedSchedule.schedules) {
        var schKeys = Object.keys(cachedSchedule.schedules);
        for (var si = 0; si < schKeys.length; si++) {
          employeesData[schKeys[si]] = cachedSchedule.schedules[schKeys[si]];
        }
      }
      console.log('[SCHEDULE-CACHE] Loaded from cache (' +
        Object.keys(cachedSchedule.employees || {}).length + ' employees, ' +
        Object.keys(cachedSchedule.schedules || {}).length + ' schedule days, saved ' +
        cachedSchedule.savedAt + ')');
      // Render immediately from cache
      if (isLoggedIn && typeof renderEmployees === 'function') {
        renderEmployees();
        if (typeof renderPersonList === 'function') renderPersonList();
      }
    }

    // Listen for employee changes
    db.collection('employees').onSnapshot(
      { includeMetadataChanges: false },
      (snapshot) => {
        const hasChanges = snapshot.docChanges().length > 0;

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            registeredEmployees[change.doc.id] = change.doc.data();
          } else if (change.type === 'removed') {
            delete registeredEmployees[change.doc.id];
          }
        });

        // Show syncing animation (but not on initial load)
        if (hasChanges && !employeesInitialLoad && isLoggedIn) {
          updateSyncStatus('syncing');
        }
        employeesInitialLoad = false;

        // Re-render if logged in
        if (isLoggedIn) {
          renderEmployees();
          renderPersonList();
        }
      },
      (error) => {
        console.error('Employee listener error:', error);
        updateSyncStatus('offline');
      }
    );

    // Start single-doc schedule listener for current date (quota optimization)
    // Instead of listening to ALL schedule documents, we only listen to the current day's doc.
    // This reduces Firebase reads from ~180+ per reconnect to just 1.
    if (typeof getDateKey === 'function' && typeof currentDate !== 'undefined') {
      switchScheduleListener(getDateKey(currentDate));
    }

    // Load cached dagvy from localStorage (instant display before Firebase responds)
    if (typeof cleanOldDagvyCache === 'function') cleanOldDagvyCache();
    if (typeof loadDagvyFromCache === 'function') {
      var cached = loadDagvyFromCache();
      if (cached && cached.data) {
        var cacheKeys = Object.keys(cached.data);
        for (var ci = 0; ci < cacheKeys.length; ci++) {
          dagvyAllData[cacheKeys[ci]] = cached.data[cacheKeys[ci]];
          if (typeof dagvyCache !== 'undefined') {
            dagvyCache[cacheKeys[ci]] = { data: cached.data[cacheKeys[ci]], timestamp: Date.now() };
          }
          if (typeof applyDagvyToSchedule === 'function') {
            applyDagvyToSchedule(cacheKeys[ci], cached.data[cacheKeys[ci]]);
          }
        }
        if (cached.scrapedAt && typeof updateDagvyTimestamp === 'function') {
          updateDagvyTimestamp(cached.scrapedAt);
        }
        console.log('Dagvy loaded from cache (' + cacheKeys.length + ' employees, saved ' + cached.savedAt + ')');
      }
    }

    // Fetch dagvy once at startup (instead of realtime onSnapshot — saves reads)
    fetchDagvyFromFirebase('startup');

    // Start auto-check timer for dagvy (fetches at 06:00–07:59 and 12:00–13:59)
    startDagvyAutoCheck();

    console.log('Realtime listeners active - auto-sync enabled');
  } catch (error) {
    console.error('Failed to setup realtime listeners:', error);
    updateSyncStatus('offline');
  }

  // Monitor Firebase connection state
  setupConnectionMonitor();
}

/**
 * Monitor Firebase connection status
 */
function setupConnectionMonitor() {
  // Use Firestore's offline/online detection
  db.enableNetwork().then(() => {
    updateSyncStatus('connected');
  }).catch(() => {
    updateSyncStatus('offline');
  });

  // Also listen to browser online/offline events
  window.addEventListener('online', () => {
    db.enableNetwork().then(() => {
      updateSyncStatus('connected');
    });
  });

  window.addEventListener('offline', () => {
    updateSyncStatus('offline');
  });
}

/**
 * Switch the realtime schedule listener to a specific date.
 * Unsubscribes from the previous date's listener and creates a new one
 * for the given dateKey. This drastically reduces Firebase reads compared
 * to listening to the entire schedules collection.
 *
 * @param {string} dateKey - Date in format 'YYYY-MM-DD'
 */
function switchScheduleListener(dateKey) {
  // Skip if already listening to this date
  if (dateKey === currentScheduleDateKey && currentScheduleUnsubscribe) {
    return;
  }

  // Unsubscribe from previous listener
  if (currentScheduleUnsubscribe) {
    currentScheduleUnsubscribe();
    currentScheduleUnsubscribe = null;
  }

  currentScheduleDateKey = dateKey;
  let isInitialSnapshot = true;

  console.log('[SCHEDULE-LISTENER] Switching to date:', dateKey);

  // Listen to a single document: schedules/{dateKey}
  currentScheduleUnsubscribe = db.collection('schedules').doc(dateKey).onSnapshot(
    { includeMetadataChanges: false },
    (doc) => {
      if (doc.exists) {
        employeesData[dateKey] = doc.data().shifts || [];
      } else {
        // Document doesn't exist (no schedule for this date)
        employeesData[dateKey] = [];
      }

      // Show syncing animation (but not on initial load)
      if (!isInitialSnapshot && isLoggedIn) {
        updateSyncStatus('syncing');
      }
      isInitialSnapshot = false;

      // Re-render if logged in
      if (isLoggedIn) {
        renderEmployees();
        // Re-apply dagvy corrections after schedule update
        if (typeof reapplyDagvyCorrections === 'function') {
          reapplyDagvyCorrections();
        }
        // Also update schedule view if a person is selected
        if (typeof selectedEmployeeId !== 'undefined' && selectedEmployeeId) {
          renderPersonSchedule();
        }
      }
    },
    (error) => {
      console.error('Schedule listener error for', dateKey, ':', error);
      updateSyncStatus('offline');
    }
  );
}

/**
 * Save employee to Firebase
 */
async function saveEmployeeToFirebase(employee) {
  try {
    await db.collection('employees').doc(employee.employeeId).set(employee);
    console.log('Employee saved:', employee.name);
  } catch (error) {
    console.error('Error saving employee:', error);
  }
}

/**
 * Save schedule to Firebase
 */
async function saveScheduleToFirebase(dateStr, shifts) {
  try {
    await db.collection('schedules').doc(dateStr).set({ shifts: shifts });
  } catch (error) {
    console.error('Error saving schedule:', error);
  }
}

/**
 * Save dagvy data to Firebase
 * Takes parsed JSON with structure: { "Employee Name": { scrapedAt, days: [...] }, ... }
 * Writes each employee as a separate document in the dagvy collection
 * @param {Object} dagvyJson - Parsed dagvy JSON object
 * @param {Function} onProgress - Optional callback (current, total, name)
 */
async function saveDagvyToFirebase(dagvyJson, onProgress) {
  var names = Object.keys(dagvyJson);
  var total = names.length;
  var processed = 0;

  // Write in small batches with delays to avoid quota issues
  var BATCH_SIZE = 3;

  for (var i = 0; i < names.length; i += BATCH_SIZE) {
    var batch = db.batch();
    var batchNames = names.slice(i, i + BATCH_SIZE);

    for (var j = 0; j < batchNames.length; j++) {
      var empName = batchNames[j];
      var empData = dagvyJson[empName];
      var docRef = db.collection('dagvy').doc(empName);
      batch.set(docRef, empData);
    }

    await commitBatchWithRetry(batch);

    processed += batchNames.length;
    if (onProgress && typeof onProgress === 'function') {
      onProgress(processed, total, batchNames[batchNames.length - 1]);
    }

    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < names.length) {
      await delay(500);
    }
  }

  console.log('Dagvy data saved to Firebase: ' + total + ' employees');
  return total;
}

/**
 * Delete all data for an employee
 * - Removes from registeredEmployees
 * - Removes from employeesData (all dates)
 * - Removes from Firebase
 */
async function deleteEmployeeData(employeeId) {
  console.log('Deleting employee data:', employeeId);

  if (!employeeId) {
    console.error('No employeeId provided');
    throw new Error('No employeeId provided');
  }

  try {
    // 1. Remove from local registeredEmployees
    delete registeredEmployees[employeeId];

    // 2. Remove from local employeesData (all dates)
    const dateKeys = Object.keys(employeesData);
    for (const dateStr of dateKeys) {
      const shifts = employeesData[dateStr];
      if (!shifts) continue;

      const filteredShifts = shifts.filter(s => s.employeeId !== employeeId);

      if (filteredShifts.length !== shifts.length) {
        employeesData[dateStr] = filteredShifts;

        // Update Firebase for this date
        if (filteredShifts.length > 0) {
          await saveScheduleToFirebase(dateStr, filteredShifts);
        } else {
          // Remove the date document if no shifts left
          await db.collection('schedules').doc(dateStr).delete().catch(e => {
            console.warn('Could not delete schedule doc:', dateStr, e);
          });
          delete employeesData[dateStr];
        }
      }
    }

    // 3. Remove employee document from Firebase
    await db.collection('employees').doc(employeeId).delete();
    console.log('Employee deleted from Firebase:', employeeId);

  } catch (error) {
    console.error('Error in deleteEmployeeData:', error);
    throw error;
  }
}

/**
 * Delete employee data from Firebase only (local data already removed)
 * Used for background sync after immediate UI update
 */
async function deleteEmployeeFromFirebase(employeeId) {
  console.log('Syncing delete to Firebase:', employeeId);

  if (!employeeId) {
    throw new Error('No employeeId provided');
  }

  // Get all schedule documents and update them
  const schedulesSnapshot = await db.collection('schedules').get();

  for (const doc of schedulesSnapshot.docs) {
    const shifts = doc.data().shifts || [];
    const filteredShifts = shifts.filter(s => s.employeeId !== employeeId);

    if (filteredShifts.length !== shifts.length) {
      if (filteredShifts.length > 0) {
        await db.collection('schedules').doc(doc.id).set({ shifts: filteredShifts });
      } else {
        await db.collection('schedules').doc(doc.id).delete();
      }
    }
  }

  // Delete the employee document
  await db.collection('employees').doc(employeeId).delete();
  console.log('Employee fully deleted from Firebase:', employeeId);
}

/**
 * Helper function to delay execution
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper function to commit batch with retry on rate limit
 * @param {Object} batch - Firestore batch object
 * @param {number} maxRetries - Maximum number of retries
 */
async function commitBatchWithRetry(batch, maxRetries = 3) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await batch.commit();
      return;
    } catch (error) {
      if (error.code === 'resource-exhausted' || error.message?.includes('429') || error.message?.includes('Quota')) {
        retries++;
        const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`Rate limit hit, waiting ${waitTime}ms before retry ${retries}/${maxRetries}...`);
        await delay(waitTime);
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded due to rate limiting');
}

/**
 * Save fridagsnyckel shifts to Firebase
 * - Updates employee with fridagsnyckel and fridagsrad
 * - Adds FP/FPV shifts to schedule collection
 * @param {string} employeeId
 * @param {string} keyId - Fridagsnyckel ID (e.g., 'TVMC11')
 * @param {number} startRow - Starting row (1-12)
 * @param {Array} shifts - Array of { date: 'YYYY-MM-DD', type: 'FP'|'FPV' }
 * @param {Function} onProgress - Optional callback for progress updates (processed, total)
 */
async function saveFridagShiftsToFirebase(employeeId, keyId, startRow, shifts, onProgress) {
  console.log(`Saving ${shifts.length} fridag shifts for employee ${employeeId}`);

  if (!shifts || shifts.length === 0) {
    throw new Error('Inga fridagar genererades');
  }

  // 1. Update employee document with fridagsnyckel info using update() instead of set()
  const employeeRef = db.collection('employees').doc(employeeId);
  try {
    await employeeRef.update({
      fridagsnyckel: keyId,
      fridagsrad: startRow
    });
  } catch (err) {
    // If document doesn't exist, create it
    if (err.code === 'not-found') {
      await employeeRef.set({
        fridagsnyckel: keyId,
        fridagsrad: startRow
      });
    } else {
      throw err;
    }
  }

  // Small delay after employee update
  await delay(200);

  // 2. Group shifts by date
  const shiftsByDate = {};
  for (const shift of shifts) {
    if (!shiftsByDate[shift.date]) {
      shiftsByDate[shift.date] = [];
    }
    shiftsByDate[shift.date].push({
      employeeId,
      badge: shift.type.toLowerCase(),
      badgeText: shift.type,
      time: '-'
    });
  }

  // 3. First, read all existing data for these dates - SEQUENTIALLY to avoid rate limits
  const dateKeys = Object.keys(shiftsByDate);
  const totalDates = dateKeys.length;
  console.log(`Updating ${totalDates} dates...`);

  // Read existing data ONE BY ONE with delays (Firebase Spark has strict per-second limits)
  const existingData = {};
  const READ_BATCH_SIZE = 3; // Very small batches for reads

  for (let i = 0; i < dateKeys.length; i += READ_BATCH_SIZE) {
    const batchKeys = dateKeys.slice(i, i + READ_BATCH_SIZE);

    // Read sequentially within each small batch
    for (const dateStr of batchKeys) {
      try {
        const doc = await db.collection('schedules').doc(dateStr).get();
        existingData[dateStr] = doc.exists ? (doc.data().shifts || []) : [];
      } catch (error) {
        if (error.code === 'resource-exhausted' || error.message?.includes('429')) {
          // Rate limited on read - wait and retry
          console.log('Rate limit on read, waiting 2s...');
          await delay(2000);
          const doc = await db.collection('schedules').doc(dateStr).get();
          existingData[dateStr] = doc.exists ? (doc.data().shifts || []) : [];
        } else {
          throw error;
        }
      }
    }

    // Report read progress
    if (onProgress && typeof onProgress === 'function') {
      const readProgress = Math.min(i + READ_BATCH_SIZE, dateKeys.length);
      onProgress(Math.floor(readProgress * 0.3), totalDates); // 0-30% for reads
    }

    // Longer delay between read batches
    if (i + READ_BATCH_SIZE < dateKeys.length) {
      await delay(500);
    }
  }

  console.log('All existing data read, starting writes...');

  // 4. Prepare all updates and write in VERY small batches with long delays
  const WRITE_BATCH_SIZE = 5; // Much smaller batches
  let processed = 0;

  for (let i = 0; i < dateKeys.length; i += WRITE_BATCH_SIZE) {
    const batch = db.batch();
    const batchKeys = dateKeys.slice(i, i + WRITE_BATCH_SIZE);

    for (const dateStr of batchKeys) {
      const docRef = db.collection('schedules').doc(dateStr);
      let existingShifts = existingData[dateStr] || [];

      // Remove any existing FP/FPV for this employee on this date
      existingShifts = existingShifts.filter(
        s => !(s.employeeId === employeeId && (s.badge === 'fp' || s.badge === 'fpv'))
      );

      // Add new shifts
      const updatedShifts = [...existingShifts, ...shiftsByDate[dateStr]];
      batch.set(docRef, { shifts: updatedShifts });
    }

    // Commit with retry logic for rate limits
    await commitBatchWithRetry(batch);

    processed += batchKeys.length;

    // Call progress callback if provided (30-100% for writes)
    if (onProgress && typeof onProgress === 'function') {
      const writeProgress = Math.floor(30 + (processed / totalDates) * 70);
      onProgress(writeProgress, 100);
    }

    console.log(`Processed ${processed}/${totalDates} dates...`);

    // Long delay between batches to stay well under quota (1 second)
    if (i + WRITE_BATCH_SIZE < dateKeys.length) {
      await delay(1000);
    }
  }

  console.log('Fridag shifts saved to Firebase');
}

/**
 * Remove fridagsnyckel shifts from Firebase
 * - Removes fridagsnyckel and fridagsrad from employee document
 * - Removes FP/FPV shifts for this employee from schedules (only FP/FPV with time '-')
 * @param {string} employeeId
 * @param {Function} onProgress - Optional callback for progress updates (processed, total)
 */
async function removeFridagShiftsFromFirebase(employeeId, onProgress) {
  console.log(`Removing fridag shifts for employee ${employeeId}`);

  // 1. Remove fridagsnyckel info from employee document
  const employeeRef = db.collection('employees').doc(employeeId);
  await employeeRef.update({
    fridagsnyckel: firebase.firestore.FieldValue.delete(),
    fridagsrad: firebase.firestore.FieldValue.delete()
  });

  // Small delay after employee update
  await delay(300);

  // 2. Get all schedules - this might hit rate limits on large datasets
  let schedulesSnapshot;
  try {
    schedulesSnapshot = await db.collection('schedules').get();
  } catch (error) {
    if (error.code === 'resource-exhausted' || error.message?.includes('429')) {
      console.log('Rate limit on initial read, waiting 3s...');
      await delay(3000);
      schedulesSnapshot = await db.collection('schedules').get();
    } else {
      throw error;
    }
  }

  const docs = schedulesSnapshot.docs;
  const totalDocs = docs.length;

  // Process and collect updates first
  const updates = [];
  const deletes = [];
  let removedCount = 0;

  for (const doc of docs) {
    const shifts = doc.data().shifts || [];

    // Filter out FP/FPV shifts for this employee that have time '-' (generated by fridagsnyckel)
    const filteredShifts = shifts.filter(s => {
      if (s.employeeId !== employeeId) return true;
      if (s.badge !== 'fp' && s.badge !== 'fpv') return true;
      if (s.time === '-') {
        removedCount++;
        return false;
      }
      return true;
    });

    if (filteredShifts.length !== shifts.length) {
      if (filteredShifts.length > 0) {
        updates.push({ id: doc.id, shifts: filteredShifts });
      } else {
        deletes.push(doc.id);
      }
    }
  }

  // Write updates in VERY small batches with long delays
  const BATCH_SIZE = 5;
  const allChanges = [...updates.map(u => ({ type: 'update', ...u })), ...deletes.map(id => ({ type: 'delete', id }))];
  const totalChanges = allChanges.length;
  let processed = 0;

  for (let i = 0; i < allChanges.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchItems = allChanges.slice(i, i + BATCH_SIZE);

    for (const item of batchItems) {
      const docRef = db.collection('schedules').doc(item.id);
      if (item.type === 'update') {
        batch.set(docRef, { shifts: item.shifts });
        employeesData[item.id] = item.shifts;
      } else {
        batch.delete(docRef);
        delete employeesData[item.id];
      }
    }

    // Commit with retry logic
    await commitBatchWithRetry(batch);

    processed += batchItems.length;
    if (onProgress && typeof onProgress === 'function') {
      onProgress(processed, totalChanges > 0 ? totalChanges : 1);
    }

    // Long delay between batches (1 second)
    if (i + BATCH_SIZE < allChanges.length) {
      await delay(1000);
    }
  }

  // If no changes, still call progress to complete
  if (totalChanges === 0 && onProgress) {
    onProgress(1, 1);
  }

  console.log(`Removed ${removedCount} fridag shifts from Firebase`);
}

/**
 * Save a single day edit to Firebase
 * @param {string} dateKey - Date in format 'YYYY-MM-DD'
 * @param {string} employeeId - Employee ID
 * @param {Object|null} newShift - New shift data, or null to remove shift
 */
async function saveDayEditToFirebase(dateKey, employeeId, newShift) {
  console.log(`Saving day edit for ${employeeId} on ${dateKey}:`, newShift);

  const docRef = db.collection('schedules').doc(dateKey);

  try {
    // Get existing shifts for this date
    const doc = await docRef.get();
    let shifts = doc.exists ? (doc.data().shifts || []) : [];

    // Remove existing shift for this employee on this date
    shifts = shifts.filter(s => s.employeeId !== employeeId);

    // Add new shift if provided
    if (newShift) {
      shifts.push(newShift);
    }

    // If no shifts left, delete the document
    if (shifts.length === 0) {
      if (doc.exists) {
        await docRef.delete();
      }
    } else {
      // Save updated shifts
      await docRef.set({ shifts });
    }

    console.log(`Day edit saved to Firebase for ${dateKey}`);
  } catch (error) {
    console.error('Error saving day edit to Firebase:', error);
    throw error;
  }
}
