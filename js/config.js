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

// App password and Firebase Auth credentials are now stored
// in the Cloudflare Worker (auth-proxy) as environment secrets.
// See worker/auth-proxy.js

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

// Birthdays - loaded from Firestore at startup
// Format: { "Name": "YYYY-MM-DD", ... }
var BIRTHDAYS = {};

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

// ==========================================
// SVENSKA NAMNSDAGAR 2026
// Format: 'MM-DD': ['Namn1', 'Namn2']
// Källa: Svenska almanackan / Namnlängdskommittén
// ==========================================
const SWEDISH_NAME_DAYS = {
  // JANUARI
  '01-01': ['Nyårsdagen'],
  '01-02': ['Svea', 'Sverker'],
  '01-03': ['Alfred', 'Alvar'],
  '01-04': ['Rut', 'Ritva'],
  '01-05': ['Hanna', 'Hannele'],
  '01-06': ['Kasper', 'Melker', 'Baltsar'],
  '01-07': ['August', 'Augusta'],
  '01-08': ['Erland', 'Erling'],
  '01-09': ['Gunnar', 'Gunder'],
  '01-10': ['Sigurd', 'Sigbritt'],
  '01-11': ['Jan', 'Jansen'],
  '01-12': ['Frideborg', 'Fridolf'],
  '01-13': ['Knut'],
  '01-14': ['Felix', 'Felicia'],
  '01-15': ['Laura', 'Lorentz'],
  '01-16': ['Hjalmar', 'Helmer'],
  '01-17': ['Anton', 'Tony'],
  '01-18': ['Hilda', 'Hildur'],
  '01-19': ['Henrik', 'Henry'],
  '01-20': ['Fabian', 'Sebastian'],
  '01-21': ['Agnes', 'Agneta'],
  '01-22': ['Vincent', 'Viktor'],
  '01-23': ['Frej', 'Freja'],
  '01-24': ['Erika', 'Erik'],
  '01-25': ['Paul', 'Pål'],
  '01-26': ['Bodil', 'Boel'],
  '01-27': ['Göte', 'Göta'],
  '01-28': ['Karl', 'Karla'],
  '01-29': ['Diana', 'Diana'],
  '01-30': ['Gunilla', 'Gunhild'],
  '01-31': ['Ivar', 'Joar'],
  // FEBRUARI
  '02-01': ['Max', 'Maximilian'],
  '02-02': ['Kyndelsmässodagen'],
  '02-03': ['Disa', 'Hjördis'],
  '02-04': ['Ansgar', 'Anselm'],
  '02-05': ['Agata', 'Agda'],
  '02-06': ['Dorotea', 'Dorothea'],
  '02-07': ['Rikard', 'Dick'],
  '02-08': ['Berta', 'Bert'],
  '02-09': ['Fanny', 'Franciska'],
  '02-10': ['Egon', 'Egil'],
  '02-11': ['Yngve', 'Ansen'],
  '02-12': ['Evelina', 'Evy'],
  '02-13': ['Agne', 'Ove'],
  '02-14': ['Valentin', 'Tina'],
  '02-15': ['Sigfrid', 'Sigbritt'],
  '02-16': ['Julia', 'Juliana'],
  '02-17': ['Alexandra', 'Sandra'],
  '02-18': ['Frida', 'Fritiof'],
  '02-19': ['Gabriella', 'Ella'],
  '02-20': ['Vivianne', 'Vivian'],
  '02-21': ['Hilding', 'Hildegard'],
  '02-22': ['Pia', 'Pia'],
  '02-23': ['Torsten', 'Torun'],
  '02-24': ['Mattias', 'Mats'],
  '02-25': ['Sigvard', 'Sivert'],
  '02-26': ['Torgny', 'Torkel'],
  '02-27': ['Lage', 'Laila'],
  '02-28': ['Maria', 'Maja'],
  // MARS
  '03-01': ['Albin', 'Elvira'],
  '03-02': ['Ernst', 'Erna'],
  '03-03': ['Gunborg', 'Gunvor'],
  '03-04': ['Adrian', 'Adriana'],
  '03-05': ['Tora', 'Tove'],
  '03-06': ['Ebba', 'Ebbe'],
  '03-07': ['Camilla', 'Isidor'],
  '03-08': ['Siv', 'Saga'],
  '03-09': ['Torbjörn', 'Torleif'],
  '03-10': ['Edla', 'Ada'],
  '03-11': ['Edvin', 'Egon'],
  '03-12': ['Viktoria', 'Viktor'],
  '03-13': ['Greger', 'Gregorius'],
  '03-14': ['Matilda', 'Maud'],
  '03-15': ['Kristoffer', 'Christel'],
  '03-16': ['Herbert', 'Gilbert'],
  '03-17': ['Gertrud', 'Görel'],
  '03-18': ['Edvard', 'Edmund'],
  '03-19': ['Josef', 'Josefina'],
  '03-20': ['Joakim', 'Kim'],
  '03-21': ['Bengt', 'Bendik'],
  '03-22': ['Kennet', 'Kent'],
  '03-23': ['Gerda', 'Gerd'],
  '03-24': ['Gabriel', 'Rafael'],
  '03-25': ['Mary', 'Marion'],
  '03-26': ['Emanuel', 'Manne'],
  '03-27': ['Rudolf', 'Ralf'],
  '03-28': ['Malkolm', 'Morgan'],
  '03-29': ['Jonas', 'Jona'],
  '03-30': ['Holger', 'Holmfrid'],
  '03-31': ['Ester', 'Estrid'],
  // APRIL
  '04-01': ['Harald', 'Hervor'],
  '04-02': ['Gudmund', 'Ingemund'],
  '04-03': ['Ferdinand', 'Nanna'],
  '04-04': ['Marianne', 'Marlene'],
  '04-05': ['Irene', 'Irja'],
  '04-06': ['Vilhelm', 'Helmi'],
  '04-07': ['Irma', 'Irmelin'],
  '04-08': ['Nadja', 'Tanja'],
  '04-09': ['Otto', 'Ottilia'],
  '04-10': ['Ingvar', 'Ingvor'],
  '04-11': ['Ulf', 'Ylva'],
  '04-12': ['Liv', 'Livia'],
  '04-13': ['Artur', 'Douglas'],
  '04-14': ['Tiburtius', 'Tim'],
  '04-15': ['Olivia', 'Oliver'],
  '04-16': ['Patrik', 'Patricia'],
  '04-17': ['Elias', 'Elis'],
  '04-18': ['Valdemar', 'Volmar'],
  '04-19': ['Olaus', 'Ola'],
  '04-20': ['Amalia', 'Amelie'],
  '04-21': ['Anneli', 'Annika'],
  '04-22': ['Allan', 'Glenn'],
  '04-23': ['Georg', 'Göran'],
  '04-24': ['Vega', 'Viveka'],
  '04-25': ['Markus', 'Mark'],
  '04-26': ['Teresia', 'Terese'],
  '04-27': ['Engelbrekt', 'Engelbert'],
  '04-28': ['Ture', 'Tyko'],
  '04-29': ['Tyra', 'Tyrael'],
  '04-30': ['Valborg', 'Maj'],
  // MAJ
  '05-01': ['Första maj'],
  '05-02': ['Filip', 'Filippa'],
  '05-03': ['John', 'Jane'],
  '05-04': ['Monika', 'Mona'],
  '05-05': ['Gotthard', 'Erhard'],
  '05-06': ['Marit', 'Rita'],
  '05-07': ['Carina', 'Carita'],
  '05-08': ['Åke', 'Ove'],
  '05-09': ['Reidar', 'Reidun'],
  '05-10': ['Esbjörn', 'Styrbjörn'],
  '05-11': ['Märta', 'Märit'],
  '05-12': ['Charlotta', 'Lotta'],
  '05-13': ['Linnéa', 'Linn'],
  '05-14': ['Halvard', 'Halvar'],
  '05-15': ['Sofia', 'Sonja'],
  '05-16': ['Ronald', 'Ronny'],
  '05-17': ['Rebecka', 'Ruben'],
  '05-18': ['Erik', 'Erika'],
  '05-19': ['Maj', 'Majken'],
  '05-20': ['Karolina', 'Carola'],
  '05-21': ['Konstantin', 'Conny'],
  '05-22': ['Hemming', 'Henning'],
  '05-23': ['Desideria', 'Desirée'],
  '05-24': ['Ivan', 'Vanja'],
  '05-25': ['Urban', 'Urbana'],
  '05-26': ['Vilhelmina', 'Vilma'],
  '05-27': ['Beda', 'Blenda'],
  '05-28': ['Ingeborg', 'Borghild'],
  '05-29': ['Yvonne', 'Jansen'],
  '05-30': ['Vera', 'Veronika'],
  '05-31': ['Petronella', 'Pernilla'],
  // JUNI
  '06-01': ['Gun', 'Gunnel'],
  '06-02': ['Rutger', 'Roger'],
  '06-03': ['Ingemar', 'Gudmar'],
  '06-04': ['Solbritt', 'Solveig'],
  '06-05': ['Bo', 'Boris'],
  '06-06': ['Gustav', 'Gösta'],
  '06-07': ['Robert', 'Robin'],
  '06-08': ['Eivor', 'Majvor'],
  '06-09': ['Börje', 'Birger'],
  '06-10': ['Svante', 'Boris'],
  '06-11': ['Bertil', 'Berthold'],
  '06-12': ['Eskil', 'Eskild'],
  '06-13': ['Aina', 'Aino'],
  '06-14': ['Håkan', 'Hakon'],
  '06-15': ['Margit', 'Margot'],
  '06-16': ['Axel', 'Axelina'],
  '06-17': ['Torborg', 'Torvald'],
  '06-18': ['Björn', 'Bjarne'],
  '06-19': ['Germund', 'Görel'],
  '06-20': ['Linda', 'Linn'],
  '06-21': ['Alf', 'Alva'],
  '06-22': ['Paulina', 'Paula'],
  '06-23': ['Adolf', 'Alice'],
  '06-24': ['Johannes Döparens dag'],
  '06-25': ['David', 'Salomon'],
  '06-26': ['Rakel', 'Lea'],
  '06-27': ['Selma', 'Fingal'],
  '06-28': ['Leo', 'Leopold'],
  '06-29': ['Peter', 'Petra'],
  '06-30': ['Elof', 'Leif'],
  // JULI
  '07-01': ['Aron', 'Mirjam'],
  '07-02': ['Rosa', 'Rosita'],
  '07-03': ['Aurora', 'Adina'],
  '07-04': ['Ulrika', 'Ulla'],
  '07-05': ['Laila', 'Ritva'],
  '07-06': ['Esaias', 'Jessika'],
  '07-07': ['Klas', 'Kaj'],
  '07-08': ['Kjell', 'Tjelvar'],
  '07-09': ['Jörgen', 'Örjan'],
  '07-10': ['André', 'Andrea'],
  '07-11': ['Eleonora', 'Ellinor'],
  '07-12': ['Herman', 'Hermine'],
  '07-13': ['Joel', 'Judit'],
  '07-14': ['Folke', 'Odd'],
  '07-15': ['Ragnhild', 'Ragnvald'],
  '07-16': ['Reinhold', 'Reine'],
  '07-17': ['Bruno', 'Brynolf'],
  '07-18': ['Fredrik', 'Fritz'],
  '07-19': ['Sara', 'Sally', 'Zara'],
  '07-20': ['Margareta', 'Greta'],
  '07-21': ['Johanna', 'Jane'],
  '07-22': ['Magdalena', 'Madeleine'],
  '07-23': ['Emma', 'Emmy'],
  '07-24': ['Kristina', 'Kerstin'],
  '07-25': ['Jakob', 'James'],
  '07-26': ['Jesper', 'Jasmin'],
  '07-27': ['Marta', 'Moa'],
  '07-28': ['Botvid', 'Selja'],
  '07-29': ['Olof', 'Olov'],
  '07-30': ['Algot', 'Margot'],
  '07-31': ['Helena', 'Elin'],
  // AUGUSTI
  '08-01': ['Per', 'Pär'],
  '08-02': ['Karin', 'Kajsa'],
  '08-03': ['Tage', 'Tanja'],
  '08-04': ['Arne', 'Arnold'],
  '08-05': ['Ulrik', 'Alric'],
  '08-06': ['Alfons', 'Inez'],
  '08-07': ['Dennis', 'Denise'],
  '08-08': ['Silvia', 'Sylvia'],
  '08-09': ['Roland', 'Roine'],
  '08-10': ['Lars', 'Lasse'],
  '08-11': ['Susanna', 'Sanna'],
  '08-12': ['Klara', 'Clary'],
  '08-13': ['Kaj', 'Kaisa'],
  '08-14': ['Uno', 'Unn'],
  '08-15': ['Stella', 'Estelle'],
  '08-16': ['Brynolf', 'Bruno'],
  '08-17': ['Verner', 'Valter'],
  '08-18': ['Ellen', 'Lena'],
  '08-19': ['Magnus', 'Måns'],
  '08-20': ['Bernhard', 'Bernt'],
  '08-21': ['Jon', 'Jansen'],
  '08-22': ['Henrietta', 'Henrika'],
  '08-23': ['Signe', 'Signhild'],
  '08-24': ['Bartolomeus', 'Bert'],
  '08-25': ['Lovisa', 'Louise'],
  '08-26': ['Östen', 'Ejvor'],
  '08-27': ['Rolf', 'Raoul'],
  '08-28': ['Fatima', 'Leila'],
  '08-29': ['Hans', 'Hampus'],
  '08-30': ['Albert', 'Albertina'],
  '08-31': ['Arvid', 'Vidar'],
  // SEPTEMBER
  '09-01': ['Sam', 'Samuel'],
  '09-02': ['Justus', 'Justina'],
  '09-03': ['Alfhild', 'Alva'],
  '09-04': ['Gisela', 'Nadia'],
  '09-05': ['Adela', 'Heidi'],
  '09-06': ['Lena', 'Lene'],
  '09-07': ['Regina', 'Roy'],
  '09-08': ['Alma', 'Hulda'],
  '09-09': ['Anita', 'Annette'],
  '09-10': ['Tord', 'Turid'],
  '09-11': ['Dagny', 'Helny'],
  '09-12': ['Åsa', 'Åslög'],
  '09-13': ['Sture', 'Styrbörn'],
  '09-14': ['Ida', 'Ronja'],
  '09-15': ['Sigrid', 'Siri'],
  '09-16': ['Dag', 'Daga'],
  '09-17': ['Hildegard', 'Magnhild'],
  '09-18': ['Orvar', 'Alvar'],
  '09-19': ['Fredrika', 'Fred'],
  '09-20': ['Elise', 'Lisa'],
  '09-21': ['Matteus', 'Matts'],
  '09-22': ['Maurits', 'Moritz'],
  '09-23': ['Tekla', 'Tea'],
  '09-24': ['Gerhard', 'Gert'],
  '09-25': ['Tryggve', 'Trygve'],
  '09-26': ['Enar', 'Einar'],
  '09-27': ['Dagmar', 'Rigmor'],
  '09-28': ['Lennart', 'Leonard'],
  '09-29': ['Mikael', 'Mikaela'],
  '09-30': ['Helge', 'Helny'],
  // OKTOBER
  '10-01': ['Ragnar', 'Ragna'],
  '10-02': ['Ludvig', 'Louis'],
  '10-03': ['Evald', 'Osvald'],
  '10-04': ['Frans', 'Frank'],
  '10-05': ['Bror', 'Bruno'],
  '10-06': ['Jenny', 'Jennifer'],
  '10-07': ['Birgitta', 'Britta'],
  '10-08': ['Nils', 'Nelly'],
  '10-09': ['Ingrid', 'Inger'],
  '10-10': ['Harry', 'Harriet'],
  '10-11': ['Erling', 'Jarl'],
  '10-12': ['Valfrid', 'Manfred'],
  '10-13': ['Berit', 'Birgit'],
  '10-14': ['Stellan', 'Sten'],
  '10-15': ['Hedvig', 'Hillevi'],
  '10-16': ['Finn', 'Finlay'],
  '10-17': ['Antonia', 'Toini'],
  '10-18': ['Lukas', 'Luca'],
  '10-19': ['Tore', 'Tor'],
  '10-20': ['Sibylla', 'Camilla'],
  '10-21': ['Ursula', 'Yrsa'],
  '10-22': ['Marika', 'Marita'],
  '10-23': ['Severin', 'Sören'],
  '10-24': ['Evert', 'Eilert'],
  '10-25': ['Inga', 'Ingalill'],
  '10-26': ['Amanda', 'Rasmus'],
  '10-27': ['Sabina', 'Sabine'],
  '10-28': ['Simon', 'Simone'],
  '10-29': ['Viola', 'Vilda'],
  '10-30': ['Elsa', 'Isabella'],
  '10-31': ['Edit', 'Edgar'],
  // NOVEMBER
  '11-01': ['Allhelgonadagen'],
  '11-02': ['Tobias', 'Tobbe'],
  '11-03': ['Hubert', 'Hugo'],
  '11-04': ['Sverker', 'Sven'],
  '11-05': ['Eugen', 'Eugene'],
  '11-06': ['Gustaf Adolf', 'Lennart'],
  '11-07': ['Ingegerd', 'Ingela'],
  '11-08': ['Vendela', 'Vanda'],
  '11-09': ['Teodor', 'Teodora'],
  '11-10': ['Martin', 'Martina'],
  '11-11': ['Mårten', 'Martinus'],
  '11-12': ['Konrad', 'Kurt'],
  '11-13': ['Kristian', 'Krister'],
  '11-14': ['Emil', 'Emilia'],
  '11-15': ['Leopold', 'Leopolda'],
  '11-16': ['Vibeke', 'Viveca'],
  '11-17': ['Naemi', 'Naima'],
  '11-18': ['Lillemor', 'Moa'],
  '11-19': ['Elisabet', 'Lisbet'],
  '11-20': ['Pontus', 'Marina'],
  '11-21': ['Helga', 'Olga'],
  '11-22': ['Cecilia', 'Cornelia'],
  '11-23': ['Klemens', 'Clarence'],
  '11-24': ['Gudrun', 'Rune'],
  '11-25': ['Katarina', 'Katja'],
  '11-26': ['Linus', 'Love'],
  '11-27': ['Astrid', 'Asta'],
  '11-28': ['Malte', 'Melvin'],
  '11-29': ['Sune', 'Synn'],
  '11-30': ['Andreas', 'Anders'],
  // DECEMBER
  '12-01': ['Oskar', 'Ossian'],
  '12-02': ['Beata', 'Beatrice'],
  '12-03': ['Lydia', 'Cornelia'],
  '12-04': ['Barbara', 'Barbro'],
  '12-05': ['Sven', 'Svante'],
  '12-06': ['Nikolaus', 'Niklas'],
  '12-07': ['Angela', 'Angelika'],
  '12-08': ['Virginia', 'Vera'],
  '12-09': ['Anna', 'Annie'],
  '12-10': ['Malin', 'Malena'],
  '12-11': ['Daniel', 'Daniela'],
  '12-12': ['Alexander', 'Alexis'],
  '12-13': ['Lucia', 'Lucinda'],
  '12-14': ['Sten', 'Sixten'],
  '12-15': ['Gottfrid', 'Gottfried'],
  '12-16': ['Assar', 'Astor'],
  '12-17': ['Stig', 'Staffan'],
  '12-18': ['Abraham', 'Efraim'],
  '12-19': ['Isak', 'Rebecka'],
  '12-20': ['Israel', 'Moses'],
  '12-21': ['Tomas', 'Tom'],
  '12-22': ['Natanael', 'Jonatan'],
  '12-23': ['Adam', 'Eva'],
  '12-24': ['Julafton'],
  '12-25': ['Juldagen'],
  '12-26': ['Stefan', 'Staffan'],
  '12-27': ['Johannes', 'Johan'],
  '12-28': ['Benjamin', 'Värnlösa barns dag'],
  '12-29': ['Natalia', 'Natalie'],
  '12-30': ['Abel', 'Set'],
  '12-31': ['Sylvester', 'Nyårsafton']
};
