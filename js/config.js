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

// Non-working shift types
const nonWorkingTypes = ['fp', 'fpv', 'semester', 'franvarande', 'foraldraledighet', 'afd'];

// IndexedDB Configuration
const DB_NAME = 'VemJobbarIdagDB';
const DB_VERSION = 1;
const STORE_NAME = 'auth';
