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
  // Listen for employee changes
  db.collection('employees').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        registeredEmployees[change.doc.id] = change.doc.data();
      } else if (change.type === 'removed') {
        delete registeredEmployees[change.doc.id];
      }
    });

    // Re-render if logged in
    if (isLoggedIn) {
      renderEmployees();
      renderPersonList();
    }
  }, (error) => {
    console.error('Employee listener error:', error);
  });

  // Listen for schedule changes
  db.collection('schedules').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        employeesData[change.doc.id] = change.doc.data().shifts || [];
      } else if (change.type === 'removed') {
        delete employeesData[change.doc.id];
      }
    });

    // Re-render if logged in
    if (isLoggedIn) {
      renderEmployees();
      // Also update schedule view if a person is selected
      if (selectedEmployeeId) {
        renderPersonSchedule();
      }
    }
  }, (error) => {
    console.error('Schedule listener error:', error);
  });

  console.log('Realtime listeners active - auto-sync enabled');
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
