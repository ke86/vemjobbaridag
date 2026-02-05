/**
 * ui-fridag.js - Fridagsnyckel Functions
 * Handles fridagsnyckel (day-off key) assignment and management
 */

// ==========================================
// FRIDAGSNYCKEL UI ELEMENTS
// ==========================================

let fridagsSection, fridagsHeader, fridagEmployeeList;

/**
 * Initialize Fridagsnyckel UI elements
 */
function initFridagsUI() {
  fridagsSection = document.getElementById('fridagsSection');
  fridagsHeader = document.getElementById('fridagsHeader');
  fridagEmployeeList = document.getElementById('fridagEmployeeList');
}

/**
 * Toggle the collapsible fridagsnyckel section
 */
function toggleFridagsSection() {
  if (fridagsSection) {
    fridagsSection.classList.toggle('expanded');
    if (fridagsSection.classList.contains('expanded')) {
      renderFridagEmployeeList();
    }
  }
}

/**
 * Build dropdown options for fridagsnycklar
 * Grouped by type (TV/LF) and sorted
 */
function buildFridagKeyOptions() {
  const tvKeys = [];
  const lfKeys = [];

  for (const [key, data] of Object.entries(FRIDAG_KEYS)) {
    const option = { key, name: data.name, cycle: data.cycle };
    if (key.startsWith('TV')) {
      tvKeys.push(option);
    } else {
      lfKeys.push(option);
    }
  }

  // Sort by key name
  tvKeys.sort((a, b) => a.key.localeCompare(b.key));
  lfKeys.sort((a, b) => a.key.localeCompare(b.key));

  let options = '<option value="">-- Välj nyckel --</option>';
  options += '<optgroup label="Tågvärdar (TV)">';
  for (const opt of tvKeys) {
    options += `<option value="${opt.key}">${opt.key} - ${opt.name} (${opt.cycle}v)</option>`;
  }
  options += '</optgroup>';
  options += '<optgroup label="Lokförare (LF)">';
  for (const opt of lfKeys) {
    options += `<option value="${opt.key}">${opt.key} - ${opt.name} (${opt.cycle}v)</option>`;
  }
  options += '</optgroup>';

  return options;
}

/**
 * Build dropdown options for row numbers based on selected key
 */
function buildRowOptions(cycleSize) {
  let options = '<option value="">-- Välj rad --</option>';
  for (let i = 1; i <= cycleSize; i++) {
    options += `<option value="${i}">Rad ${i}</option>`;
  }
  return options;
}

/**
 * Handle fridagnyckel selection change - update row dropdown
 */
function onFridagKeyChange(employeeId, selectElement) {
  const selectedKey = selectElement.value;
  const rowSelect = document.getElementById(`fridag-row-${employeeId}`);

  if (!rowSelect) return;

  if (!selectedKey) {
    rowSelect.innerHTML = '<option value="">-- Välj nyckel först --</option>';
    rowSelect.disabled = true;
    return;
  }

  const keyData = FRIDAG_KEYS[selectedKey];
  if (keyData) {
    rowSelect.innerHTML = buildRowOptions(keyData.cycle);
    rowSelect.disabled = false;
  }
}

/**
 * Render the list of employees with fridagsnyckel controls (compact design)
 */
function renderFridagEmployeeList() {
  if (!fridagEmployeeList) return;

  const employees = getSortedEmployees();

  if (employees.length === 0) {
    fridagEmployeeList.innerHTML = `
      <div class="fridag-empty">
        <p>Inga anställda registrerade ännu.</p>
        <p>Ladda upp ett schema först.</p>
      </div>
    `;
    return;
  }

  const keyOptions = buildFridagKeyOptions();

  fridagEmployeeList.innerHTML = employees.map(emp => {
    // Get saved fridagsnyckel if any
    const savedKey = emp.fridagsnyckel || '';
    const savedRow = emp.fridagsrad || '';
    const keyData = savedKey ? FRIDAG_KEYS[savedKey] : null;
    const rowOptions = keyData ? buildRowOptions(keyData.cycle) : '<option value="">-- Välj nyckel först --</option>';
    const hasKey = savedKey && savedRow;

    // Status text - either "Välj fridagsnyckel" or "LFMC12 Rad 4"
    const statusText = hasKey
      ? `${savedKey} Rad ${savedRow}`
      : 'Välj fridagsnyckel';

    // If hasKey, row is locked (can't expand) - must remove first
    const rowClickable = !hasKey;
    const rowClass = hasKey ? 'fridag-employee-row locked' : 'fridag-employee-row';
    const rowOnClick = rowClickable ? `onclick="toggleFridagExpand('${emp.employeeId}')"` : '';

    return `
      <div class="fridag-employee-item compact ${hasKey ? '' : ''}" id="fridag-item-${emp.employeeId}">
        <div class="${rowClass}" ${rowOnClick}>
          <div class="fridag-employee-left">
            <div class="avatar ${emp.color}">${emp.initials}</div>
            <div class="fridag-employee-info">
              <span class="name">${emp.name}</span>
              <span class="fridag-key-status ${hasKey ? 'has-key' : 'no-key'}">
                ${statusText}
                ${!hasKey ? '<span class="expand-icon">▼</span>' : ''}
              </span>
            </div>
          </div>
          ${hasKey ? `
            <button class="fridag-remove-btn" onclick="event.stopPropagation(); confirmRemoveFridagsnyckel('${emp.employeeId}', '${emp.name}')" title="Ta bort fridagsnyckel">
              ✕
            </button>
          ` : ''}
        </div>
        ${!hasKey ? `
        <div class="fridag-expand-content" id="fridag-expand-${emp.employeeId}">
          <div class="fridag-selects">
            <div class="fridag-select-row">
              <label>Nyckel:</label>
              <select id="fridag-key-${emp.employeeId}" onchange="onFridagKeyChange('${emp.employeeId}', this)">
                ${keyOptions}
              </select>
            </div>
            <div class="fridag-select-row">
              <label>Rad:</label>
              <select id="fridag-row-${emp.employeeId}" disabled>
                <option value="">-- Välj nyckel först --</option>
              </select>
            </div>
          </div>
          <div class="fridag-actions">
            <button class="fridag-apply-btn" id="fridag-btn-${emp.employeeId}" onclick="applyFridagsnyckel('${emp.employeeId}')">
              Applicera
            </button>
          </div>
          <div class="fridag-status" id="fridag-status-${emp.employeeId}"></div>
        </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Toggle expand/collapse for a fridagsnyckel item
 */
function toggleFridagExpand(employeeId) {
  const item = document.getElementById(`fridag-item-${employeeId}`);
  if (item) {
    item.classList.toggle('expanded');
  }
}

/**
 * Show confirmation modal to remove fridagsnyckel
 */
function confirmRemoveFridagsnyckel(employeeId, employeeName) {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'fridag-modal-overlay';
  modal.id = 'fridagRemoveModal';
  modal.innerHTML = `
    <div class="fridag-modal">
      <div class="fridag-modal-header">
        <h3>Ta bort fridagsnyckel</h3>
      </div>
      <div class="fridag-modal-body">
        <p>Är du säker på att du vill ta bort <strong>${employeeName}s</strong> fridagsnyckel?</p>
        <p class="fridag-modal-note">FP/FPV-dagar från fridagsnyckeln tas bort. Uppladdade scheman bevaras.</p>
      </div>
      <div class="fridag-modal-footer">
        <button class="fridag-modal-btn cancel" onclick="closeFridagModal()">Avbryt</button>
        <button class="fridag-modal-btn confirm" onclick="removeFridagsnyckel('${employeeId}')">Ta bort</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeFridagModal();
  });
}

/**
 * Close the fridagsnyckel removal modal
 */
function closeFridagModal() {
  const modal = document.getElementById('fridagRemoveModal');
  if (modal) modal.remove();
}

/**
 * Remove fridagsnyckel from an employee
 */
async function removeFridagsnyckel(employeeId) {
  // Don't close modal - update it to show progress
  const modal = document.getElementById('fridagRemoveModal');
  const modalBody = modal?.querySelector('.fridag-modal-body');
  const modalFooter = modal?.querySelector('.fridag-modal-footer');

  try {
    // Get the employee's current fridagsnyckel to know which shifts to remove
    const employee = registeredEmployees[employeeId];
    if (!employee || !employee.fridagsnyckel) {
      throw new Error('Ingen fridagsnyckel att ta bort');
    }

    // Update modal to show progress
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="fridag-remove-progress">
          <p>Tar bort fridagar...</p>
          <div class="fridag-progress-bar">
            <div class="fridag-progress-fill" id="removeProgressFill"></div>
          </div>
          <p class="fridag-progress-text" id="removeProgressText">Förbereder...</p>
        </div>
      `;
    }
    if (modalFooter) {
      modalFooter.style.display = 'none';
    }

    // Progress callback to update modal
    const onProgress = (processed, total) => {
      const percent = Math.round((processed / total) * 100);
      const progressFill = document.getElementById('removeProgressFill');
      const progressText = document.getElementById('removeProgressText');
      if (progressFill) {
        progressFill.style.width = `${percent}%`;
      }
      if (progressText) {
        progressText.textContent = `${processed}/${total} (${percent}%)`;
      }
    };

    // Remove from Firebase and local data with progress
    await removeFridagShiftsFromFirebase(employeeId, onProgress);

    // Update local employee record
    delete registeredEmployees[employeeId].fridagsnyckel;
    delete registeredEmployees[employeeId].fridagsrad;

    // Show success briefly then close
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="fridag-remove-success">
          <p>✓ Fridagsnyckel borttagen!</p>
        </div>
      `;
    }

    // Close modal after short delay and refresh UI
    setTimeout(() => {
      closeFridagModal();
      renderEmployees();
      renderFridagEmployeeList();
    }, 800);

    console.log(`Fridagsnyckel removed for ${employeeId}`);
  } catch (error) {
    console.error('Error removing fridagsnyckel:', error);
    // Show error in modal
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="fridag-remove-error">
          <p>Ett fel uppstod: ${error.message}</p>
        </div>
      `;
    }
    if (modalFooter) {
      modalFooter.innerHTML = `
        <button class="fridag-modal-btn cancel" onclick="closeFridagModal()">Stäng</button>
      `;
      modalFooter.style.display = 'flex';
    }
  }
}

/**
 * Apply fridagsnyckel for an employee
 * Generates FP/FPV shifts from March 1, 2026 to Feb 28, 2027
 */
async function applyFridagsnyckel(employeeId) {
  const keySelect = document.getElementById(`fridag-key-${employeeId}`);
  const rowSelect = document.getElementById(`fridag-row-${employeeId}`);
  const btn = document.getElementById(`fridag-btn-${employeeId}`);
  const statusEl = document.getElementById(`fridag-status-${employeeId}`);

  const selectedKey = keySelect?.value;
  const selectedRow = parseInt(rowSelect?.value, 10);

  // Validate
  if (!selectedKey) {
    showFridagStatus(statusEl, 'Välj en fridagsnyckel', 'error');
    return;
  }
  if (!selectedRow) {
    showFridagStatus(statusEl, 'Välj en startrad', 'error');
    return;
  }

  const keyData = FRIDAG_KEYS[selectedKey];
  if (!keyData) {
    showFridagStatus(statusEl, 'Ogiltig nyckel', 'error');
    return;
  }

  // Show loading state
  btn.classList.add('loading');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.innerHTML = '<span class="progress-text">Förbereder...</span>';

  try {
    // Generate FP/FPV shifts
    const shifts = generateFridagShifts(employeeId, selectedKey, selectedRow);

    // Progress callback to update button text
    const onProgress = (processed, total) => {
      const percent = Math.round((processed / total) * 100);
      btn.innerHTML = `<span class="progress-text">${processed}/${total} (${percent}%)</span>`;
    };

    // Save to Firebase with progress updates
    await saveFridagShiftsToFirebase(employeeId, selectedKey, selectedRow, shifts, onProgress);

    // Update local data
    for (const shift of shifts) {
      if (!employeesData[shift.date]) {
        employeesData[shift.date] = [];
      }
      // Remove any existing FP/FPV for this employee on this date
      employeesData[shift.date] = employeesData[shift.date].filter(
        s => !(s.employeeId === employeeId && (s.badge === 'fp' || s.badge === 'fpv'))
      );
      // Add new shift
      employeesData[shift.date].push({
        employeeId,
        badge: shift.type.toLowerCase(),
        badgeText: shift.type,
        time: '-'
      });
    }

    // Update employee record
    if (registeredEmployees[employeeId]) {
      registeredEmployees[employeeId].fridagsnyckel = selectedKey;
      registeredEmployees[employeeId].fridagsrad = selectedRow;
    }

    // Refresh UI
    renderEmployees();
    renderFridagEmployeeList();

    showFridagStatus(statusEl, `${shifts.length} fridagar inlagda!`, 'success');
  } catch (error) {
    console.error('Error applying fridagsnyckel:', error);
    const errorMsg = error.message || error.toString();
    showFridagStatus(statusEl, `Fel: ${errorMsg}`, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Show status message for fridagsnyckel action
 */
function showFridagStatus(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.className = `fridag-status ${type}`;
  setTimeout(() => {
    element.className = 'fridag-status';
    element.textContent = '';
  }, 4000);
}

/**
 * Generate FP/FPV shifts based on fridagsnyckel
 * Note: FPV is excluded during summer months (June, July, August)
 * @returns Array of { date: 'YYYY-MM-DD', type: 'FP'|'FPV' }
 */
function generateFridagShifts(employeeId, keyId, startRow) {
  const keyData = FRIDAG_KEYS[keyId];
  if (!keyData) return [];

  const shifts = [];
  const startDate = new Date(FRIDAG_START_DATE);
  const endDate = new Date(FRIDAG_END_DATE);
  const cycle = keyData.cycle;

  // Summer months where FPV is excluded (June=5, July=6, August=7 in JS)
  const summerMonths = [5, 6, 7];

  // Day name mapping (JS getDay(): 0=Sun, 1=Mon, ... 6=Sat)
  const dayMap = {
    0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
  };

  // Find which week we start in (based on start date being week 1)
  let currentDate = new Date(startDate);
  let currentRow = startRow;

  // Calculate the Monday of the week containing startDate
  const startDayOfWeek = startDate.getDay();
  const daysToMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const weekStartDate = new Date(startDate);
  weekStartDate.setDate(weekStartDate.getDate() - daysToMonday);

  // Process week by week
  let weekStart = new Date(weekStartDate);

  while (weekStart <= endDate) {
    const pattern = keyData.pattern[currentRow];

    if (pattern) {
      // Go through each day of the week
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + dayOffset);

        // Check if date is within our range
        if (dayDate >= startDate && dayDate <= endDate) {
          const dayName = dayMap[dayDate.getDay()];
          const shiftType = pattern[dayName];

          if (shiftType) {
            // Skip FPV during summer months (June-August)
            const month = dayDate.getMonth();
            if (shiftType === 'FPV' && summerMonths.includes(month)) {
              // FPV excluded in summer - skip this shift
              continue;
            }

            const dateKey = getDateKey(dayDate);
            shifts.push({
              date: dateKey,
              type: shiftType
            });
          }
        }
      }
    }

    // Move to next week
    weekStart.setDate(weekStart.getDate() + 7);

    // Rotate to next row in cycle
    currentRow++;
    if (currentRow > cycle) {
      currentRow = 1;
    }
  }

  return shifts;
}
