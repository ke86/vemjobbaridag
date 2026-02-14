// ==========================================
// NAVIGATION
// ==========================================

function goToPrevDay() {
  currentDate.setDate(currentDate.getDate() - 1);
  // Switch realtime listener to new date (single-doc for quota optimization)
  if (typeof switchScheduleListener === 'function') {
    switchScheduleListener(getDateKey(currentDate));
  }
  renderEmployees();
  updateNativeDatePicker();
}

function goToNextDay() {
  currentDate.setDate(currentDate.getDate() + 1);
  // Switch realtime listener to new date (single-doc for quota optimization)
  if (typeof switchScheduleListener === 'function') {
    switchScheduleListener(getDateKey(currentDate));
  }
  renderEmployees();
  updateNativeDatePicker();
}

/**
 * Go to today's date
 */
function goToToday() {
  currentDate = new Date();
  // Switch realtime listener to today's date (single-doc for quota optimization)
  if (typeof switchScheduleListener === 'function') {
    switchScheduleListener(getDateKey(currentDate));
  }
  renderEmployees();
  updateNativeDatePicker();

  // Visual feedback - briefly highlight the date
  if (currentDateEl) {
    currentDateEl.style.transition = 'color 0.2s';
    currentDateEl.style.color = 'var(--accent-blue)';
    setTimeout(() => {
      currentDateEl.style.color = '';
    }, 500);
  }
}

/**
 * Go to specific date from date picker
 */
function goToDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  currentDate = new Date(year, month - 1, day);
  // Switch realtime listener to new date (single-doc for quota optimization)
  if (typeof switchScheduleListener === 'function') {
    switchScheduleListener(getDateKey(currentDate));
  }
  renderEmployees();
}

/**
 * Update native date picker value to match current date
 */
function updateNativeDatePicker() {
  if (nativeDatePicker) {
    nativeDatePicker.value = getDateKey(currentDate);
  }
}

function openSidebar() {
  sidebar.classList.add('active');
  sidebarOverlay.classList.add('active');
}

function closeSidebarMenu() {
  sidebar.classList.remove('active');
  sidebarOverlay.classList.remove('active');
}

// ==========================================
// PAGE NAVIGATION
// ==========================================

function showPage(pageId) {
  // Close dagvy if open
  if (dagvyActive) {
    dagvyActive = false;
    const dagvyPage = document.getElementById('dagvyPage');
    if (dagvyPage) {
      dagvyPage.classList.remove('active');
      dagvyPage.innerHTML = '';
    }
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Stop AW party when leaving schedule page
  if (pageId !== 'schedule' && typeof stopAWParty === 'function') {
    stopAWParty();
  }

  if (pageId === 'schedule') {
    schedulePage.classList.add('active');
    headerTitle.textContent = 'Vem jobbar idag?';
  } else if (pageId === 'upload') {
    uploadPage.classList.add('active');
    headerTitle.textContent = 'Ladda upp schema';
  } else if (pageId === 'monthly') {
    monthlyPage.classList.add('active');
    headerTitle.textContent = 'Schema';
    showPersonListView();
    renderPersonList();
  } else if (pageId === 'shadow') {
    document.getElementById('shadowPage').classList.add('active');
    headerTitle.textContent = 'Skuggschema';
    showShadowPersonSelect();
    renderShadowPersonList();
  } else if (pageId === 'departure') {
    document.getElementById('departurePage').classList.add('active');
    headerTitle.textContent = 'Avgång/Ankomst';
    onDeparturePageShow();
  } else if (pageId === 'settings') {
    document.getElementById('settingsPage').classList.add('active');
    headerTitle.textContent = 'Inställningar';
    resetSettingsCollapse();
  } else if (pageId === 'trainFollow') {
    document.getElementById('trainFollowPage').classList.add('active');
    if (typeof onTrainFollowPageShow === 'function') onTrainFollowPageShow();
  } else if (pageId === 'la') {
    document.getElementById('laPage').classList.add('active');
    headerTitle.textContent = 'Dagens LA';
    if (typeof onLaPageShow === 'function') onLaPageShow();
  }

  // Stop departure refresh when leaving departure page
  if (pageId !== 'departure') {
    onDeparturePageHide();
  }

  // Stop train follow polling when leaving page
  if (pageId !== 'trainFollow') {
    if (typeof onTrainFollowPageHide === 'function') onTrainFollowPageHide();
  }

  // Close LA viewer when leaving LA page
  if (pageId !== 'la') {
    if (typeof onLaPageHide === 'function') onLaPageHide();
  }

  closeSidebarMenu();
}

/**
 * Reset all collapsible sections in settings to collapsed state
 */
function resetSettingsCollapse() {
  const collapsibleSections = document.querySelectorAll('.settings-section.collapsible');
  collapsibleSections.forEach(section => {
    section.classList.remove('expanded');
  });
}
