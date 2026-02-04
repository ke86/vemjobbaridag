/**
 * app.js - Main Application Entry Point
 * Initializes the app and sets up event listeners
 */

/**
 * Initialize the application
 */
function initApp() {
  // Initialize UI elements
  initUI();

  // Initialize authentication
  initAuth();

  // Setup event listeners
  setupEventListeners();

  // Setup dark mode
  setupDarkMode();
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Sidebar navigation
  menuBtn.addEventListener('click', openSidebar);
  closeSidebarBtn.addEventListener('click', closeSidebarMenu);
  sidebarOverlay.addEventListener('click', closeSidebarMenu);

  // Day navigation
  prevDayBtn.addEventListener('click', goToPrevDay);
  nextDayBtn.addEventListener('click', goToNextDay);

  // Lediga filter
  if (showLedigaCheckbox) {
    showLedigaCheckbox.addEventListener('change', renderEmployees);
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goToPrevDay();
    if (e.key === 'ArrowRight') goToNextDay();
    if (e.key === 'Escape') closeSidebarMenu();
  });

  // Touch swipe support
  let touchStartX = 0;
  let touchEndX = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });

  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        goToNextDay();
      } else {
        goToPrevDay();
      }
    }
  }

  // Menu navigation
  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) {
        showPage(page);
        // If clicking "Dagens schema" - always go to today
        if (page === 'schedule') {
          goToToday();
        }
      }
    });
  });

  // Native date picker
  if (nativeDatePicker) {
    nativeDatePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        goToDate(e.target.value);
      }
    });

    // Initialize with current date
    updateNativeDatePicker();
  }

  // Month navigation
  prevMonthBtn.addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    renderPersonSchedule();
  });

  nextMonthBtn.addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    renderPersonSchedule();
  });

  // View toggle (calendar/list)
  monthlyScheduleList.addEventListener('click', (e) => {
    const toggle = e.target.closest('#viewToggleSwitch');
    if (toggle) {
      currentScheduleView = currentScheduleView === 'calendar' ? 'list' : 'calendar';
      renderPersonSchedule();
    }
  });

  // File upload events
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  // Remove file button
  removeFileBtn.addEventListener('click', removeFile);

  // Process file button
  processBtn.addEventListener('click', processFile);

  // Export calendar button
  exportCalBtn.addEventListener('click', exportToCalendar);

  // Delete data section (collapsible)
  if (deleteDataHeader) {
    deleteDataHeader.addEventListener('click', toggleDeleteDataSection);
  }

  // Delete confirmation modal
  if (deleteModalCancel) {
    deleteModalCancel.addEventListener('click', hideDeleteConfirmModal);
  }

  if (deleteModalConfirm) {
    deleteModalConfirm.addEventListener('click', confirmDeleteEmployee);
  }

  // Close modal on overlay click
  if (deleteConfirmModal) {
    deleteConfirmModal.addEventListener('click', (e) => {
      if (e.target === deleteConfirmModal) {
        hideDeleteConfirmModal();
      }
    });
  }
}

/**
 * Process uploaded file (PDF, CSV, or JSON)
 */
async function processFile() {
  if (!selectedFile) return;

  // Show processing state
  processBtn.classList.remove('active');
  filePreview.classList.remove('active');
  processingState.classList.add('active');
  processingText.textContent = 'Läser in fil...';

  try {
    const fileType = getFileType(selectedFile);
    let data;

    if (fileType === 'pdf') {
      processingText.textContent = 'Läser PDF...';
      data = await processPDFLocally(selectedFile);
    } else if (fileType === 'csv') {
      processingText.textContent = 'Läser CSV...';
      data = await processCSVFile(selectedFile);
    } else if (fileType === 'json') {
      processingText.textContent = 'Läser JSON...';
      data = await processJSONFile(selectedFile);
    } else {
      throw new Error('Okänt filformat');
    }

    // Import the parsed data
    importScheduleData(data);

    // Hide processing, show success
    processingState.classList.remove('active');
    uploadZone.style.display = 'block';

    // Reset file input
    selectedFile = null;
    fileInput.value = '';

    // Show success popup
    showSuccessPopup();

  } catch (err) {
    console.error('File processing error:', err);
    processingState.classList.remove('active');
    uploadZone.style.display = 'block';
    selectedFile = null;
    fileInput.value = '';
    showToast(err.message || 'Kunde inte läsa filen', 'error');
  }
}

/**
 * Export current month's schedule to iCal
 */
function exportToCalendar() {
  if (!selectedEmployeeId) return;

  const emp = registeredEmployees[selectedEmployeeId];
  if (!emp) return;

  const monthSchedule = getEmployeeMonthSchedule(selectedEmployeeId, viewYear, viewMonth);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // iCal header
  let icsContent = 'BEGIN:VCALENDAR\r\n';
  icsContent += 'VERSION:2.0\r\n';
  icsContent += 'PRODID:-//Vem jobbar idag//Schema Export//SV\r\n';
  icsContent += 'CALSCALE:GREGORIAN\r\n';
  icsContent += 'METHOD:PUBLISH\r\n';

  for (let day = 1; day <= daysInMonth; day++) {
    const shift = monthSchedule[day];
    if (!shift || !shift.time || shift.time === '-') continue;

    const serviceUpper = (shift.badgeText || '').toUpperCase();
    if (['FP', 'FPV', 'SEMESTER', 'FRÅNVARANDE', 'AFD'].includes(serviceUpper)) continue;

    const timeParts = shift.time.split('-');
    if (timeParts.length !== 2) continue;

    const startTime = timeParts[0].trim().replace(':', '');
    const endTime = timeParts[1].trim().replace(':', '');
    const dateStr = `${viewYear}${String(viewMonth + 1).padStart(2, '0')}${String(day).padStart(2, '0')}`;

    icsContent += 'BEGIN:VEVENT\r\n';
    icsContent += `DTSTART:${dateStr}T${startTime}00\r\n`;
    icsContent += `DTEND:${dateStr}T${endTime}00\r\n`;
    icsContent += `SUMMARY:Arbete - ${shift.badgeText}\r\n`;
    icsContent += `DESCRIPTION:${emp.name} - Pass ${shift.badgeText}\r\n`;
    icsContent += `UID:${dateStr}-${selectedEmployeeId}@vemjobbar.app\r\n`;
    icsContent += 'END:VEVENT\r\n';
  }

  icsContent += 'END:VCALENDAR\r\n';

  // Create blob and download
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schema_${emp.name.replace(/\s+/g, '_')}_${monthNamesFull[viewMonth]}_${viewYear}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Exporterat till kalender!', 'success');
}

/**
 * Setup dark mode toggle and detection
 */
function setupDarkMode() {
  // Check system preference on load
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
    if (darkModeToggle) darkModeToggle.checked = true;
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (event.matches) {
      document.documentElement.classList.add('dark');
      if (darkModeToggle) darkModeToggle.checked = true;
    } else {
      document.documentElement.classList.remove('dark');
      if (darkModeToggle) darkModeToggle.checked = false;
    }
  });

  // Toggle dark mode manually
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', () => {
      if (darkModeToggle.checked) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
