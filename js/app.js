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

  // Initialize Fridagsnyckel UI
  initFridagsUI();

  // Initialize Day Editor
  initDayEditor();

  // Initialize Month Picker
  initMonthPicker();

  // Initialize Holiday Animations
  initHolidayAnimations();

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

  // Holidays button
  if (holidaysBtn) {
    holidaysBtn.addEventListener('click', toggleHolidaysModal);
  }
  if (holidaysClose) {
    holidaysClose.addEventListener('click', () => holidaysModal.classList.remove('active'));
  }

  // Delete data section (collapsible)
  if (deleteDataHeader) {
    deleteDataHeader.addEventListener('click', toggleDeleteDataSection);
  }

  // Fridagsnyckel section (collapsible)
  if (fridagsHeader) {
    fridagsHeader.addEventListener('click', toggleFridagsSection);
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

  // Check for updates button
  const checkUpdateBtn = document.getElementById('checkUpdateBtn');
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', checkForUpdates);
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
async function setupDarkMode() {
  // Load saved preference from IndexedDB
  const savedDarkMode = await loadSetting('darkMode');

  if (savedDarkMode !== null) {
    // Use saved preference
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
      if (darkModeToggle) darkModeToggle.checked = true;
    } else {
      document.documentElement.classList.remove('dark');
      if (darkModeToggle) darkModeToggle.checked = false;
    }
  } else {
    // No saved preference - default to light mode
    document.documentElement.classList.remove('dark');
    if (darkModeToggle) darkModeToggle.checked = false;
  }

  // Listen for system theme changes (only if no saved preference)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async event => {
    const saved = await loadSetting('darkMode');
    if (saved === null) {
      // Only follow system if user hasn't manually set preference
      if (event.matches) {
        document.documentElement.classList.add('dark');
        if (darkModeToggle) darkModeToggle.checked = true;
      } else {
        document.documentElement.classList.remove('dark');
        if (darkModeToggle) darkModeToggle.checked = false;
      }
    }
  });

  // Toggle dark mode manually and save preference
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', async () => {
      const isDark = darkModeToggle.checked;
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      // Save preference to IndexedDB
      await saveSetting('darkMode', isDark);
    });
  }
}

/**
 * Check for app updates via Service Worker
 */
async function checkForUpdates() {
  const btn = document.getElementById('checkUpdateBtn');
  const statusEl = document.getElementById('versionStatus');

  if (!btn || !statusEl) return;

  // Show checking state
  btn.classList.add('checking');
  btn.innerHTML = '<span class="update-icon">🔄</span> Söker...';
  statusEl.textContent = 'Kontrollerar...';
  statusEl.className = 'version-status checking';

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();

      if (registration) {
        // Force check for updates
        await registration.update();

        // Wait a moment for the update check
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (registration.waiting) {
          // New version available and waiting
          btn.classList.remove('checking');
          btn.classList.add('has-update');
          btn.innerHTML = '<span class="update-icon">⬇️</span> Installera uppdatering';
          statusEl.textContent = 'Ny version tillgänglig!';
          statusEl.className = 'version-status update-available';

          // Change button to install update
          btn.onclick = () => {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            statusEl.textContent = 'Installerar...';
            btn.classList.add('checking');
          };
        } else if (registration.installing) {
          // Update is being installed
          statusEl.textContent = 'Installerar uppdatering...';
          statusEl.className = 'version-status checking';
          btn.classList.remove('checking');
          btn.innerHTML = '<span class="update-icon">🔄</span> Sök efter uppdatering';
        } else {
          // No update available
          btn.classList.remove('checking');
          btn.innerHTML = '<span class="update-icon">🔄</span> Sök efter uppdatering';
          statusEl.textContent = '✓ Du har senaste versionen';
          statusEl.className = 'version-status';
        }
      } else {
        // No service worker registered
        btn.classList.remove('checking');
        btn.innerHTML = '<span class="update-icon">🔄</span> Sök efter uppdatering';
        statusEl.textContent = 'Service worker ej registrerad';
        statusEl.className = 'version-status';
      }
    } else {
      statusEl.textContent = 'Uppdateringar stöds ej i denna webbläsare';
      statusEl.className = 'version-status';
      btn.classList.remove('checking');
      btn.innerHTML = '<span class="update-icon">🔄</span> Sök efter uppdatering';
    }
  } catch (error) {
    console.error('Update check failed:', error);
    btn.classList.remove('checking');
    btn.innerHTML = '<span class="update-icon">🔄</span> Sök efter uppdatering';
    statusEl.textContent = 'Kunde inte kontrollera uppdateringar';
    statusEl.className = 'version-status';
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
