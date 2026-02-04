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

    // Listen for schedule changes
    db.collection('schedules').onSnapshot(
      { includeMetadataChanges: false },
      (snapshot) => {
        const hasChanges = snapshot.docChanges().length > 0;

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            employeesData[change.doc.id] = change.doc.data().shifts || [];
          } else if (change.type === 'removed') {
            delete employeesData[change.doc.id];
          }
        });

        // Show syncing animation (but not on initial load)
        if (hasChanges && !schedulesInitialLoad && isLoggedIn) {
          updateSyncStatus('syncing');
        }
        schedulesInitialLoad = false;

        // Re-render if logged in
        if (isLoggedIn) {
          renderEmployees();
          // Also update schedule view if a person is selected
          if (selectedEmployeeId) {
            renderPersonSchedule();
          }
        }
      },
      (error) => {
        console.error('Schedule listener error:', error);
        updateSyncStatus('offline');
      }
    );

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

  // 3. First, read all existing data for these dates
  const dateKeys = Object.keys(shiftsByDate);
  const totalDates = dateKeys.length;
  console.log(`Updating ${totalDates} dates...`);

  // Read existing data in batches to avoid rate limits
  const existingData = {};
  const BATCH_SIZE = 10; // Smaller read batches

  for (let i = 0; i < dateKeys.length; i += BATCH_SIZE) {
    const batchKeys = dateKeys.slice(i, i + BATCH_SIZE);
    const promises = batchKeys.map(dateStr =>
      db.collection('schedules').doc(dateStr).get()
    );

    const docs = await Promise.all(promises);
    docs.forEach((doc, idx) => {
      const dateStr = batchKeys[idx];
      existingData[dateStr] = doc.exists ? (doc.data().shifts || []) : [];
    });

    // Small delay between read batches
    if (i + BATCH_SIZE < dateKeys.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // 4. Prepare all updates and write in batches
  const WRITE_BATCH_SIZE = 20; // Smaller write batches to avoid quota
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

    // Commit the batch
    await batch.commit();

    processed += batchKeys.length;

    // Call progress callback if provided
    if (onProgress && typeof onProgress === 'function') {
      onProgress(processed, totalDates);
    }

    console.log(`Processed ${processed}/${totalDates} dates...`);

    // Add delay between batches to avoid rate limiting
    if (i + WRITE_BATCH_SIZE < dateKeys.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
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

  // 2. Get all schedules and remove FP/FPV shifts for this employee
  // Only remove shifts that are FP/FPV with time '-' (generated by fridagsnyckel)
  // Preserve PDF-uploaded shifts (they have actual time values)
  const schedulesSnapshot = await db.collection('schedules').get();
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

  // Write updates in batches
  const BATCH_SIZE = 20;
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

    await batch.commit();

    processed += batchItems.length;
    if (onProgress && typeof onProgress === 'function') {
      onProgress(processed, totalChanges > 0 ? totalChanges : 1);
    }

    // Add delay between batches
    if (i + BATCH_SIZE < allChanges.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // If no changes, still call progress to complete
  if (totalChanges === 0 && onProgress) {
    onProgress(1, 1);
  }

  console.log(`Removed ${removedCount} fridag shifts from Firebase`);
}
