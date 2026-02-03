/**
 * schedule.js - Schedule Parsing and Import
 * Handles PDF, CSV, and JSON file parsing
 */

// Initialize pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Extract text content from a PDF file
 */
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Extract person name and employee ID from PDF text
 */
function extractPersonInfo(text) {
  // Try to find "Anställningsnr XXXXXX - Förnamn Efternamn"
  const nameMatch = text.match(/Anställningsnr\s+(\d+)\s*[-–]\s*([A-ZÅÄÖ][a-zåäö]+)\s+([A-ZÅÄÖ][a-zåäö]+)(?:\s+([A-ZÅÄÖ][a-zåäö]+))?/i);
  if (nameMatch) {
    let employeeName = nameMatch[2] + ' ' + nameMatch[3];
    if (nameMatch[4] && nameMatch[4].length > 2 && !/^(Datum|Tjänst|Tid|Pass|Arbets)/.test(nameMatch[4])) {
      employeeName += ' ' + nameMatch[4];
    }
    return {
      employeeId: nameMatch[1].trim(),
      employeeName: employeeName
    };
  }

  // Fallback pattern
  const altMatch = text.match(/(\d{6})\s*[-–]\s*([A-ZÅÄÖ][a-zåäö]+)\s+([A-ZÅÄÖ][a-zåäö]+)/);
  if (altMatch) {
    return {
      employeeId: altMatch[1].trim(),
      employeeName: altMatch[2] + ' ' + altMatch[3]
    };
  }

  return null;
}

/**
 * Normalize service code to standard format
 */
function normalizeService(service) {
  const serviceUpper = service.toUpperCase();

  if (serviceUpper === 'FRIDAG') return 'FP';
  if (serviceUpper.includes('FV') || serviceUpper.includes('FP2') || serviceUpper.includes('FP-V')) return 'FPV';
  if (serviceUpper === 'SEMESTER') return 'Semester';
  if (serviceUpper === 'FRÅNVARANDE') return 'Frånvarande';
  if (serviceUpper.startsWith('FÖRÄLDRALEDIGHET')) return 'Föräldraledighet';
  if (serviceUpper === 'AFD') return 'AFD';

  return service;
}

/**
 * Parse schedule data from extracted PDF text
 */
function parseScheduleFromText(text) {
  const personInfo = extractPersonInfo(text);
  if (!personInfo) {
    console.log('Could not extract person info from PDF');
    return null;
  }

  const schedule = {};

  // Pattern for schedule rows
  const rowPattern = /(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)\s+(\d{4}-\d{2}-\d{2})\s+(\*?\s*(?:\d{4,5}[A-Z]?|[A-ZÅÄÖ][A-ZÅÄÖ0-9\-\/]*[A-ZÅÄÖ0-9]|[A-ZÅÄÖ]+))\s*(?:(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2}))?/gi;

  let match;
  while ((match = rowPattern.exec(text)) !== null) {
    const dateStr = match[2];
    const service = match[3].replace(/^\*\s*/, '').trim();
    const startTime = match[4] || '';
    const endTime = match[5] || '';

    let time = null;
    if (startTime && endTime) {
      time = `${startTime}-${endTime}`;
    }

    const finalService = normalizeService(service);
    schedule[dateStr] = { service: finalService, time: time };
  }

  // Fallback pattern
  if (Object.keys(schedule).length === 0) {
    const dateTimePattern = /(\d{4}-\d{2}-\d{2})\s+(\*?\s*(?:\d{4,5}[A-Z]?|[A-ZÅÄÖ][A-ZÅÄÖ0-9\-\/]*[A-ZÅÄÖ0-9]|[A-ZÅÄÖ]+))\s*(?:(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2}))?/gi;

    while ((match = dateTimePattern.exec(text)) !== null) {
      const dateStr = match[1];
      const service = match[2].replace(/^\*\s*/, '').trim();
      const startTime = match[3] || '';
      const endTime = match[4] || '';

      let time = null;
      if (startTime && endTime) {
        time = `${startTime}-${endTime}`;
      }

      const finalService = normalizeService(service);
      schedule[dateStr] = { service: finalService, time: time };
    }
  }

  if (Object.keys(schedule).length === 0) return null;

  return {
    employeeId: personInfo.employeeId,
    employeeName: personInfo.employeeName,
    schedule: schedule
  };
}

/**
 * Process PDF file locally
 */
async function processPDFLocally(file) {
  const text = await extractTextFromPDF(file);

  if (!text || text.trim().length === 0) {
    throw new Error('Kunde inte läsa PDF-filen.');
  }

  const data = parseScheduleFromText(text);

  if (!data || Object.keys(data.schedule).length === 0) {
    throw new Error('Kunde inte hitta schemauppgifter i PDF-filen.');
  }

  return data;
}

/**
 * Process CSV file
 */
async function processCSVFile(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

  let employeeId = null;
  let employeeName = null;
  const schedule = {};

  for (const line of lines) {
    const idMatch = line.match(/^Anställningsnr[:\s]+(\d+)/i);
    if (idMatch) {
      employeeId = idMatch[1];
      continue;
    }

    const nameMatch = line.match(/^Namn[:\s]+(.+)/i);
    if (nameMatch) {
      employeeName = nameMatch[1].trim();
      continue;
    }

    if (line.toLowerCase().startsWith('datum')) continue;

    const parts = line.split(/[;,]/).map(p => p.trim());
    if (parts.length >= 2) {
      const dateStr = parts[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const service = normalizeService(parts[1] || '');
        const time = parts[2] || null;
        schedule[dateStr] = { service: service, time: time || null };
      }
    }
  }

  if (!employeeId || !employeeName) {
    throw new Error('Kunde inte hitta anställningsnr och namn i CSV-filen.');
  }

  if (Object.keys(schedule).length === 0) {
    throw new Error('Kunde inte hitta schemauppgifter i CSV-filen.');
  }

  return { employeeId, employeeName, schedule };
}

/**
 * Process JSON file
 */
async function processJSONFile(file) {
  const text = await file.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Ogiltig JSON-fil. Kontrollera formatet.');
  }

  if (!data.employeeId && !data.anstallningsnr) {
    throw new Error('JSON saknar employeeId eller anstallningsnr');
  }
  if (!data.employeeName && !data.namn) {
    throw new Error('JSON saknar employeeName eller namn');
  }
  if (!data.schedule && !data.schema) {
    throw new Error('JSON saknar schedule eller schema');
  }

  const employeeId = data.employeeId || data.anstallningsnr;
  const employeeName = data.employeeName || data.namn;
  const rawSchedule = data.schedule || data.schema;

  const schedule = {};
  for (const [dateStr, shift] of Object.entries(rawSchedule)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const service = normalizeService(shift.service || shift.tjanst || '');
      const time = shift.time || shift.tid || null;
      schedule[dateStr] = { service, time };
    }
  }

  if (Object.keys(schedule).length === 0) {
    throw new Error('Kunde inte hitta schemauppgifter i JSON-filen.');
  }

  return { employeeId, employeeName, schedule };
}

/**
 * Get file type from file
 */
function getFileType(file) {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (fileName.endsWith('.csv') || file.type === 'text/csv') return 'csv';
  if (fileName.endsWith('.json') || file.type === 'application/json') return 'json';
  return null;
}

/**
 * Import schedule data into app
 */
function importScheduleData(data) {
  const employeeId = data.employeeId || data.employeeName;

  let employee = registeredEmployees[employeeId];

  if (!employee) {
    const nameParts = data.employeeName.split(' ');
    const initials = nameParts.map(n => n[0]).join('').substring(0, 2).toUpperCase();

    employee = {
      employeeId: employeeId,
      name: data.employeeName,
      initials: initials,
      color: getNextColor()
    };

    registeredEmployees[employeeId] = employee;
    console.log('Ny personal registrerad:', employee.name, '(' + employeeId + ')');
  } else {
    console.log('Uppdaterar schema för:', employee.name, '(' + employeeId + ')');
  }

  let daysImported = 0;
  let workingDays = 0;

  Object.entries(data.schedule).forEach(([dateStr, shift]) => {
    daysImported++;

    const service = shift.service || shift.type || '';
    const serviceUpper = service.toUpperCase();

    if (!employeesData[dateStr]) {
      employeesData[dateStr] = [];
    }

    employeesData[dateStr] = employeesData[dateStr].filter(s => s.employeeId !== employeeId);

    const shiftEntry = {
      employeeId: employeeId,
      time: shift.time || '-',
      badge: 'none',
      badgeText: service
    };

    if (serviceUpper === 'FP' || serviceUpper === 'FRIDAG') {
      shiftEntry.badge = 'fp';
      shiftEntry.badgeText = 'FP';
    } else if (serviceUpper === 'FPV') {
      shiftEntry.badge = 'fpv';
      shiftEntry.badgeText = 'FPV';
    } else if (serviceUpper === 'SEMESTER') {
      shiftEntry.badge = 'semester';
      shiftEntry.badgeText = 'Semester';
    } else if (serviceUpper === 'FRÅNVARANDE') {
      shiftEntry.badge = 'franvarande';
      shiftEntry.badgeText = 'Frånvarande';
    } else if (serviceUpper.includes('FÖRÄLDRALEDIGHET')) {
      shiftEntry.badge = 'foraldraledighet';
      shiftEntry.badgeText = 'Föräldraledighet';
    } else if (serviceUpper === 'AFD') {
      shiftEntry.badge = 'afd';
      shiftEntry.badgeText = 'AFD';
    } else if (serviceUpper === 'RESERV' || serviceUpper === 'RESERVSTAM') {
      shiftEntry.badge = 'reserv';
      shiftEntry.badgeText = service;
      workingDays++;
    } else if (service) {
      shiftEntry.badge = 'dag';
      shiftEntry.badgeText = service;
      workingDays++;
    }

    employeesData[dateStr].push(shiftEntry);
    saveScheduleToFirebase(dateStr, employeesData[dateStr]);
  });

  saveEmployeeToFirebase(employee);

  console.log('Importerade', daysImported, 'dagar,', workingDays, 'arbetsdagar');

  const importedDates = Object.keys(data.schedule).sort();
  if (importedDates.length > 0) {
    const firstWorkingDay = importedDates.find(d => {
      const shift = data.schedule[d];
      return shift.type !== 'FRIDAG';
    }) || importedDates[0];

    const [year, month, day] = firstWorkingDay.split('-').map(Number);
    currentDate = new Date(year, month - 1, day);
  }

  renderEmployees();

  return {
    employeeName: employee.name,
    daysImported: daysImported,
    workingDays: workingDays,
    isNewEmployee: !registeredEmployees[employeeId]
  };
}
