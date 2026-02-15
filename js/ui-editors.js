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

  // Set up collapsible section for saved dates (own top-level section)
  const savedHeader = document.getElementById('savedDatesHeader');
  const savedSection = document.getElementById('savedDatesSection');
  if (savedHeader && savedSection) {
    savedHeader.addEventListener('click', () => {
      savedSection.classList.toggle('expanded');
    });
  }
}

/**
 * Format description text for safe HTML display.
 * - Escapes HTML entities to prevent XSS
 * - Converts URLs (http/https) to clickable <a> links
 * - Converts newlines to <br> for readability
 */
function formatDescription(text) {
  if (!text) return '';

  // 1. HTML-escape
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // 2. Convert URLs to clickable links
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const withLinks = escaped.replace(urlRegex, (url) => {
    // Trim trailing punctuation that's likely not part of the URL
    let cleanUrl = url;
    const trailingPunct = /[.,;:!?)]+$/;
    const match = cleanUrl.match(trailingPunct);
    let suffix = '';
    if (match) {
      suffix = match[0];
      cleanUrl = cleanUrl.slice(0, -suffix.length);
    }
    // Truncate display text if too long
    const displayUrl = cleanUrl.length > 45
      ? cleanUrl.substring(0, 42) + '...'
      : cleanUrl;
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="desc-link" onclick="event.stopPropagation()">${displayUrl}</a>${suffix}`;
  });

  // 3. Convert newlines to <br>
  return withLinks.replace(/\n/g, '<br>');
}

// Temporary storage for compressed image data URL
let pendingImageDataUrl = null;

/**
 * Handle image file selection and show preview
 */
function handleImagePreview(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('Välj en bildfil', 'error');
    return;
  }

  // Validate file size (max 10MB before compression)
  if (file.size > 10 * 1024 * 1024) {
    showToast('Bilden är för stor (max 10MB)', 'error');
    return;
  }

  compressImage(file, (dataUrl) => {
    pendingImageDataUrl = dataUrl;
    const previewImg = document.getElementById('imagePreviewImg');
    const placeholder = document.getElementById('imageUploadPlaceholder');
    const preview = document.getElementById('imageUploadPreview');
    if (previewImg && placeholder && preview) {
      previewImg.src = dataUrl;
      placeholder.style.display = 'none';
      preview.style.display = 'block';
    }
  });
}

/**
 * Remove image preview and clear pending image
 */
function removeImagePreview() {
  pendingImageDataUrl = null;
  const input = document.getElementById('importantDateImage');
  const placeholder = document.getElementById('imageUploadPlaceholder');
  const preview = document.getElementById('imageUploadPreview');
  if (input) input.value = '';
  if (placeholder) placeholder.style.display = '';
  if (preview) preview.style.display = 'none';
}

/**
 * Compress image using canvas — max 800px wide, JPEG 0.7 quality
 * Keeps output under ~200KB for Firestore compatibility
 */
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Scale down if wider than 800px
      const MAX_WIDTH = 800;
      if (width > MAX_WIDTH) {
        height = Math.round(height * (MAX_WIDTH / width));
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Try JPEG at 0.7 quality first
      let dataUrl = canvas.toDataURL('image/jpeg', 0.7);

      // If still too large (>800KB), reduce quality further
      if (dataUrl.length > 800000) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      }
      if (dataUrl.length > 800000) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.3);
      }

      callback(dataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
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

  // Add image if one was selected
  if (pendingImageDataUrl) {
    newDate.image = pendingImageDataUrl;
  }

  try {
    updateSyncStatus('syncing');
    await db.collection('importantDates').add(newDate);

    // Clear form
    titleEl.value = '';
    dateEl.value = '';
    timeEl.value = '';
    descEl.value = '';
    removeImagePreview();

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
 * Show a confirm-delete dialog for an important date.
 * Prevents event from bubbling to the expandable header.
 */
function confirmDeleteDate(e, id, title) {
  e.stopPropagation();
  // Build overlay
  const overlay = document.createElement('div');
  overlay.className = 'date-confirm-overlay';
  overlay.innerHTML =
    '<div class="date-confirm-box">' +
      '<p class="date-confirm-msg">Radera <strong>' + title.replace(/</g, '&lt;') + '</strong>?</p>' +
      '<div class="date-confirm-actions">' +
        '<button class="date-confirm-cancel">Avbryt</button>' +
        '<button class="date-confirm-delete">Radera</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('visible'));

  overlay.querySelector('.date-confirm-cancel').addEventListener('click', () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  });
  overlay.querySelector('.date-confirm-delete').addEventListener('click', () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
    deleteImportantDate(id);
  });
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
    }
  });
}

/**
 * Render the list of important dates in settings (collapsible items)
 */
function renderImportantDatesList() {
  const listEl = document.getElementById('importantDatesList');
  if (!listEl) return;

  // Update count badge
  const countEl = document.getElementById('savedDatesCount');
  if (countEl) countEl.textContent = importantDates.length;

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

    const hasImage = d.image && d.image.length > 0;

    const safeTitle = d.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `
      <div class="important-date-item" data-id="${d.id}">
        <div class="important-date-item-header" onclick="toggleImportantDateItem(this)">
          <div class="date-icon">📌</div>
          <div class="date-info">
            <div class="date-title"><span class="marquee-inner">${d.title}</span></div>
            <div class="date-subtitle">${dateStr}</div>
          </div>
          <button class="date-inline-delete" onclick="confirmDeleteDate(event, '${d.id}', '${safeTitle}')" title="Radera">✕</button>
          <span class="date-chevron">›</span>
        </div>
        <div class="important-date-item-content">
          <div class="important-date-item-details">
            <div class="date-time-row">
              <span>📅 ${dateStr}</span>
              ${d.time ? `<span>🕐 ${d.time}</span>` : ''}
            </div>
            ${hasImage ? `<div class="date-detail-image"><img src="${d.image}" alt="${d.title}"></div>` : ''}
            ${d.description ? `<div class="date-description">${formatDescription(d.description)}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Check for long titles that need marquee scrolling
  requestAnimationFrame(() => initMarqueeScrolls(listEl));
}

/**
 * Initialize marquee scrolling for titles that overflow their container.
 * Checks each .marquee-inner element — if it's wider than its parent,
 * adds the marquee-scroll class and sets CSS custom properties for distance/duration.
 */
function initMarqueeScrolls(container) {
  if (!container) return;
  const titles = container.querySelectorAll('.marquee-inner');
  titles.forEach(inner => {
    const parent = inner.parentElement;
    if (!parent) return;

    // Reset first
    parent.classList.remove('marquee-scroll');
    inner.style.removeProperty('--marquee-distance');
    inner.style.removeProperty('--marquee-duration');

    const innerWidth = inner.scrollWidth;
    const parentWidth = parent.clientWidth;

    if (innerWidth > parentWidth + 2) {
      // Calculate how far to scroll (negative = scroll left)
      const overflow = innerWidth - parentWidth;
      parent.style.setProperty('--marquee-distance', `-${overflow + 40}px`);
      // Speed: ~50px/s, min 4s, max 15s
      const duration = Math.min(15, Math.max(4, (overflow + 40) / 50));
      parent.style.setProperty('--marquee-duration', `${duration.toFixed(1)}s`);
      parent.classList.add('marquee-scroll');
    }
  });
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
    stopAWParty();
    return;
  }

  container.innerHTML = relevantDates.map(d => {
    const timeStr = d.time ? `kl ${d.time}` : '';
    const hasDesc = d.description && d.description.trim().length > 0;
    const hasImage = d.image && d.image.length > 0;
    const hasContent = hasDesc || hasImage;

    return `
      <div class="important-date-card" onclick="toggleImportantDateCard(this)">
        <div class="important-date-card-header">
          <span class="important-date-card-icon">📌</span>
          <span class="important-date-card-title"><span class="marquee-inner">${d.title}</span></span>
          ${timeStr ? `<span class="important-date-card-time">${timeStr}</span>` : ''}
          ${hasContent ? `<span class="important-date-card-chevron">▼</span>` : ''}
        </div>
        ${hasContent ? `
          <div class="important-date-card-content">
            ${hasImage ? `<div class="important-date-card-image"><img src="${d.image}" alt="${d.title}"></div>` : ''}
            ${hasDesc ? `<div class="important-date-card-desc">${formatDescription(d.description)}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Check for long titles that need marquee scrolling
  requestAnimationFrame(() => initMarqueeScrolls(container));

  // AW party mode!
  const hasAW = relevantDates.some(function(d) { return /\bAW\b/i.test(d.title); });
  if (hasAW) {
    startAWParty();
  } else {
    stopAWParty();
  }
}

/**
 * Start the AW party — floating beer and drink emojis
 */
function startAWParty() {
  // Don't duplicate
  if (document.getElementById('awPartyOverlay')) return;

  var overlay = document.createElement('div');
  overlay.id = 'awPartyOverlay';
  overlay.className = 'aw-party-overlay';

  var emojis = ['🍺', '🍻', '🍹', '🥂', '🎉', '🥳', '🍾', '🍸'];
  var count = 18;

  for (var i = 0; i < count; i++) {
    var span = document.createElement('span');
    span.className = 'aw-emoji';
    span.textContent = emojis[i % emojis.length];

    // Randomize position, size, speed, delay
    var left = Math.random() * 100;
    var size = 20 + Math.random() * 18;
    var duration = 6 + Math.random() * 8;
    var delay = Math.random() * duration;
    var swayAmount = 30 + Math.random() * 60;
    var swayDir = Math.random() > 0.5 ? 1 : -1;

    span.style.cssText = 'left:' + left + '%;'
      + 'font-size:' + size + 'px;'
      + 'animation-duration:' + duration + 's;'
      + 'animation-delay:-' + delay + 's;'
      + '--aw-sway:' + (swayAmount * swayDir) + 'px;';

    overlay.appendChild(span);
  }

  document.body.appendChild(overlay);
}

/**
 * Stop the AW party — remove overlay
 */
function stopAWParty() {
  var overlay = document.getElementById('awPartyOverlay');
  if (overlay) overlay.remove();
}

/**
 * Toggle expand/collapse for important date card on main page
 */
function toggleImportantDateCard(card) {
  card.classList.toggle('expanded');
}
