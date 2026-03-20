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
 * Get all weeks in the display range for shadow schedule.
 * Always shows the full year period: March 2, 2026 → Feb 28, 2027.
 * Returns array of { mondayDate, weekNum (ISO), cycleWeek }
 */
function getShadowWeeks(cycleLength) {
  const weeks = [];
  const startDate = new Date(2026, 2, 2); // March 2, 2026 (first Monday)
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(2027, 1, 28); // Feb 28, 2027
  endDate.setHours(0, 0, 0, 0);

  // Calculate total weeks in the full period
  const totalWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

  for (let i = 0; i < totalWeeks; i++) {
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
// SHADOW SCHEDULE - Combined Reference Cycle
// ==========================================

/**
 * Parse a time string like "06:00-14:30" into { start, end }
 * Returns null if not a valid working time
 */
function _parseShadowTime(timeStr) {
  if (!timeStr || timeStr === '-' || timeStr === '') return null;
  const parts = timeStr.split('-');
  if (parts.length !== 2) return null;
  const start = parts[0].trim();
  const end = parts[1].trim();
  if (!start || !end) return null;
  // Validate HH:MM format
  if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) return null;
  return { start, end };
}

/**
 * Round time to nearest 30 minutes for grouping similar times
 * "06:12" -> "06:00", "06:18" -> "06:30"
 */
function _roundTime30(timeStr) {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const rounded = m < 15 ? '00' : m < 45 ? '30' : '00';
  const rh = (m >= 45 ? h + 1 : h) % 24;
  return String(rh).padStart(2, '0') + ':' + rounded;
}

/**
 * Build a combined reference cycle by cross-referencing ALL employees
 * that share the same fridagsnyckel.
 *
 * Each person with the same key has the same repeating schedule but
 * offset by their fridagsrad. By combining everyone's actual data,
 * we build a more complete picture of what each cycle position looks like.
 *
 * Returns: reference[patternRow][dayIndex] = { start, end, count, confirmed }
 *   - patternRow: 1..cycleLength
 *   - dayIndex: 0=Mon .. 6=Sun
 *   - start/end: most common approximate times
 *   - count: how many times this time was observed
 *   - confirmed: true if count > 1 (multiple observations = green)
 */
function buildCombinedReferenceCycle(fridagsnyckel, cycleLength) {
  // Find ALL employees with the same fridagsnyckel
  const peers = [];
  for (const [empId, emp] of Object.entries(registeredEmployees)) {
    if (emp.fridagsnyckel === fridagsnyckel && emp.fridagsrad) {
      peers.push({ employeeId: empId, rad: parseInt(emp.fridagsrad, 10) });
    }
  }

  if (peers.length === 0) return null;

  // Collect time observations: timeData[patternRow][dayIndex] = [ { start, end, roundedKey }, ... ]
  const timeData = {};
  for (let r = 1; r <= cycleLength; r++) {
    timeData[r] = {};
    for (let d = 0; d < 7; d++) {
      timeData[r][d] = [];
    }
  }

  // Walk through all weeks in the period for each peer
  const periodStart = new Date(2026, 2, 2); // March 2, 2026 (first Monday)
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(2027, 1, 28); // Feb 28, 2027
  periodEnd.setHours(0, 0, 0, 0);

  // Calculate total weeks in period
  const totalWeeks = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

  for (const peer of peers) {
    for (let wi = 0; wi < totalWeeks; wi++) {
      // What pattern row is this peer on during week wi?
      // Week 0: peer is at their fridagsrad
      // Week 1: fridagsrad + 1, etc. (wrapping)
      const patternRow = ((wi + peer.rad - 1) % cycleLength) + 1;

      // Monday of this week
      const monday = new Date(periodStart);
      monday.setDate(monday.getDate() + (wi * 7));

      // Get actual shifts for this peer this week
      for (let d = 0; d < 7; d++) {
        const date = new Date(monday);
        date.setDate(date.getDate() + d);
        const dateKey = getDateKey(date);
        const dayShifts = employeesData[dateKey] || [];

        // Find working shift for this peer (skip FP, FPV, leave types)
        const empShifts = dayShifts.filter(s => s.employeeId === peer.employeeId);
        const workShift = empShifts.find(s =>
          s.badge !== 'fp' && s.badge !== 'fpv' &&
          s.badge !== 'semester' && s.badge !== 'franvarande' &&
          s.badge !== 'foraldraledighet' && s.badge !== 'afd' &&
          s.badge !== 'komp' && s.badge !== 'vab' && s.badge !== 'sjuk'
        );

        if (workShift && workShift.time) {
          const parsed = _parseShadowTime(workShift.time);
          if (parsed) {
            // Create a rounded key for grouping similar times
            const roundedKey = _roundTime30(parsed.start) + '-' + _roundTime30(parsed.end);
            timeData[patternRow][d].push({
              start: parsed.start,
              end: parsed.end,
              roundedKey: roundedKey
            });
          }
        }
      }
    }
  }

  // Build reference: for each position, find the most common time
  const reference = {};
  for (let r = 1; r <= cycleLength; r++) {
    reference[r] = {};
    for (let d = 0; d < 7; d++) {
      const observations = timeData[r][d];
      if (observations.length === 0) {
        reference[r][d] = null;
        continue;
      }

      // Group by rounded time key and count
      const groups = {};
      for (const obs of observations) {
        if (!groups[obs.roundedKey]) {
          groups[obs.roundedKey] = { start: obs.start, end: obs.end, count: 0 };
        }
        groups[obs.roundedKey].count++;
        // Keep the latest exact time (overwrite with each new observation)
        groups[obs.roundedKey].start = obs.start;
        groups[obs.roundedKey].end = obs.end;
      }

      // Pick the group with the highest count
      let best = null;
      for (const key of Object.keys(groups)) {
        if (!best || groups[key].count > best.count) {
          best = groups[key];
        }
      }

      reference[r][d] = {
        start: best.start,
        end: best.end,
        count: best.count,
        confirmed: best.count > 1
      };
    }
  }

  console.log('[SHADOW] Built combined reference cycle for ' + fridagsnyckel +
    ' using ' + peers.length + ' peers, cycle=' + cycleLength);

  return reference;
}

// ==========================================
// SHADOW SCHEDULE - Build & Render
// ==========================================

/**
 * Build the shadow schedule data structure
 * Collects actual shifts and predicts future ones based on cycle repetition.
 * Uses cross-referenced data from all employees with the same fridagsnyckel.
 * Predictions work per-day (not per-week) so partial weeks get filled in.
 */
function buildShadowData(employeeId) {
  const emp = registeredEmployees[employeeId];
  if (!emp || !emp.fridagsnyckel) return null;

  const keyData = FRIDAG_KEYS[emp.fridagsnyckel];
  if (!keyData) return null;

  const cycleLength = keyData.cycle;
  const empRad = parseInt(emp.fridagsrad, 10);
  const weeks = getShadowWeeks(cycleLength);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build the combined reference cycle from all peers
  const combinedRef = buildCombinedReferenceCycle(emp.fridagsnyckel, cycleLength);

  // Phase 1: Collect actual data for each week
  const weekData = weeks.map((week, wi) => {
    const shifts = getEmployeeWeekShifts(employeeId, week.mondayDate);

    // What pattern row is this employee on during this week?
    const patternRow = ((wi + empRad - 1) % cycleLength) + 1;

    // Is this week in the past or present?
    const weekEnd = new Date(week.mondayDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const isPast = weekEnd < today;
    const isCurrent = week.mondayDate <= today && today <= weekEnd;

    return {
      ...week,
      shifts: shifts,
      patternRow: patternRow,
      isPast: isPast,
      isCurrent: isCurrent
    };
  });

  // Phase 2: Per-day prediction — fill in individual days that lack data
  for (const wd of weekData) {
    for (let d = 0; d < 7; d++) {
      const shift = wd.shifts[d];
      const dayDate = new Date(wd.mondayDate);
      dayDate.setDate(dayDate.getDate() + d);

      // Only predict for days without actual data and not in the past
      if (!shift.hasData && dayDate >= today && combinedRef) {
        const ref = combinedRef[wd.patternRow] ? combinedRef[wd.patternRow][d] : null;
        if (ref) {
          // Fill in predicted time from combined reference
          wd.shifts[d] = {
            turn: '',
            time: ref.start + '-' + ref.end,
            badge: '',
            hasFP: false,
            fpType: null,
            hasData: false,
            predicted: true,
            confirmedTime: ref.confirmed,
            predictionCount: ref.count
          };
        }
      }
    }
  }

  return {
    cycleLength: cycleLength,
    keyId: emp.fridagsnyckel,
    keyName: keyData.name,
    row: empRad,
    weeks: weekData,
    combinedRef: combinedRef
  };
}

/**
 * Render the full shadow schedule.
 * Uses per-day predicted/confirmed flags for cell styling.
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
    const isCycleLast = week.patternRow === shadowData.cycleLength;
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

      if (!shift || (!shift.hasData && !shift.predicted)) {
        // No data and no prediction
        tableHTML += `<td><div class="shadow-cell"><span class="shadow-cell-empty">·</span></div></td>`;
      } else if (shift.predicted) {
        // Predicted cell — show only time (no turn number)
        const cellClass = [
          'shadow-cell',
          'shadow-cell-predicted',
          shift.confirmedTime ? 'shadow-cell-confirmed' : ''
        ].filter(Boolean).join(' ');

        const timeDisplay = shift.time || '';
        if (timeDisplay) {
          tableHTML += `<td><div class="${cellClass}">`;
          tableHTML += `<span class="shadow-cell-time">${timeDisplay}</span>`;
          tableHTML += `</div></td>`;
        } else {
          tableHTML += `<td><div class="shadow-cell"><span class="shadow-cell-empty">·</span></div></td>`;
        }
      } else {
        // Actual data cell — show turn + time as before
        const isFP = shift.badge === 'fp' || shift.badge === 'fpv';
        const cellClass = [
          'shadow-cell',
          isFP ? 'shadow-cell-fp' : ''
        ].filter(Boolean).join(' ');

        let turnDisplay = shift.turn || '';
        if (turnDisplay.length > 8) {
          turnDisplay = turnDisplay.substring(0, 7) + '…';
        }
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
        <span>Faktiskt pass</span>
      </div>
      <div class="shadow-legend-item">
        <span class="shadow-legend-dot predicted"></span>
        <span>Skuggad tid</span>
      </div>
      <div class="shadow-legend-item">
        <span class="shadow-legend-dot confirmed"></span>
        <span>Bekräftad tid</span>
      </div>
      <div class="shadow-legend-item">
        <span class="shadow-legend-dot fp"></span>
        <span>FP / FPV</span>
      </div>
    </div>
  `;

  container.innerHTML = tableHTML;
}
