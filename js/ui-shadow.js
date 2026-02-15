/**
 * ui-shadow.js - Shadow Schedule (Skuggschema)
 * Handles the shadow schedule view: person selection, cycle logic, and rendering.
 *
 * Dependencies (from ui.js): getSortedEmployees, getWeekNumber, getDateKey
 * Dependencies (globals): registeredEmployees, employeesData, FRIDAG_KEYS, dayNamesShort
 */

// ==========================================
// SHADOW SCHEDULE - Navigation
// ==========================================

// Shadow schedule state
let selectedShadowEmployeeId = null;

/**
 * Show the person selector, hide the schedule view
 */
function showShadowPersonSelect() {
  const selectEl = document.getElementById('shadowPersonSelect');
  const viewEl = document.getElementById('shadowScheduleView');
  if (selectEl) selectEl.style.display = 'block';
  if (viewEl) viewEl.style.display = 'none';
  selectedShadowEmployeeId = null;
}

/**
 * Render person list for shadow schedule selection
 * Only shows employees that have a fridagsnyckel assigned
 */
function renderShadowPersonList() {
  const listEl = document.getElementById('shadowPersonList');
  if (!listEl) return;

  const employees = getSortedEmployees();

  // Filter to only employees with fridagsnyckel
  const employeesWithKey = employees.filter(emp => emp.fridagsnyckel && emp.fridagsrad);

  if (employeesWithKey.length === 0) {
    listEl.innerHTML = `
      <div class="no-schedules">
        <div class="icon">👻</div>
        <p>Inga skuggscheman tillgängliga</p>
        <span class="shadow-hint">Tilldela fridagsnyckel i Inställningar först</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = employeesWithKey.map((emp, index) => {
    const keyData = FRIDAG_KEYS[emp.fridagsnyckel];
    const cycleBadge = keyData ? `${keyData.cycle}v cykel` : '';

    return `
      <div class="person-list-card" style="animation-delay: ${index * 0.05}s" onclick="showShadowScheduleView('${emp.employeeId}')">
        <div class="avatar ${emp.color}">${emp.initials}</div>
        <div class="person-info">
          <div class="person-name">${emp.name}</div>
          <div class="person-subtitle">${emp.fridagsnyckel} Rad ${emp.fridagsrad}</div>
        </div>
        <div class="shadow-cycle-info">
          <span class="shadow-cycle-tag">${cycleBadge}</span>
        </div>
        <span class="arrow">›</span>
      </div>
    `;
  }).join('');
}

/**
 * Show shadow schedule view for a selected employee
 */
function showShadowScheduleView(employeeId) {
  selectedShadowEmployeeId = employeeId;

  const selectEl = document.getElementById('shadowPersonSelect');
  const viewEl = document.getElementById('shadowScheduleView');
  if (selectEl) selectEl.style.display = 'none';
  if (viewEl) viewEl.style.display = 'block';

  const emp = registeredEmployees[employeeId];
  if (!emp) return;

  // Update header info
  const nameEl = document.getElementById('shadowPersonName');
  const cycleEl = document.getElementById('shadowCycleBadge');
  if (nameEl) nameEl.textContent = emp.name;

  const keyData = emp.fridagsnyckel ? FRIDAG_KEYS[emp.fridagsnyckel] : null;
  if (cycleEl && keyData) {
    cycleEl.textContent = `${emp.fridagsnyckel} · ${keyData.cycle}v cykel · Rad ${emp.fridagsrad}`;
  }

  // Render shadow schedule
  renderShadowSchedule(employeeId);
}

// ==========================================
// SHADOW SCHEDULE - Cycle Logic
// ==========================================

/**
 * Get the Monday of the ISO week containing a given date
 */
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate which cycle week a given date falls in
 * Cycle starts from FRIDAG_START_DATE (2026-03-01)
 * Returns 1-based week number within the cycle (1 to cycleLength)
 */
function getCycleWeekNumber(date, cycleLength) {
  // Reference: first Monday on or after FRIDAG_START_DATE
  // 2026-03-01 is a Sunday, so first Monday is 2026-03-02
  const cycleStart = new Date(2026, 2, 2); // March 2, 2026 (Monday)
  cycleStart.setHours(0, 0, 0, 0);

  const targetMonday = getMondayOfWeek(date);
  const diffMs = targetMonday.getTime() - cycleStart.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

  // Handle dates before cycle start
  if (diffWeeks < 0) {
    // Wrap backwards
    const mod = ((diffWeeks % cycleLength) + cycleLength) % cycleLength;
    return mod + 1;
  }

  return (diffWeeks % cycleLength) + 1;
}

/**
 * Get all weeks in the display range for shadow schedule
 * Shows from FRIDAG_START_DATE to end of current + next full cycle
 * Returns array of { mondayDate, weekNum (ISO), cycleWeek }
 */
function getShadowWeeks(cycleLength) {
  const weeks = [];
  const startDate = new Date(2026, 2, 2); // March 2, 2026 (first Monday)
  startDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate how many complete cycles from start to today
  const todayMonday = getMondayOfWeek(today);
  const diffMs = todayMonday.getTime() - startDate.getTime();
  const diffWeeks = Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)));
  const currentCycleIndex = Math.floor(diffWeeks / cycleLength);

  // Show from start, through current cycle + 1 more full cycle
  const totalWeeksToShow = (currentCycleIndex + 2) * cycleLength;

  // But cap at a reasonable max (e.g., 52 weeks / 1 year)
  const maxWeeks = Math.min(totalWeeksToShow, 52);

  for (let i = 0; i < maxWeeks; i++) {
    const monday = new Date(startDate);
    monday.setDate(monday.getDate() + (i * 7));

    const isoWeekNum = getWeekNumber(monday);
    const cycleWeek = (i % cycleLength) + 1;

    weeks.push({
      mondayDate: monday,
      weekNum: isoWeekNum,
      cycleWeek: cycleWeek,
      weekIndex: i
    });
  }

  return weeks;
}

/**
 * Extract shift data for a specific employee for a given week (Mon-Sun)
 * Returns array of 7 objects (index 0=Mon, 6=Sun), each with { turn, time, badge }
 */
function getEmployeeWeekShifts(employeeId, mondayDate) {
  const shifts = [];

  for (let d = 0; d < 7; d++) {
    const date = new Date(mondayDate);
    date.setDate(date.getDate() + d);
    const dateKey = getDateKey(date);
    const dayShifts = employeesData[dateKey] || [];

    // Find shifts for this employee
    const empShifts = dayShifts.filter(s => s.employeeId === employeeId);

    if (empShifts.length > 0) {
      // Prioritize working shift over FP/FPV
      const workShift = empShifts.find(s => s.badge !== 'fp' && s.badge !== 'fpv'
        && s.badge !== 'semester' && s.badge !== 'franvarande'
        && s.badge !== 'foraldraledighet' && s.badge !== 'afd'
        && s.badge !== 'vab' && s.badge !== 'sjuk');
      const fpShift = empShifts.find(s => s.badge === 'fp' || s.badge === 'fpv');

      if (workShift) {
        shifts.push({
          turn: workShift.badgeText || '',
          time: workShift.time || '-',
          badge: workShift.badge || '',
          hasFP: !!fpShift,
          fpType: fpShift ? fpShift.badge : null,
          hasData: true
        });
      } else if (fpShift) {
        shifts.push({
          turn: fpShift.badgeText || fpShift.badge.toUpperCase(),
          time: '-',
          badge: fpShift.badge,
          hasFP: true,
          fpType: fpShift.badge,
          hasData: true
        });
      } else {
        // Other non-working type (semester, sjuk, etc.)
        const otherShift = empShifts[0];
        shifts.push({
          turn: otherShift.badgeText || otherShift.badge || '',
          time: otherShift.time || '-',
          badge: otherShift.badge || '',
          hasFP: false,
          fpType: null,
          hasData: true
        });
      }
    } else {
      shifts.push({ turn: '', time: '', badge: '', hasFP: false, fpType: null, hasData: false });
    }
  }

  return shifts;
}

// ==========================================
// SHADOW SCHEDULE - Build & Render
// ==========================================

/**
 * Build the shadow schedule data structure
 * Collects actual shifts and predicts future ones based on cycle repetition
 */
function buildShadowData(employeeId) {
  const emp = registeredEmployees[employeeId];
  if (!emp || !emp.fridagsnyckel) return null;

  const keyData = FRIDAG_KEYS[emp.fridagsnyckel];
  if (!keyData) return null;

  const cycleLength = keyData.cycle;
  const weeks = getShadowWeeks(cycleLength);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Phase 1: Collect actual data for each week
  const weekData = weeks.map(week => {
    const shifts = getEmployeeWeekShifts(employeeId, week.mondayDate);

    // Determine if this week has any actual data
    const hasActualData = shifts.some(s => s.hasData);

    // Is this week in the past or present?
    const weekEnd = new Date(week.mondayDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const isPast = weekEnd < today;
    const isCurrent = week.mondayDate <= today && today <= weekEnd;

    return {
      ...week,
      shifts: shifts,
      hasActualData: hasActualData,
      isPast: isPast,
      isCurrent: isCurrent,
      isPredicted: false
    };
  });

  // Phase 2: Build a "reference cycle" from the first cycle that has the most data
  // Collect shift patterns per cycleWeek
  const cyclePatterns = {};
  for (let cw = 1; cw <= cycleLength; cw++) {
    cyclePatterns[cw] = [];
  }

  // Gather all weeks with actual data
  for (const wd of weekData) {
    if (wd.hasActualData) {
      cyclePatterns[wd.cycleWeek].push(wd.shifts);
    }
  }

  // Build reference: use the latest data for each cycle week
  const referenceCycle = {};
  for (let cw = 1; cw <= cycleLength; cw++) {
    const candidates = cyclePatterns[cw];
    if (candidates.length > 0) {
      // Use the last (most recent) entry
      referenceCycle[cw] = candidates[candidates.length - 1];
    }
  }

  // Phase 3: Fill in predicted data for future weeks without actual data
  for (const wd of weekData) {
    if (!wd.hasActualData && !wd.isPast) {
      const ref = referenceCycle[wd.cycleWeek];
      if (ref) {
        wd.shifts = ref.map(s => ({ ...s }));
        wd.isPredicted = true;
      }
    }
  }

  return {
    cycleLength: cycleLength,
    keyId: emp.fridagsnyckel,
    keyName: keyData.name,
    row: emp.fridagsrad,
    weeks: weekData,
    referenceCycle: referenceCycle
  };
}

/**
 * Render the full shadow schedule
 */
function renderShadowSchedule(employeeId) {
  const container = document.getElementById('shadowTableContainer');
  if (!container) return;

  const emp = registeredEmployees[employeeId];
  if (!emp || !emp.fridagsnyckel) {
    container.innerHTML = '<p class="shadow-no-data">Ingen fridagsnyckel tilldelad.</p>';
    return;
  }

  const shadowData = buildShadowData(employeeId);
  if (!shadowData || shadowData.weeks.length === 0) {
    container.innerHTML = '<p class="shadow-no-data">Kunde inte bygga skuggschema.</p>';
    return;
  }

  // Build table
  const dayHeaders = dayNamesShort; // Mån, Tis, Ons, Tor, Fre, Lör, Sön

  let tableHTML = `
    <table class="shadow-table">
      <thead>
        <tr>
          <th>V.</th>
          ${dayHeaders.map(d => `<th>${d}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  for (let i = 0; i < shadowData.weeks.length; i++) {
    const week = shadowData.weeks[i];
    const isCurrentWeek = week.isCurrent;
    const isCycleLast = week.cycleWeek === shadowData.cycleLength;
    const trClass = [
      isCurrentWeek ? 'shadow-current-week' : '',
      isCycleLast ? 'shadow-cycle-separator' : ''
    ].filter(Boolean).join(' ');

    tableHTML += `<tr class="${trClass}">`;

    // Week number cell
    tableHTML += `<td><span class="shadow-week-num">${week.weekNum}</span></td>`;

    // 7 day cells
    for (let d = 0; d < 7; d++) {
      const shift = week.shifts[d];

      if (!shift || (!shift.hasData && !week.isPredicted)) {
        tableHTML += `<td><div class="shadow-cell"><span class="shadow-cell-empty">·</span></div></td>`;
      } else {
        const isFP = shift.badge === 'fp' || shift.badge === 'fpv';
        const cellClass = [
          'shadow-cell',
          week.isPredicted ? 'shadow-cell-predicted' : '',
          isFP ? 'shadow-cell-fp' : ''
        ].filter(Boolean).join(' ');

        // Display turn (shortened if needed)
        let turnDisplay = shift.turn || '';
        if (turnDisplay.length > 8) {
          turnDisplay = turnDisplay.substring(0, 7) + '…';
        }

        // Display time
        const timeDisplay = shift.time && shift.time !== '-' ? shift.time : '';

        if (turnDisplay || timeDisplay) {
          tableHTML += `<td><div class="${cellClass}">`;
          if (turnDisplay) {
            tableHTML += `<span class="shadow-cell-turn">${turnDisplay}</span>`;
          }
          if (timeDisplay) {
            tableHTML += `<span class="shadow-cell-time">${timeDisplay}</span>`;
          }
          tableHTML += `</div></td>`;
        } else {
          tableHTML += `<td><div class="shadow-cell"><span class="shadow-cell-empty">·</span></div></td>`;
        }
      }
    }

    tableHTML += '</tr>';
  }

  tableHTML += '</tbody></table>';

  // Legend
  tableHTML += `
    <div class="shadow-legend">
      <div class="shadow-legend-item">
        <span class="shadow-legend-dot actual"></span>
        <span>Faktisk tur</span>
      </div>
      <div class="shadow-legend-item">
        <span class="shadow-legend-dot predicted"></span>
        <span>Förutsagd tur</span>
      </div>
      <div class="shadow-legend-item">
        <span class="shadow-legend-dot fp"></span>
        <span>FP / FPV</span>
      </div>
    </div>
  `;

  container.innerHTML = tableHTML;
}
