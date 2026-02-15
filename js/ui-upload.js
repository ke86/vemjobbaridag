/**
 * ui-upload.js - File Upload & Delete Data Functions
 * Handles schedule file upload, Dagvy JSON import, and employee data deletion.
 *
 * Dependencies (from ui.js): showToast, getSortedEmployees, renderEmployees, renderPersonList
 * Dependencies (globals): registeredEmployees, employeesData, selectedFile,
 *   uploadZone, fileInput, filePreview, fileNameEl, fileSizeEl, processBtn,
 *   deleteDataSection, deleteEmployeeList, deleteConfirmModal, deleteModalText,
 *   pendingDeleteEmployeeId
 * Dependencies (from firebase.js): saveDagvyToFirebase, deleteEmployeeFromFirebase
 */

// ==========================================
// FILE UPLOAD HELPERS
// ==========================================

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function handleFile(file) {
  if (!file) return;

  const validTypes = ['application/pdf', 'text/csv', 'application/json'];
  const validExtensions = ['.pdf', '.csv', '.json'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

  if (!validTypes.includes(file.type) && !hasValidExtension) {
    showToast('Vänligen välj en PDF, CSV eller JSON-fil', 'error');
    return;
  }

  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatFileSize(file.size);

  uploadZone.style.display = 'none';
  filePreview.classList.add('active');
  processBtn.classList.add('active');
}

function removeFile() {
  selectedFile = null;
  fileInput.value = '';
  uploadZone.style.display = 'block';
  filePreview.classList.remove('active');
  processBtn.classList.remove('active');
}

// ==========================================
// DAGVY IMPORT (Settings)
// ==========================================

var dagvySelectedFile = null;

/**
 * Initialize dagvy upload event listeners
 */
function initDagvyUpload() {
  var zone = document.getElementById('dagvyUploadZone');
  var fileInput = document.getElementById('dagvyFileInput');
  var removeBtn = document.getElementById('dagvyFileRemove');
  var uploadBtn = document.getElementById('dagvyUploadBtn');

  if (!zone || !fileInput) return;

  // Click zone to open file picker
  zone.addEventListener('click', function() {
    fileInput.click();
  });

  // File selected
  fileInput.addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
      handleDagvyFile(e.target.files[0]);
    }
  });

  // Drag & drop
  zone.addEventListener('dragover', function(e) {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', function() {
    zone.classList.remove('dragover');
  });
  zone.addEventListener('drop', function(e) {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleDagvyFile(e.dataTransfer.files[0]);
    }
  });

  // Remove file
  if (removeBtn) {
    removeBtn.addEventListener('click', function() {
      resetDagvyUpload();
    });
  }

  // Upload button
  if (uploadBtn) {
    uploadBtn.addEventListener('click', function() {
      uploadDagvyFile();
    });
  }
}

/**
 * Handle a selected dagvy JSON file
 */
function handleDagvyFile(file) {
  if (!file) return;

  // Validate it's a JSON file
  var name = file.name.toLowerCase();
  if (!name.endsWith('.json')) {
    showToast('Välj en JSON-fil', 'error');
    return;
  }

  // Read and validate contents
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var json = JSON.parse(e.target.result);

      // Validate structure: should be { "Name": { days: [...] }, ... }
      var names = Object.keys(json);
      if (names.length === 0) {
        showToast('Filen innehåller ingen data', 'error');
        return;
      }

      // Count valid employees (those with days array)
      var validCount = 0;
      var totalDays = 0;
      for (var i = 0; i < names.length; i++) {
        var emp = json[names[i]];
        if (emp && emp.days && Array.isArray(emp.days)) {
          validCount++;
          totalDays += emp.days.length;
        }
      }

      if (validCount === 0) {
        showToast('Filen innehåller inga giltiga dagvy-poster', 'error');
        return;
      }

      // Store for upload
      dagvySelectedFile = { file: file, json: json, validCount: validCount, totalDays: totalDays };

      // Show preview
      var zone = document.getElementById('dagvyUploadZone');
      var preview = document.getElementById('dagvyUploadPreview');
      var nameEl = document.getElementById('dagvyFileName');
      var metaEl = document.getElementById('dagvyFileMeta');

      if (zone) zone.style.display = 'none';
      if (preview) preview.classList.add('active');
      if (nameEl) nameEl.textContent = file.name;
      if (metaEl) metaEl.textContent = validCount + ' anställda · ' + totalDays + ' dagar';

      // Reset progress state
      var progressEl = document.getElementById('dagvyUploadProgress');
      var uploadBtn = document.getElementById('dagvyUploadBtn');
      if (progressEl) progressEl.style.display = 'none';
      if (uploadBtn) {
        uploadBtn.style.display = 'block';
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Ladda upp till Firebase';
      }

    } catch (err) {
      showToast('Kunde inte läsa JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

/**
 * Reset dagvy upload UI
 */
function resetDagvyUpload() {
  dagvySelectedFile = null;

  var zone = document.getElementById('dagvyUploadZone');
  var preview = document.getElementById('dagvyUploadPreview');
  var fileInput = document.getElementById('dagvyFileInput');

  if (zone) zone.style.display = '';
  if (preview) preview.classList.remove('active');
  if (fileInput) fileInput.value = '';
}

/**
 * Upload the selected dagvy file to Firebase
 */
async function uploadDagvyFile() {
  if (!dagvySelectedFile) return;

  var uploadBtn = document.getElementById('dagvyUploadBtn');
  var progressEl = document.getElementById('dagvyUploadProgress');
  var fillEl = document.getElementById('dagvyProgressFill');
  var textEl = document.getElementById('dagvyProgressText');

  // Disable button, show progress
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Laddar upp...';
  }
  if (progressEl) progressEl.style.display = 'block';
  if (fillEl) fillEl.style.width = '0%';
  if (textEl) textEl.textContent = 'Startar...';

  try {
    await saveDagvyToFirebase(dagvySelectedFile.json, function(current, total, name) {
      var pct = Math.round((current / total) * 100);
      if (fillEl) fillEl.style.width = pct + '%';
      if (textEl) textEl.textContent = current + ' / ' + total + ' — ' + name;
    });

    // Done!
    if (fillEl) fillEl.style.width = '100%';
    if (textEl) textEl.textContent = 'Klart! ' + dagvySelectedFile.validCount + ' anställda uppladdade';
    if (uploadBtn) {
      uploadBtn.textContent = '✓ Uppladdning klar';
      uploadBtn.classList.add('done');
    }

    showToast('Dagvy uppladdad till Firebase', 'success');

    // Auto-reset after 3 seconds
    setTimeout(function() {
      resetDagvyUpload();
    }, 3000);

  } catch (err) {
    console.error('Dagvy upload error:', err);
    if (textEl) textEl.textContent = 'Fel: ' + err.message;
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Försök igen';
    }
    showToast('Uppladdning misslyckades: ' + err.message, 'error');
  }
}

// ==========================================
// DELETE DATA FUNCTIONS
// ==========================================

/**
 * Toggle the collapsible delete data section
 */
function toggleDeleteDataSection() {
  if (deleteDataSection) {
    deleteDataSection.classList.toggle('expanded');
    if (deleteDataSection.classList.contains('expanded')) {
      renderDeleteEmployeeList();
    }
  }
}

/**
 * Render the list of employees that can be deleted
 */
function renderDeleteEmployeeList() {
  if (!deleteEmployeeList) return;

  const employees = getSortedEmployees();

  if (employees.length === 0) {
    deleteEmployeeList.innerHTML = `
      <div class="delete-list-empty">
        <p>Ingen data att radera</p>
      </div>
    `;
    return;
  }

  deleteEmployeeList.innerHTML = employees.map(emp => {
    // Escape name for safe use in data attribute
    const safeName = emp.name.replace(/"/g, '&quot;');
    return `
      <div class="delete-list-item">
        <div class="employee-info">
          <div class="avatar ${emp.color}">${emp.initials}</div>
          <span class="employee-name">${emp.name}</span>
        </div>
        <button class="delete-btn" data-employee-id="${emp.employeeId}" data-employee-name="${safeName}">🗑️</button>
      </div>
    `;
  }).join('');

  // Add click handlers for delete buttons
  deleteEmployeeList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const employeeId = btn.dataset.employeeId;
      const employeeName = btn.dataset.employeeName;
      showDeleteConfirmModal(employeeId, employeeName);
    });
  });
}

/**
 * Show the delete confirmation modal
 */
function showDeleteConfirmModal(employeeId, employeeName) {
  pendingDeleteEmployeeId = employeeId;
  if (deleteModalText) {
    deleteModalText.textContent = `Vill du radera all data för ${employeeName}?`;
  }
  if (deleteConfirmModal) {
    deleteConfirmModal.classList.add('active');
  }
}

/**
 * Hide the delete confirmation modal
 */
function hideDeleteConfirmModal() {
  pendingDeleteEmployeeId = null;
  if (deleteConfirmModal) {
    deleteConfirmModal.classList.remove('active');
  }
}

/**
 * Confirm and execute the deletion
 */
async function confirmDeleteEmployee() {
  if (!pendingDeleteEmployeeId) return;

  const employeeId = pendingDeleteEmployeeId;
  hideDeleteConfirmModal();

  // Show immediate feedback - remove from UI first
  showToast('Raderar data...', 'info');

  // Delete from local data immediately for instant UI update
  delete registeredEmployees[employeeId];

  // Remove from all local schedule data
  for (const dateStr of Object.keys(employeesData)) {
    if (employeesData[dateStr]) {
      employeesData[dateStr] = employeesData[dateStr].filter(s => s.employeeId !== employeeId);
      if (employeesData[dateStr].length === 0) {
        delete employeesData[dateStr];
      }
    }
  }

  // Update UI immediately
  renderDeleteEmployeeList();
  renderEmployees();
  renderPersonList();

  // Now sync to Firebase in background
  try {
    await deleteEmployeeFromFirebase(employeeId);
    showToast('Data raderad', 'success');
  } catch (error) {
    console.error('Error deleting employee:', error);
    showToast('Kunde inte radera data', 'error');
  }
}
