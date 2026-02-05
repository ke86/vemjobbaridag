/**
 * ui-editors.js - Day Editor & Month Picker
 * Handles bottom sheet editors for schedule editing
 */

// ==========================================
// MONTH PICKER - Bottom Sheet
// ==========================================

let monthPickerOverlay, monthPickerSheet, monthPickerYearDisplay;
let pickerYear = new Date().getFullYear(); // Year shown in picker

/**
 * Initialize Month Picker UI elements
 */
function initMonthPicker() {
  monthPickerOverlay = document.getElementById('monthPickerOverlay');
  monthPickerSheet = document.getElementById('monthPickerSheet');
  monthPickerYearDisplay = document.getElementById('yearDisplay');

  // Event listeners
  if (monthPickerOverlay) {
    monthPickerOverlay.addEventListener('click', closeMonthPicker);
  }

  const closeBtn = document.getElementById('monthPickerClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeMonthPicker);
  }

  const cancelBtn = document.getElementById('monthPickerCancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeMonthPicker);
  }

  const todayBtn = document.getElementById('monthPickerToday');
  if (todayBtn) {
    todayBtn.addEventListener('click', goToCurrentMonth);
  }

  // Year navigation
  const yearPrev = document.getElementById('yearPrev');
  const yearNext = document.getElementById('yearNext');
  if (yearPrev) {
    yearPrev.addEventListener('click', () => changePickerYear(-1));
  }
  if (yearNext) {
    yearNext.addEventListener('click', () => changePickerYear(1));
  }

  // Month buttons
  document.querySelectorAll('.month-btn').forEach(btn => {
    btn.addEventListener('click', () => selectMonth(parseInt(btn.dataset.month, 10)));
  });
}

/**
 * Open the month picker
 */
function openMonthPicker() {
  if (!monthPickerSheet || !monthPickerOverlay) return;

  // Set picker year to current view year
  pickerYear = viewYear;
  updateMonthPickerUI();

  // Show picker
  monthPickerOverlay.classList.add('active');
  monthPickerSheet.classList.add('active');
}

/**
 * Close the month picker
 */
function closeMonthPicker() {
  if (monthPickerOverlay) monthPickerOverlay.classList.remove('active');
  if (monthPickerSheet) monthPickerSheet.classList.remove('active');
}

/**
 * Change the year in the picker
 */
function changePickerYear(delta) {
  pickerYear += delta;
  updateMonthPickerUI();
}

/**
 * Update the month picker UI (year display and month highlights)
 */
function updateMonthPickerUI() {
  // Update year display
  if (monthPickerYearDisplay) {
    monthPickerYearDisplay.textContent = pickerYear;
  }

  // Update month button states
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  document.querySelectorAll('.month-btn').forEach(btn => {
    const month = parseInt(btn.dataset.month, 10);

    // Remove all state classes
    btn.classList.remove('selected', 'current');

    // Mark currently viewed month/year (selected)
    if (month === viewMonth && pickerYear === viewYear) {
      btn.classList.add('selected');
    }
    // Mark today's month with outline (current)
    else if (month === currentMonth && pickerYear === currentYear) {
      btn.classList.add('current');
    }
  });
}

/**
 * Select a month from the picker
 */
function selectMonth(month) {
  viewMonth = month;
  viewYear = pickerYear;

  // Close picker and refresh view
  closeMonthPicker();
  renderPersonSchedule();
}

/**
 * Jump to current month (today button)
 */
function goToCurrentMonth() {
  const today = new Date();
  viewMonth = today.getMonth();
  viewYear = today.getFullYear();

  // Close picker and refresh view
  closeMonthPicker();
  renderPersonSchedule();

  // Visual feedback
  if (monthDisplay) {
    monthDisplay.style.transition = 'color 0.2s';
    monthDisplay.style.color = 'var(--accent-green)';
    setTimeout(() => {
      monthDisplay.style.color = '';
    }, 500);
  }
}

// ==========================================
// DAY EDITOR - Bottom Sheet
// ==========================================

let dayEditorOverlay, dayEditorSheet, dayEditorTitle;
let dayEditorStartTime, dayEditorEndTime, dayEditorTurn;
let dayEditorClose, dayEditorCancel, dayEditorSave;
let currentEditingDay = null; // { dateKey, employeeId, shift }

/**
 * Initialize Day Editor UI elements
 */
function initDayEditor() {
  dayEditorOverlay = document.getElementById('dayEditorOverlay');
  dayEditorSheet = document.getElementById('dayEditorSheet');
  dayEditorTitle = document.getElementById('dayEditorTitle');
  dayEditorStartTime = document.getElementById('dayEditorStartTime');
  dayEditorEndTime = document.getElementById('dayEditorEndTime');
  dayEditorTurn = document.getElementById('dayEditorTurn');
  dayEditorClose = document.getElementById('dayEditorClose');
  dayEditorCancel = document.getElementById('dayEditorCancel');
  dayEditorSave = document.getElementById('dayEditorSave');

  // Event listeners
  if (dayEditorOverlay) {
    dayEditorOverlay.addEventListener('click', closeDayEditor);
  }
  if (dayEditorClose) {
    dayEditorClose.addEventListener('click', closeDayEditor);
  }
  if (dayEditorCancel) {
    dayEditorCancel.addEventListener('click', closeDayEditor);
  }
  if (dayEditorSave) {
    dayEditorSave.addEventListener('click', saveDayEdit);
  }

  // Type chip click handlers
  document.querySelectorAll('.day-editor-chip').forEach(chip => {
    chip.addEventListener('click', () => selectDayType(chip));
  });
}

/**
 * Open the day editor for a specific day
 */
function openDayEditor(dateKey, employeeId) {
  if (!dayEditorSheet || !dayEditorOverlay) return;

  // Find existing shift for this day
  const dayShifts = employeesData[dateKey] || [];
  const shift = dayShifts.find(s => s.employeeId === employeeId);

  // Parse date for title
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  const months = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const dayName = weekdays[date.getDay()];

  // Set title
  dayEditorTitle.textContent = `${dayName} ${day} ${months[month - 1]} ${year}`;

  // Store current editing state
  currentEditingDay = { dateKey, employeeId, shift };

  // Populate fields with existing data
  if (shift && shift.time && shift.time !== '-') {
    const timeParts = shift.time.split('-');
    if (timeParts.length === 2) {
      dayEditorStartTime.value = timeParts[0].trim();
      dayEditorEndTime.value = timeParts[1].trim();
    } else {
      dayEditorStartTime.value = shift.time;
      dayEditorEndTime.value = '';
    }
  } else {
    dayEditorStartTime.value = '';
    dayEditorEndTime.value = '';
  }

  // Set turn number
  dayEditorTurn.value = shift?.badgeText || '';

  // Clear chip selection
  document.querySelectorAll('.day-editor-chip').forEach(c => c.classList.remove('selected'));

  // Select current type chip if applicable
  if (shift?.badge) {
    const chipType = shift.badge;
    const chip = document.querySelector(`.day-editor-chip[data-type="${chipType}"]`);
    if (chip) {
      chip.classList.add('selected');
      // Clear time fields for special types
      if (['fp', 'fpv', 'semester', 'foraldraledighet', 'sjuk', 'ffu', 'vab'].includes(chipType)) {
        dayEditorStartTime.value = '';
        dayEditorEndTime.value = '';
      }
    }
  }

  // Show the editor
  dayEditorOverlay.classList.add('active');
  dayEditorSheet.classList.add('active');
}

/**
 * Close the day editor
 */
function closeDayEditor() {
  if (dayEditorOverlay) dayEditorOverlay.classList.remove('active');
  if (dayEditorSheet) dayEditorSheet.classList.remove('active');
  currentEditingDay = null;
}

/**
 * Select a day type (FP, FPV, Sem, etc.)
 */
function selectDayType(chip) {
  const type = chip.dataset.type;

  // Toggle selection
  if (chip.classList.contains('selected')) {
    // Deselecting - restore original values
    chip.classList.remove('selected');
    restoreOriginalFields();
  } else {
    // Remove selection from all chips
    document.querySelectorAll('.day-editor-chip').forEach(c => c.classList.remove('selected'));
    // Select this chip (unless it's "clear")
    if (type !== '') {
      chip.classList.add('selected');
      // Clear time and turn for special types
      if (['fp', 'fpv', 'semester', 'foraldraledighet', 'sjuk', 'ffu', 'vab'].includes(type)) {
        dayEditorStartTime.value = '';
        dayEditorEndTime.value = '';
        dayEditorTurn.value = '';
      }
    }
  }
}

/**
 * Restore original field values when deselecting a type chip
 */
function restoreOriginalFields() {
  if (!currentEditingDay) return;

  const shift = currentEditingDay.shift;

  // If no original shift or it was a special type, clear fields
  if (!shift || ['fp', 'fpv', 'semester', 'foraldraledighet', 'sjuk', 'ffu', 'vab'].includes(shift.badge)) {
    dayEditorStartTime.value = '';
    dayEditorEndTime.value = '';
    dayEditorTurn.value = '';
    return;
  }

  // Restore original working shift data
  if (shift.time && shift.time !== '-') {
    const timeParts = shift.time.split('-');
    if (timeParts.length === 2) {
      dayEditorStartTime.value = timeParts[0].trim();
      dayEditorEndTime.value = timeParts[1].trim();
    } else {
      dayEditorStartTime.value = shift.time;
      dayEditorEndTime.value = '';
    }
  } else {
    dayEditorStartTime.value = '';
    dayEditorEndTime.value = '';
  }

  dayEditorTurn.value = shift.badgeText || '';
}

/**
 * Get display badge text from type
 */
function getTypeBadgeText(type) {
  const typeMap = {
    'fp': 'FP',
    'fpv': 'FPV',
    'semester': 'Semester',
    'foraldraledighet': 'Föräldraledighet',
    'sjuk': 'Sjuk',
    'ffu': 'FFU',
    'vab': 'VAB'
  };
  return typeMap[type] || type.toUpperCase();
}

/**
 * Save the day edit
 */
async function saveDayEdit() {
  if (!currentEditingDay) return;

  const { dateKey, employeeId, shift: originalShift } = currentEditingDay;
  const btn = dayEditorSave;

  // Get values
  const startTime = dayEditorStartTime.value.trim();
  const endTime = dayEditorEndTime.value.trim();
  const turn = dayEditorTurn.value.trim();

  // Get selected type
  const selectedChip = document.querySelector('.day-editor-chip.selected');
  const selectedType = selectedChip?.dataset.type || '';

  // Build the new shift data
  let newShift = null;

  if (selectedType) {
    // Special type (FP, FPV, Sem, etc.)
    newShift = {
      employeeId,
      badge: selectedType,
      badgeText: getTypeBadgeText(selectedType),
      time: '-',
      edited: true
    };
  } else if (startTime || turn) {
    // Regular working shift
    const timeStr = (startTime && endTime) ? `${startTime}-${endTime}` : (startTime || '-');
    newShift = {
      employeeId,
      badge: 'dag',
      badgeText: turn || '',
      time: timeStr,
      edited: true
    };
  }
  // If all empty, we remove the shift

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = '⏳ Sparar...';

  try {
    // Save to Firebase
    await saveDayEditToFirebase(dateKey, employeeId, newShift);

    // Update local data
    if (!employeesData[dateKey]) {
      employeesData[dateKey] = [];
    }

    // Remove existing shift for this employee on this date
    employeesData[dateKey] = employeesData[dateKey].filter(s => s.employeeId !== employeeId);

    // Add new shift if we have one
    if (newShift) {
      employeesData[dateKey].push(newShift);
    }

    // Refresh UI
    renderPersonSchedule();
    renderEmployees();

    // Close editor
    closeDayEditor();
    showToast('Dagen uppdaterad', 'success');

  } catch (error) {
    console.error('Error saving day edit:', error);
    showToast('Kunde inte spara: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 Spara';
  }
}

// ==========================================
// VIKTIGA DATUM (Important Dates) - Firebase synced
// ==========================================

let importantDates = [];

/**
 * Initialize important dates from Firebase with real-time listener
 */
async function initImportantDates() {
  // Set up real-time listener for important dates
  db.collection('importantDates').orderBy('date').onSnapshot(snapshot => {
    importantDates = [];
    snapshot.forEach(doc => {
      importantDates.push({ id: doc.id, ...doc.data() });
    });
    renderImportantDatesList();
    renderImportantDateCards();
  }, error => {
    console.log('Could not load important dates:', error);
  });

  // Set up collapsible section
  const header = document.getElementById('importantDatesHeader');
  const section = document.getElementById('importantDatesSection');
  if (header && section) {
    header.addEventListener('click', () => {
      section.classList.toggle('expanded');
    });
  }
}

/**
 * Add a new important date to Firebase
 */
async function addImportantDate() {
  const titleEl = document.getElementById('importantDateTitle');
  const dateEl = document.getElementById('importantDateDate');
  const timeEl = document.getElementById('importantDateTime');
  const descEl = document.getElementById('importantDateDesc');

  const title = titleEl.value.trim();
  const date = dateEl.value;
  const time = timeEl.value;
  const desc = descEl.value.trim();

  if (!title) {
    showToast('Ange en rubrik', 'error');
    return;
  }

  if (!date) {
    showToast('Ange ett datum', 'error');
    return;
  }

  const newDate = {
    title,
    date,
    time,
    description: desc,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    updateSyncStatus('syncing');
    await db.collection('importantDates').add(newDate);

    // Clear form
    titleEl.value = '';
    dateEl.value = '';
    timeEl.value = '';
    descEl.value = '';

    showToast('Datum tillagt', 'success');
  } catch (e) {
    console.log('Could not save important date:', e);
    showToast('Kunde inte spara datum', 'error');
  }
}

/**
 * Delete an important date from Firebase
 */
async function deleteImportantDate(id) {
  try {
    updateSyncStatus('syncing');
    await db.collection('importantDates').doc(id).delete();
    showToast('Datum borttaget', 'success');
  } catch (e) {
    console.log('Could not delete important date:', e);
    showToast('Kunde inte radera datum', 'error');
  }
}

/**
 * Render the list of important dates in settings (collapsible items)
 */
function renderImportantDatesList() {
  const listEl = document.getElementById('importantDatesList');
  if (!listEl) return;

  if (importantDates.length === 0) {
    listEl.innerHTML = '<div class="important-dates-empty">Inga viktiga datum tillagda</div>';
    return;
  }

  // Sort by date
  const sortedDates = [...importantDates].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  listEl.innerHTML = sortedDates.map(d => {
    const dateObj = new Date(d.date + 'T00:00:00');
    const dateStr = dateObj.toLocaleDateString('sv-SE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });

    return `
      <div class="important-date-item" data-id="${d.id}">
        <div class="important-date-item-header" onclick="toggleImportantDateItem(this)">
          <div class="date-icon">📌</div>
          <div class="date-info">
            <div class="date-title">${d.title}</div>
            <div class="date-subtitle">${dateStr}</div>
          </div>
          <span class="date-chevron">›</span>
        </div>
        <div class="important-date-item-content">
          <div class="important-date-item-details">
            <div class="date-time-row">
              <span>📅 ${dateStr}</span>
              ${d.time ? `<span>🕐 ${d.time}</span>` : ''}
            </div>
            ${d.description ? `<div class="date-description">${d.description}</div>` : ''}
            <button class="date-delete" onclick="deleteImportantDate('${d.id}')">
              🗑️ Radera
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Toggle expand/collapse for important date item in settings
 */
function toggleImportantDateItem(header) {
  const item = header.closest('.important-date-item');
  if (item) {
    item.classList.toggle('expanded');
  }
}

/**
 * Render important date cards on the main page (compact, expandable)
 */
function renderImportantDateCards() {
  // Get or create container
  let container = document.getElementById('importantDatesContainer');
  if (!container) {
    // Create container before employee list
    const employeeList = document.getElementById('employeeList');
    if (employeeList) {
      container = document.createElement('div');
      container.id = 'importantDatesContainer';
      employeeList.parentNode.insertBefore(container, employeeList);
    } else {
      return;
    }
  }

  // Filter dates for currently viewed date (currentDate from ui.js)
  const viewingDate = new Date(currentDate);
  viewingDate.setHours(0, 0, 0, 0);

  const relevantDates = importantDates.filter(d => {
    const dateObj = new Date(d.date + 'T00:00:00');
    return dateObj.toDateString() === viewingDate.toDateString();
  });

  if (relevantDates.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = relevantDates.map(d => {
    const timeStr = d.time ? `kl ${d.time}` : '';
    const hasDesc = d.description && d.description.trim().length > 0;

    return `
      <div class="important-date-card" onclick="toggleImportantDateCard(this)">
        <div class="important-date-card-header">
          <span class="important-date-card-icon">📌</span>
          <span class="important-date-card-title">${d.title}</span>
          ${timeStr ? `<span class="important-date-card-time">${timeStr}</span>` : ''}
          ${hasDesc ? `<span class="important-date-card-chevron">▼</span>` : ''}
        </div>
        ${hasDesc ? `
          <div class="important-date-card-content">
            <div class="important-date-card-desc">${d.description}</div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Toggle expand/collapse for important date card on main page
 */
function toggleImportantDateCard(card) {
  card.classList.toggle('expanded');
}
