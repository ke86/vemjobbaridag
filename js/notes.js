/**
 * notes.js - Notes (Anteckningar) Page
 * Handles note creation, editing, deletion, and searching with Firebase synchronization
 */

// ==========================================
// NOTES - State
// ==========================================

let notesList = [];
let _editingNoteId = null;
let _modalElement = null;
let _currentSearchQuery = '';
let _notesUnsubscribe = null;

const NOTES_COLLECTION = 'notes';
const NOTES_MAX_CHARS = 2000;

// ==========================================
// NOTES - Storage (Firebase + Cache)
// ==========================================

/**
 * Load notes from Firebase and setup real-time listener
 */
function loadNotesFromFirebase() {
  // Only setup if user is authenticated
  if (!firebase.auth().currentUser) {
    console.warn('User not authenticated, skipping notes sync');
    notesList = [];
    return;
  }

  const userId = firebase.auth().currentUser.uid;

  // Setup real-time listener
  if (_notesUnsubscribe) {
    _notesUnsubscribe();
  }

  _notesUnsubscribe = db.collection(NOTES_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('lastModified', 'desc')
    .onSnapshot(
      (snapshot) => {
        notesList = [];
        snapshot.forEach((doc) => {
          notesList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        renderNotesList();
      },
      (error) => {
        console.error('Error loading notes from Firebase:', error);
      }
    );
}

/**
 * Save a note to Firebase
 */
async function saveNoteToFirebase(note) {
  if (!firebase.auth().currentUser) {
    console.error('User not authenticated');
    return false;
  }

  const userId = firebase.auth().currentUser.uid;

  try {
    const noteData = {
      userId: userId,
      title: note.title,
      content: note.content,
      created: note.created || new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    if (note.id && note.id.startsWith('note_')) {
      // New note - create with auto-generated ID
      await db.collection(NOTES_COLLECTION).add(noteData);
    } else if (note.id) {
      // Update existing note
      await db.collection(NOTES_COLLECTION).doc(note.id).update(noteData);
    }

    updateSyncStatus('syncing');
    setTimeout(() => updateSyncStatus('connected'), 1500);
    return true;
  } catch (error) {
    console.error('Error saving note to Firebase:', error);
    updateSyncStatus('offline');
    return false;
  }
}

/**
 * Delete a note from Firebase
 */
async function deleteNoteFromFirebase(noteId) {
  if (!firebase.auth().currentUser) {
    console.error('User not authenticated');
    return false;
  }

  try {
    await db.collection(NOTES_COLLECTION).doc(noteId).delete();
    updateSyncStatus('syncing');
    setTimeout(() => updateSyncStatus('connected'), 1500);
    return true;
  } catch (error) {
    console.error('Error deleting note from Firebase:', error);
    updateSyncStatus('offline');
    return false;
  }
}

// ==========================================
// NOTES - Page Lifecycle
// ==========================================

/**
 * Called when Notes page is shown
 */
function onNotesPageShow() {
  loadNotesFromFirebase();
  renderNotesList();
  setupNotesEventListeners();
}

/**
 * Called when Notes page is hidden
 */
function onNotesPageHide() {
  _editingNoteId = null;
  _currentSearchQuery = '';
  closeNotesModal();
  if (_notesUnsubscribe) {
    _notesUnsubscribe();
    _notesUnsubscribe = null;
  }
}

/**
 * Setup event listeners for the notes page
 */
function setupNotesEventListeners() {
  const newBtn = document.getElementById('notesNewBtn');
  if (newBtn) {
    newBtn.addEventListener('click', openNewNoteModal);
  }

  const searchInput = document.getElementById('notesSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      _currentSearchQuery = e.target.value.toLowerCase();
      renderNotesList();
    });
  }
}

// ==========================================
// NOTES - Rendering
// ==========================================

/**
 * Render the notes list with current search filter
 */
function renderNotesList() {
  const listEl = document.getElementById('notesList');
  const emptyEl = document.getElementById('notesEmpty');
  if (!listEl) return;

  // Filter notes by search query
  let filtered = notesList;
  if (_currentSearchQuery) {
    filtered = notesList.filter(note =>
      note.title.toLowerCase().includes(_currentSearchQuery) ||
      note.content.toLowerCase().includes(_currentSearchQuery)
    );
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) {
      emptyEl.style.display = _currentSearchQuery ? 'none' : 'flex';
    }
    return;
  }

  if (emptyEl) {
    emptyEl.style.display = 'none';
  }

  let html = '';
  filtered.forEach(note => {
    const lastModified = new Date(note.lastModified);
    const dateStr = formatNoteDate(lastModified);
    const preview = note.content.substring(0, 80).replace(/\n/g, ' ');

    html += `
      <div class="notes-item" onclick="openEditNoteModal('${escapeHtml(note.id)}')">
        <div class="notes-item-header">
          <div class="notes-item-title">${escapeHtml(note.title)}</div>
          <div class="notes-item-date">${dateStr}</div>
        </div>
        <div class="notes-item-preview">${escapeHtml(preview)}</div>
        <div class="notes-item-actions">
          <button class="notes-item-btn" onclick="openEditNoteModal('${escapeHtml(note.id)}'); event.stopPropagation();">Redigera</button>
          <button class="notes-item-btn notes-delete-btn" onclick="showDeleteConfirmation('${escapeHtml(note.id)}'); event.stopPropagation();">Radera</button>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
}

/**
 * Format date for display (relative or absolute)
 */
function formatNoteDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just nu';
  if (diffMins < 60) return `${diffMins}m sedan`;
  if (diffHours < 24) return `${diffHours}h sedan`;
  if (diffDays < 7) return `${diffDays}d sedan`;

  // Absolute date
  return date.toLocaleDateString('sv-SE', {
    year: '2-digit',
    month: 'short',
    day: 'numeric'
  });
}

// ==========================================
// NOTES - Modal Dialog
// ==========================================

/**
 * Open modal for creating a new note
 */
function openNewNoteModal() {
  _editingNoteId = null;
  showNotesModal('Ny anteckning', '', '');
}

/**
 * Open modal for editing an existing note
 */
function openEditNoteModal(noteId) {
  _editingNoteId = noteId;
  const note = notesList.find(n => n.id === noteId);
  if (note) {
    showNotesModal('Redigera anteckning', note.title, note.content);
  }
}

/**
 * Show the notes modal dialog
 */
function showNotesModal(header, title, content) {
  // Remove existing modal if any
  closeNotesModal();

  // Create modal
  _modalElement = document.createElement('div');
  _modalElement.className = 'notes-modal';
  _modalElement.innerHTML = `
    <div class="notes-modal-content">
      <div class="notes-modal-header">${escapeHtml(header)}</div>
      <div class="notes-modal-body">
        <div class="notes-modal-title">Titel</div>
        <input type="text" class="notes-modal-input" id="notesModalTitle" maxlength="100" placeholder="Anteckningens titel" value="${escapeHtml(title)}">
        <div class="notes-modal-title">Innehål</div>
        <textarea class="notes-modal-textarea" id="notesModalContent" placeholder="Skriv din anteckning här..." maxlength="${NOTES_MAX_CHARS}">${escapeHtml(content)}</textarea>
        <div style="font-size: 12px; color: #9ca3af; text-align: right;">
          <span id="notesCharCount">${content.length}</span>/${NOTES_MAX_CHARS}
        </div>
      </div>
      <div class="notes-modal-footer">
        <button class="notes-modal-btn notes-modal-cancel" onclick="closeNotesModal()">Avbryt</button>
        <button class="notes-modal-btn notes-modal-save" onclick="saveNote()">Spara</button>
      </div>
    </div>
  `;

  document.body.appendChild(_modalElement);

  // Setup character counter
  const textarea = document.getElementById('notesModalContent');
  if (textarea) {
    textarea.addEventListener('input', (e) => {
      const charCount = document.getElementById('notesCharCount');
      if (charCount) {
        charCount.textContent = e.target.value.length;
      }
    });
    textarea.focus();
  }

  // Close modal on background click
  _modalElement.addEventListener('click', (e) => {
    if (e.target === _modalElement) {
      closeNotesModal();
    }
  });
}

/**
 * Close the notes modal dialog
 */
function closeNotesModal() {
  if (_modalElement) {
    _modalElement.remove();
    _modalElement = null;
  }
}

// ==========================================
// NOTES - CRUD Operations
// ==========================================

/**
 * Save a new or edited note to Firebase
 */
async function saveNote() {
  const titleInput = document.getElementById('notesModalTitle');
  const contentInput = document.getElementById('notesModalContent');

  if (!titleInput || !contentInput) return;

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  // Validation
  if (!title) {
    showModalAlert('Var vänlig och ange en titel för anteckningen');
    return;
  }

  if (!content) {
    showModalAlert('Var vänlig och skriv något innehål');
    return;
  }

  let noteToSave;

  if (_editingNoteId) {
    // Update existing note
    noteToSave = notesList.find(n => n.id === _editingNoteId);
    if (noteToSave) {
      noteToSave.title = title;
      noteToSave.content = content;
    } else {
      return;
    }
  } else {
    // Create new note
    noteToSave = {
      id: generateNoteId(),
      title: title,
      content: content,
      created: new Date().toISOString()
    };
  }

  // Save to Firebase
  const success = await saveNoteToFirebase(noteToSave);
  if (success) {
    closeNotesModal();
    // renderNotesList will be called by the Firebase listener
  } else {
    showModalAlert('Kunde inte spara anteckningen. Kontrollera din internetanslutning.');
  }
}

/**
 * Delete a note from Firebase (with confirmation)
 */
async function deleteNote(noteId) {
  const success = await deleteNoteFromFirebase(noteId);
  if (!success) {
    showModalAlert('Kunde inte radera anteckningen. Kontrollera din internetanslutning.');
  }
  // renderNotesList will be called by the Firebase listener
}

/**
 * Show delete confirmation dialog
 */
function showDeleteConfirmation(noteId) {
  const note = notesList.find(n => n.id === noteId);
  if (!note) return;

  const modal = document.createElement('div');
  modal.className = 'notes-modal';
  modal.innerHTML = `
    <div class="notes-modal-content" style="max-width: 300px;">
      <div class="notes-modal-header">Radera anteckning?</div>
      <div class="notes-modal-body" style="padding: 20px; text-align: center;">
        <p style="margin: 0; color: #6b7280;">Är du säker på att du vill radera "${escapeHtml(note.title)}"?</p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">Det går inte att ångra denna åtgärd.</p>
      </div>
      <div class="notes-modal-footer">
        <button class="notes-modal-btn notes-modal-cancel" onclick="this.closest('.notes-modal').remove()">Avbryt</button>
        <button class="notes-modal-btn notes-delete-btn" onclick="deleteNote('${escapeHtml(noteId)}'); this.closest('.notes-modal').remove();">Radera</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

/**
 * Show alert dialog inside modal
 */
function showModalAlert(message) {
  const modal = document.createElement('div');
  modal.className = 'notes-modal';
  modal.innerHTML = `
    <div class="notes-modal-content" style="max-width: 300px;">
      <div class="notes-modal-header">Varning</div>
      <div class="notes-modal-body" style="padding: 20px; text-align: center;">
        <p style="margin: 0; color: #6b7280;">${escapeHtml(message)}</p>
      </div>
      <div class="notes-modal-footer">
        <button class="notes-modal-btn notes-modal-save" onclick="this.closest('.notes-modal').remove()">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Focus OK button
  modal.querySelector('.notes-modal-save').focus();
}

// ==========================================
// NOTES - Utility Functions
// ==========================================

/**
 * Generate a unique note ID (timestamp + random)
 */
function generateNoteId() {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * HTML escape to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
