/**
 * config.js - Application Configuration
 * Firebase settings, constants, and app configuration
 */

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDgiSvdMHAtsewgZTtBZ3MhFVEbJYeyxr4",
  authDomain: "vemjobbaridag.firebaseapp.com",
  projectId: "vemjobbaridag",
  storageBucket: "vemjobbaridag.firebasestorage.app",
  messagingSenderId: "423589098114",
  appId: "1:423589098114:web:50b7177fa26425c600fa9b"
};

// App Password
const APP_PASSWORD = 'Gnällsoffan2026!';

// Available colors for employee avatars
const employeeColors = ['green', 'blue', 'purple', 'orange', 'pink', 'teal'];

// Swedish day names (short)
const dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

// Swedish month names (short)
const monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Swedish month names (full)
const monthNamesFull = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

// Swedish day names (short for calendar)
const dayNamesShort = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

// Swedish day names (full)
const dayNamesFull = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

// Non-working shift types - these show "Ledig" in time field
const nonWorkingTypes = ['fp', 'fpv', 'semester', 'franvarande', 'foraldraledighet', 'afd', 'vab', 'sjuk'];

// Birthdays - name: "YYYY-MM-DD"
const BIRTHDAYS = {
  "Zara Nilsson": "1995-04-19",
  "Bendik Sørensen": "1993-05-28",
  "Patrick Odervik Larsson": "1993-05-02",
  "Sara Feldt": "1991-05-02",
  "Saga Fagerström": "2000-05-02",
  "Dennis Ross": "1987-04-23",
  "Anders Bertilsson": "1984-07-06",
  "Cristian Cardemil": "1982-07-27",
  "Alexander Canlycke": "1991-09-24"
};

// Working types that show actual time (not "Ledig")
const workingSpecialTypes = ['ffu', 'seko'];

// IndexedDB Configuration
const DB_NAME = 'VemJobbarIdagDB';
const DB_VERSION = 1;
const STORE_NAME = 'auth';

// Fridagsnyckel Period
const FRIDAG_START_DATE = '2026-03-01';  // 1 mars 2026
const FRIDAG_END_DATE = '2027-02-28';    // 28 februari 2027

/**
 * FRIDAGSNYCKLAR - Day-off patterns from Fridag2026.pdf
 * Each key has a cycle (6 or 12 weeks) and pattern per position (row)
 * Days: mon, tue, wed, thu, fri, sat, sun
 * Values: 'FP' or 'FPV'
 */
const FRIDAG_KEYS = {
  // ============================================
  // ÖT26TV - TÅGVÄRDAR (Train Conductors)
  // ============================================

  // TVMC11 - TV Malmö morgon (12-cykel)
  'TVMC11': {
    name: 'TV Malmö morgon',
    cycle: 12,
    pattern: {
      1:  { thu: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6:  { sat: 'FP', sun: 'FP' },
      7:  { fri: 'FP' },
      8:  { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', sat: 'FP', sun: 'FP' },
      11: { thu: 'FP', sun: 'FPV' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC12 - TV Malmö morgon (6-cykel)
  'TVMC12': {
    name: 'TV Malmö morgon',
    cycle: 6,
    pattern: {
      1: { fri: 'FP' },
      2: { wed: 'FP', sat: 'FP', sun: 'FP' },
      3: { thu: 'FP' },
      4: { tue: 'FP', sat: 'FP', sun: 'FP' },
      5: { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC13 - TV Malmö kväll (12-cykel)
  'TVMC13': {
    name: 'TV Malmö kväll',
    cycle: 12,
    pattern: {
      1:  { mon: 'FPV', fri: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { fri: 'FP' },
      6:  { wed: 'FP', thu: 'FPV', fri: 'FPV', sat: 'FP', sun: 'FP' },
      7:  { thu: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { wed: 'FP' },
      10: { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      11: { thu: 'FP' },
      12: { tue: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC14 - TV Malmö kväll (12-cykel)
  'TVMC14': {
    name: 'TV Malmö kväll',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { wed: 'FPV', thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { thu: 'FP' },
      6:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      7:  { fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      10: { mon: 'FP', sat: 'FP', sun: 'FP' },
      11: { thu: 'FP' },
      12: { mon: 'FP', fri: 'FPV', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC15 - TV Malmö natt (6-cykel)
  'TVMC15': {
    name: 'TV Malmö natt',
    cycle: 6,
    pattern: {
      1: { thu: 'FP' },
      2: { tue: 'FP', sat: 'FP', sun: 'FP' },
      3: { thu: 'FP' },
      4: { fri: 'FP', sat: 'FP', sun: 'FP' },
      5: { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6: { tue: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC16 - TV Malmö natt (6-cykel)
  'TVMC16': {
    name: 'TV Malmö natt',
    cycle: 6,
    pattern: {
      1: { thu: 'FP' },
      2: { tue: 'FP', sat: 'FP', sun: 'FP' },
      3: { thu: 'FP' },
      4: { wed: 'FP', thu: 'FPV', fri: 'FPV', sat: 'FP', sun: 'FP' },
      5: { mon: 'FP' },
      6: { tue: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC17 - TV Malmö blandat (12-cykel)
  'TVMC17': {
    name: 'TV Malmö blandat',
    cycle: 12,
    pattern: {
      1:  { thu: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { fri: 'FP' },
      8:  { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', sat: 'FP', sun: 'FP' },
      11: { wed: 'FP', sun: 'FPV' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC18 - TV Malmö blandat (12-cykel)
  'TVMC18': {
    name: 'TV Malmö blandat',
    cycle: 12,
    pattern: {
      1:  { thu: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      11: { thu: 'FP', sun: 'FPV' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC19 - TV Malmö blandat (12-cykel)
  'TVMC19': {
    name: 'TV Malmö blandat',
    cycle: 12,
    pattern: {
      1:  { thu: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      5:  { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      7:  { fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { wed: 'FP', thu: 'FPV' },
      10: { mon: 'FP', sat: 'FP', sun: 'FP' },
      11: { thu: 'FP', sun: 'FPV' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC20 - TV Malmö blandat (12-cykel)
  'TVMC20': {
    name: 'TV Malmö blandat',
    cycle: 12,
    pattern: {
      1:  { thu: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { mon: 'FPV', thu: 'FP' },
      4:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      5:  { wed: 'FP' },
      6:  { mon: 'FP', fri: 'FPV', sat: 'FP', sun: 'FP' },
      7:  { thu: 'FP' },
      8:  { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      9:  { wed: 'FP' },
      10: { tue: 'FP', sat: 'FP', sun: 'FP' },
      11: { fri: 'FP' },
      12: { tue: 'FP', fri: 'FPV', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC21 - TV Malmö skubb (12-cykel)
  'TVMC21': {
    name: 'TV Malmö skubb',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { wed: 'FP', thu: 'FPV', fri: 'FPV', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { tue: 'FPV', wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      11: { thu: 'FP' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC22 - TV Malmö skubb (12-cykel)
  'TVMC22': {
    name: 'TV Malmö skubb',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { thu: 'FPV', fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', sat: 'FP', sun: 'FP' },
      11: { wed: 'FPV', thu: 'FP' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC23 - TV Malmö skubb (12-cykel)
  'TVMC23': {
    name: 'TV Malmö skubb',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { wed: 'FP', thu: 'FPV', fri: 'FPV', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      5:  { wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', sat: 'FP', sun: 'FP' },
      11: { mon: 'FPV', thu: 'FP' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // TVMC24 - TV Malmö skubb (12-cykel)
  'TVMC24': {
    name: 'TV Malmö skubb',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { fri: 'FP' },
      8:  { tue: 'FP', fri: 'FPV', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', sat: 'FP', sun: 'FP' },
      11: { wed: 'FPV', thu: 'FP' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // ============================================
  // ÖT26LF - LOKFÖRARE (Train Drivers)
  // ============================================

  // LFMC11 - LF Malmö morgon (12-cykel)
  'LFMC11': {
    name: 'LF Malmö morgon',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { wed: 'FP', thu: 'FPV', fri: 'FPV', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { mon: 'FPV', fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      11: { thu: 'FP' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC12 - LF Malmö morgon (6-cykel)
  'LFMC12': {
    name: 'LF Malmö morgon',
    cycle: 6,
    pattern: {
      1: { fri: 'FP' },
      2: { wed: 'FP', sat: 'FP', sun: 'FP' },
      3: { thu: 'FP' },
      4: { tue: 'FP', sat: 'FP', sun: 'FP' },
      5: { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC13 - LF Malmö kväll (6-cykel)
  'LFMC13': {
    name: 'LF Malmö kväll',
    cycle: 6,
    pattern: {
      1: { fri: 'FP' },
      2: { wed: 'FP', thu: 'FPV', fri: 'FPV', sat: 'FP', sun: 'FP' },
      3: { thu: 'FP' },
      4: { tue: 'FP', sat: 'FP', sun: 'FP' },
      5: { wed: 'FP' },
      6: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC14 - LF Malmö kväll/natt (6-cykel)
  'LFMC14': {
    name: 'LF Malmö kväll/natt',
    cycle: 6,
    pattern: {
      1: { thu: 'FP' },
      2: { tue: 'FP', sat: 'FP', sun: 'FP' },
      3: { thu: 'FP' },
      4: { fri: 'FP', sat: 'FP', sun: 'FP' },
      5: { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6: { tue: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC15 - LF Malmö natt (6-cykel)
  'LFMC15': {
    name: 'LF Malmö natt',
    cycle: 6,
    pattern: {
      1: { thu: 'FP' },
      2: { tue: 'FP', sat: 'FP', sun: 'FP' },
      3: { thu: 'FP' },
      4: { fri: 'FP', sat: 'FP', sun: 'FP' },
      5: { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6: { tue: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC16 - LF Malmö blandat (12-cykel)
  'LFMC16': {
    name: 'LF Malmö blandat',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { wed: 'FP', thu: 'FPV', fri: 'FPV', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { mon: 'FPV', fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      11: { thu: 'FP' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC17 - LF Malmö blandat (12-cykel)
  'LFMC17': {
    name: 'LF Malmö blandat',
    cycle: 12,
    pattern: {
      1:  { thu: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { thu: 'FP' },
      8:  { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', sat: 'FP', sun: 'FP' },
      11: { wed: 'FP' },
      12: { mon: 'FP', thu: 'FPV', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC18 - LF Malmö blandat (6-cykel)
  'LFMC18': {
    name: 'LF Malmö blandat',
    cycle: 6,
    pattern: {
      1: { fri: 'FP' },
      2: { wed: 'FP', sat: 'FP', sun: 'FP' },
      3: { thu: 'FP' },
      4: { tue: 'FP', sat: 'FP', sun: 'FP' },
      5: { wed: 'FP' },
      6: { mon: 'FP', thu: 'FPV', fri: 'FPV', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC19 - LF Malmö skubb (12-cykel)
  'LFMC19': {
    name: 'LF Malmö skubb',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { wed: 'FP', thu: 'FPV', fri: 'FPV', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { wed: 'FPV', fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      11: { thu: 'FP' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC20 - LF Malmö skubb (12-cykel)
  'LFMC20': {
    name: 'LF Malmö skubb',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { mon: 'FPV', tue: 'FPV', wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { wed: 'FP', thu: 'FPV' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { fri: 'FP' },
      8:  { tue: 'FP', wed: 'FPV', sat: 'FP', sun: 'FP' },
      9:  { thu: 'FP' },
      10: { tue: 'FP', sat: 'FP', sun: 'FP' },
      11: { thu: 'FP' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC21 - LF Malmö skubb (12-cykel)
  'LFMC21': {
    name: 'LF Malmö skubb',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { wed: 'FP', thu: 'FPV', fri: 'FPV', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { tue: 'FPV', thu: 'FP' },
      10: { tue: 'FP', sat: 'FP', sun: 'FP' },
      11: { mon: 'FPV', thu: 'FP' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  },

  // LFMC22 - LF Malmö skubb (12-cykel)
  'LFMC22': {
    name: 'LF Malmö skubb',
    cycle: 12,
    pattern: {
      1:  { fri: 'FP' },
      2:  { wed: 'FP', sat: 'FP', sun: 'FP' },
      3:  { thu: 'FP' },
      4:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      5:  { mon: 'FPV', tue: 'FPV', wed: 'FP' },
      6:  { mon: 'FP', sat: 'FP', sun: 'FP' },
      7:  { wed: 'FPV', fri: 'FP' },
      8:  { tue: 'FP', sat: 'FP', sun: 'FP' },
      9:  { wed: 'FP' },
      10: { tue: 'FP', thu: 'FPV', sat: 'FP', sun: 'FP' },
      11: { wed: 'FP' },
      12: { mon: 'FP', sat: 'FP', sun: 'FP' }
    }
  }
};
