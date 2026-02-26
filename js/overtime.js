// ==========================================
// OVERTIME PAGE (Förseningsövertid)
// Full functionality — v5.62 (pre-fill URL submission + profile trains)
// ==========================================

// === CONFIGURATION ===
var OT_FORM_PAGE_URL = 'https://forms.office.com/pages/responsepage.aspx?id=Se4TKTWAFU-sN964AeJDbeO9eygRfwVLmiPtN4i6AAlUQk1XTjNGWkhPQ040SU9UQTBZUk9GSVJIMCQlQCN0PWcu&route=shorturl';
var OT_DEFAULT_PHRASES = ['Signalfel', 'Spårarbete', 'Fordonsfel', 'Växelfel', 'Vänta på anslutning'];

// MS Forms question IDs (mapped from form page)
var OT_QUESTION_IDS = {
  trafikomrade: 'r08a877c91e5940aab46a20f29e8975c3',
  kompPengar:   're8987294ed2b4297bbf9b8fe1ee51526',
  tagNummer:    'r0a442fdb2676477885508e2f6359d9ce',
  ordTid:       'r34420eb0c53945ce856c8b32dd00d04b',
  orsak:        'rbe59ed60ea8148a6a2173f5cc4895e2f',
  forsening:    'rc33b805e58a54fc89981cf7e781b8027',
  faktTid:      'r90237a906de84044b602c67085e11e0d',
  namn:         'r37f071b4259d4c8cbed7031b788a030f',
  adNummer:     'r5f2541b0525848eebaacabc4d577a3dc',
  datum:        'r0030f2c942874489affd4c0b8edb4feb'
};

// === STATE ===
var otExtraMinutes = 0;
var otCurrentView = 'form';
var OT_MAX_DRAFTS = 10;
var OT_MAX_HISTORY = 20;
var otOrsakDropdownOpen = false;

// ==========================================
// COOKIE STORAGE
// ==========================================

function otSaveSettings(obj) {
  try {
    var json = JSON.stringify(obj);
    document.cookie = 'ot_data=' + encodeURIComponent(json) + ';max-age=31536000;path=/;SameSite=Lax';
  } catch (e) { /* ignore */ }
}

function otLoadSettings() {
  try {
    var match = document.cookie.match(/ot_data=([^;]+)/);
    if (match) { return JSON.parse(decodeURIComponent(match[1])); }
  } catch (e) { /* ignore */ }
  return {};
}

function otGetSettings() {
  var defaults = { namn: '', adNummer: '', kompPengar: 'Komp', phrases: OT_DEFAULT_PHRASES.slice() };
  var saved = otLoadSettings();
  return Object.assign(defaults, saved);
}

function otUpdateSetting(key, value) {
  var settings = otGetSettings();
  settings[key] = value;
  otSaveSettings(settings);
}

// ==========================================
// DRAFT / HISTORY COOKIE STORAGE
// ==========================================

function otSaveCookieArray(name, arr) {
  try {
    var json = JSON.stringify(arr);
    document.cookie = name + '=' + encodeURIComponent(json) + ';max-age=31536000;path=/;SameSite=Lax';
  } catch (e) { /* ignore */ }
}

function otLoadCookieArray(name) {
  try {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    if (match) { return JSON.parse(decodeURIComponent(match[1])); }
  } catch (e) { /* ignore */ }
  return [];
}

function otPackEntry(formData) {
  return {
    s: new Date().toISOString(),
    tr: formData.trafikomrade || '',
    n: formData.namn || '',
    d: formData.datum || '',
    a: formData.adNummer || '',
    t: formData.tagNummer || '',
    o: formData.ordTid || '',
    f: formData.faktTid || '',
    m: formData.forsening || '0',
    r: formData.orsak || '',
    k: formData.kompPengar || 'Komp'
  };
}

function otUnpackFormData(packed) {
  return {
    trafikomrade: packed.tr || '',
    namn: packed.n || '',
    datum: packed.d || '',
    adNummer: packed.a || '',
    tagNummer: packed.t || '',
    ordTid: packed.o || '',
    faktTid: packed.f || '',
    forsening: packed.m || '0',
    orsak: packed.r || '',
    kompPengar: packed.k || 'Komp'
  };
}

function otGetDrafts() { return otLoadCookieArray('ot_dr'); }
function otSetDrafts(arr) { otSaveCookieArray('ot_dr', arr); }
function otGetHistory() { return otLoadCookieArray('ot_hi'); }
function otSetHistory(arr) { otSaveCookieArray('ot_hi', arr); }

function otAddToHistory(formData) {
  var entry = otPackEntry(formData);
  var history = otGetHistory();
  history.unshift(entry);
  if (history.length > OT_MAX_HISTORY) history.pop();
  otSetHistory(history);
  otUpdateBadges();
}

// ==========================================
// BADGES
// ==========================================

function otUpdateBadges() {
  var drafts = otGetDrafts();
  var history = otGetHistory();
  var draftBadge = document.getElementById('otDraftsBadge');
  var historyBadge = document.getElementById('otHistoryBadge');
  if (draftBadge) {
    if (drafts.length > 0) {
      draftBadge.textContent = drafts.length;
      draftBadge.classList.remove('hidden');
    } else {
      draftBadge.classList.add('hidden');
    }
  }
  if (historyBadge) {
    if (history.length > 0) {
      historyBadge.textContent = history.length;
      historyBadge.classList.remove('hidden');
    } else {
      historyBadge.classList.add('hidden');
    }
  }
}

// ==========================================
// VIEW SWITCHING
// ==========================================

function otSwitchView(viewName) {
  otCurrentView = viewName;
  var formViewEl = document.getElementById('otFormView');
  var draftsViewEl = document.getElementById('otDraftsView');
  var historyViewEl = document.getElementById('otHistoryView');

  if (formViewEl) formViewEl.style.display = viewName === 'form' ? '' : 'none';
  if (viewName === 'drafts') { draftsViewEl.classList.add('active'); } else { draftsViewEl.classList.remove('active'); }
  if (viewName === 'history') { historyViewEl.classList.add('active'); } else { historyViewEl.classList.remove('active'); }

  document.getElementById('otFormBtn').classList.toggle('active', viewName === 'form');
  document.getElementById('otDraftsBtn').classList.toggle('active', viewName === 'drafts');
  document.getElementById('otHistoryBtn').classList.toggle('active', viewName === 'history');

  if (viewName === 'drafts') otRenderDraftsView();
  if (viewName === 'history') otRenderHistoryView();

  var page = document.getElementById('overtimePage');
  if (page) page.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// HELPERS
// ==========================================

function otEscapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function otFormatDateTime(isoString) {
  try {
    var dt = new Date(isoString);
    var day = String(dt.getDate()).padStart(2, '0');
    var mon = String(dt.getMonth() + 1).padStart(2, '0');
    var hrs = String(dt.getHours()).padStart(2, '0');
    var mins = String(dt.getMinutes()).padStart(2, '0');
    return day + '/' + mon + ' ' + hrs + ':' + mins;
  } catch (e) { return '—'; }
}

function otEntryFieldHtml(label, value, fullWidth) {
  return '<div class="ot-entry-field' + (fullWidth ? ' full-width' : '') + '">' +
    '<div class="ot-entry-field-label">' + otEscapeHtml(label) + '</div>' +
    '<div class="ot-entry-field-value">' + otEscapeHtml(value || '—') + '</div></div>';
}

function otSetRadioValue(name, value) {
  if (!value) return;
  var target = document.querySelector('#overtimePage input[name="' + name + '"][value="' + value + '"]');
  if (target) {
    target.checked = true;
    var group = target.closest('.ot-radio-group');
    if (group) {
      group.querySelectorAll('.ot-radio-chip').forEach(function(l) { l.classList.remove('active'); });
      target.closest('.ot-radio-chip').classList.add('active');
    }
  }
}

function otGetTodayString() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// ==========================================
// TOAST
// ==========================================

function otShowToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('otToastContainer');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'ot-toast ' + type;
  var icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  toast.innerHTML = '<i class="fas ' + icon + '"></i> ' + message;
  container.appendChild(toast);
  setTimeout(function() {
    toast.classList.add('ot-toast-exit');
    setTimeout(function() { toast.remove(); }, 300);
  }, 4000);
}

// ==========================================
// CONFIRM MODAL
// ==========================================

function otShowConfirm(message) {
  return new Promise(function(resolve) {
    var overlay = document.getElementById('otModalOverlay');
    document.getElementById('otModalMessage').textContent = message;
    overlay.classList.add('open');
    function cleanup(result) {
      overlay.classList.remove('open');
      document.getElementById('otModalConfirm').removeEventListener('click', onConfirm);
      document.getElementById('otModalCancel').removeEventListener('click', onCancel);
      resolve(result);
    }
    function onConfirm() { cleanup(true); }
    function onCancel() { cleanup(false); }
    document.getElementById('otModalConfirm').addEventListener('click', onConfirm);
    document.getElementById('otModalCancel').addEventListener('click', onCancel);
  });
}

// ==========================================
// RADIO CHIP LOGIC
// ==========================================

function otInitRadioChips(groupId) {
  var group = document.getElementById(groupId);
  if (!group) return;
  var labels = group.querySelectorAll('.ot-radio-chip');
  labels.forEach(function(label) {
    label.addEventListener('click', function() {
      labels.forEach(function(l) { l.classList.remove('active'); });
      label.classList.add('active');
      label.querySelector('input').checked = true;
    });
  });
}

// ==========================================
// DELAY CALCULATION
// ==========================================

function otCalculateDelay() {
  var ordTid = document.getElementById('otOrdTid').value;
  var faktTid = document.getElementById('otFaktTid').value;
  var calcEl = document.getElementById('otCalcDelay');
  var totalEl = document.getElementById('otTotalDelay');

  if (!ordTid || !faktTid) {
    calcEl.textContent = '—';
    totalEl.textContent = '— min';
    return;
  }

  var ordParts = ordTid.split(':').map(Number);
  var faktParts = faktTid.split(':').map(Number);
  var ordMin = ordParts[0] * 60 + ordParts[1];
  var faktMin = faktParts[0] * 60 + faktParts[1];
  if (faktMin < ordMin) { faktMin += 1440; }

  var delay = faktMin - ordMin;
  calcEl.textContent = delay + ' min';

  var total = delay + otExtraMinutes;
  if (total < 0) { total = 0; }
  totalEl.textContent = total + ' min';
}

function otGetCalculatedDelay() {
  var ordTid = document.getElementById('otOrdTid').value;
  var faktTid = document.getElementById('otFaktTid').value;
  if (!ordTid || !faktTid) return 0;
  var ordParts = ordTid.split(':').map(Number);
  var faktParts = faktTid.split(':').map(Number);
  var ordMin = ordParts[0] * 60 + ordParts[1];
  var faktMin = faktParts[0] * 60 + faktParts[1];
  if (faktMin < ordMin) { faktMin += 1440; }
  return faktMin - ordMin;
}

// ==========================================
// PROGRESS BAR
// ==========================================

function otUpdateProgress() {
  var fields = ['otNamn', 'otDatum', 'otAdNummer', 'otTagNummer', 'otOrdTid', 'otFaktTid', 'otOrsak'];
  var filled = fields.filter(function(id) {
    var el = document.getElementById(id);
    return el && el.value.trim() !== '';
  }).length;
  var pct = Math.round((filled / fields.length) * 100);
  var bar = document.getElementById('otProgressFill');
  if (bar) bar.style.width = pct + '%';
}

// ==========================================
// ORSAK DROPDOWN
// ==========================================

function otRenderOrsakDropdown() {
  var settings = otGetSettings();
  var menu = document.getElementById('otOrsakMenu');
  if (!menu) return;
  menu.innerHTML = '';
  settings.phrases.forEach(function(phrase, idx) {
    var item = document.createElement('div');
    item.className = 'ot-orsak-item';

    var textWrap = document.createElement('div');
    textWrap.className = 'ot-orsak-item-text';
    var textSpan = document.createElement('span');
    textSpan.textContent = phrase;
    textWrap.appendChild(textSpan);
    textWrap.addEventListener('click', function() {
      document.getElementById('otOrsak').value = phrase;
      otUpdateProgress();
      otCloseOrsakDropdown();
    });

    var delBtn = document.createElement('button');
    delBtn.className = 'ot-orsak-item-delete';
    delBtn.type = 'button';
    delBtn.innerHTML = '<i class="fas fa-times"></i>';
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var s = otGetSettings();
      s.phrases.splice(idx, 1);
      otSaveSettings(s);
      otRenderOrsakDropdown();
      otRenderSettingsPanel();
      otShowToast('Orsak borttagen', 'info');
    });

    item.appendChild(textWrap);
    item.appendChild(delBtn);
    menu.appendChild(item);
  });
  requestAnimationFrame(otCheckOrsakOverflow);
}

function otCheckOrsakOverflow() {
  var menu = document.getElementById('otOrsakMenu');
  if (!menu) return;
  menu.querySelectorAll('.ot-orsak-item-text').forEach(function(el) {
    var span = el.querySelector('span');
    if (span && span.scrollWidth > el.clientWidth + 4) {
      el.classList.add('is-long');
      var distance = -(span.scrollWidth - el.clientWidth + 10);
      el.style.setProperty('--scroll-amount', distance + 'px');
    } else {
      el.classList.remove('is-long');
    }
  });
}

function otToggleOrsakDropdown() {
  if (otOrsakDropdownOpen) { otCloseOrsakDropdown(); }
  else { otOpenOrsakDropdown(); }
}

function otOpenOrsakDropdown() {
  otOrsakDropdownOpen = true;
  var trigger = document.getElementById('otOrsakTrigger');
  var menu = document.getElementById('otOrsakMenu');
  if (trigger) trigger.classList.add('open');
  if (menu) menu.classList.add('open');
  requestAnimationFrame(otCheckOrsakOverflow);
}

function otCloseOrsakDropdown() {
  otOrsakDropdownOpen = false;
  var trigger = document.getElementById('otOrsakTrigger');
  var menu = document.getElementById('otOrsakMenu');
  if (trigger) trigger.classList.remove('open');
  if (menu) menu.classList.remove('open');
}

// ==========================================
// DRAFTS MANAGEMENT
// ==========================================

function otSaveDraft() {
  var formData = otGetFormData();
  var entry = otPackEntry(formData);
  var drafts = otGetDrafts();
  drafts.unshift(entry);
  if (drafts.length > OT_MAX_DRAFTS) drafts.pop();
  otSetDrafts(drafts);
  otUpdateBadges();
  otShowToast('Utkast sparat!', 'success');
}

function otDeleteDraft(idx) {
  var drafts = otGetDrafts();
  drafts.splice(idx, 1);
  otSetDrafts(drafts);
  otUpdateBadges();
  otRenderDraftsView();
}

function otLoadDraftToForm(idx) {
  var drafts = otGetDrafts();
  if (!drafts[idx]) return;
  var fd = otUnpackFormData(drafts[idx]);
  document.getElementById('otNamn').value = fd.namn;
  document.getElementById('otDatum').value = fd.datum || otGetTodayString();
  document.getElementById('otAdNummer').value = fd.adNummer;
  document.getElementById('otTagNummer').value = fd.tagNummer;
  document.getElementById('otOrdTid').value = fd.ordTid;
  document.getElementById('otFaktTid').value = fd.faktTid;
  document.getElementById('otOrsak').value = fd.orsak;
  document.getElementById('otTrafikomrade').value = fd.trafikomrade || 'Öresundståg';
  otSetRadioValue('otKompPengar', fd.kompPengar);
  otCalculateDelay();
  var calcDel = otGetCalculatedDelay();
  var totalDel = parseInt(fd.forsening, 10) || 0;
  otExtraMinutes = Math.max(0, totalDel - calcDel);
  document.getElementById('otExtraMin').textContent = otExtraMinutes;
  otCalculateDelay();
  otUpdateProgress();
  otSwitchView('form');
  otShowToast('Utkast laddat i formuläret', 'info');
}

function otRenderDraftsView() {
  var container = document.getElementById('otDraftsListContainer');
  var drafts = otGetDrafts();
  var countEl = document.getElementById('otDraftsCount');
  if (countEl) countEl.textContent = drafts.length + ' st';
  if (!container) return;
  if (drafts.length === 0) {
    container.innerHTML = '<div class="ot-empty-state"><i class="fas fa-bookmark"></i><p>Inga sparade utkast. Fyll i formuläret och tryck "Spara till senare".</p></div>';
    return;
  }
  var html = '';
  drafts.forEach(function(packed, idx) {
    var fd = otUnpackFormData(packed);
    var savedDate = otFormatDateTime(packed.s);
    html += '<div class="ot-entry-card" style="animation-delay:' + (idx * 0.04) + 's">';
    html += '<div class="ot-entry-card-header">';
    html += '<span class="ot-entry-card-date"><i class="far fa-clock"></i> ' + savedDate + '</span>';
    html += '<span class="ot-entry-card-badge draft">Utkast</span>';
    html += '</div>';
    html += '<div class="ot-entry-card-body">';
    html += otEntryFieldHtml('Datum', fd.datum);
    html += otEntryFieldHtml('Tåg', fd.tagNummer);
    html += otEntryFieldHtml('Namn', fd.namn);
    html += otEntryFieldHtml('Försening', (fd.forsening || '0') + ' min');
    html += otEntryFieldHtml('Orsak', fd.orsak, true);
    html += '</div>';
    html += '<div class="ot-entry-card-actions">';
    html += '<button class="ot-btn-entry primary" onclick="otLoadDraftToForm(' + idx + ')"><i class="fas fa-upload"></i> Ladda</button>';
    html += '<button class="ot-btn-entry danger" onclick="otDeleteDraft(' + idx + ')"><i class="fas fa-trash"></i> Ta bort</button>';
    html += '</div></div>';
  });
  container.innerHTML = html;
}

// ==========================================
// HISTORY MANAGEMENT
// ==========================================

function otDeleteHistoryEntry(idx) {
  var history = otGetHistory();
  history.splice(idx, 1);
  otSetHistory(history);
  otUpdateBadges();
  otRenderHistoryView();
}

function otClearAllHistory() {
  otShowConfirm('Rensa all inskickad historik?').then(function(confirmed) {
    if (confirmed) {
      otSetHistory([]);
      otUpdateBadges();
      otRenderHistoryView();
      otShowToast('Historik rensad', 'info');
    }
  });
}

function otRenderHistoryView() {
  var container = document.getElementById('otHistoryListContainer');
  var history = otGetHistory();
  var countEl = document.getElementById('otHistoryCount');
  if (countEl) countEl.textContent = history.length + ' st';
  if (!container) return;
  if (history.length === 0) {
    container.innerHTML = '<div class="ot-empty-state"><i class="fas fa-history"></i><p>Inga inskickade registreringar ännu.</p></div>';
    return;
  }
  var html = '';
  history.forEach(function(packed, idx) {
    var fd = otUnpackFormData(packed);
    var sentDate = otFormatDateTime(packed.s);
    html += '<div class="ot-entry-card" style="animation-delay:' + (idx * 0.04) + 's">';
    html += '<div class="ot-entry-card-header">';
    html += '<span class="ot-entry-card-date"><i class="far fa-clock"></i> ' + sentDate + '</span>';
    html += '<span class="ot-entry-card-badge sent"><i class="fas fa-check" style="margin-right:4px"></i>Inskickat</span>';
    html += '</div>';
    html += '<div class="ot-entry-card-body">';
    html += otEntryFieldHtml('Datum', fd.datum);
    html += otEntryFieldHtml('Tåg', fd.tagNummer);
    html += otEntryFieldHtml('Namn', fd.namn);
    html += otEntryFieldHtml('Försening', (fd.forsening || '0') + ' min');
    html += otEntryFieldHtml('Trafikområde', fd.trafikomrade);
    html += otEntryFieldHtml('Komp/Pengar', fd.kompPengar);
    html += otEntryFieldHtml('AD-nummer', fd.adNummer);
    html += otEntryFieldHtml('Tid', (fd.ordTid || '—') + ' → ' + (fd.faktTid || '—'));
    html += otEntryFieldHtml('Orsak', fd.orsak, true);
    html += '</div>';
    html += '<div class="ot-entry-card-actions">';
    html += '<button class="ot-btn-entry danger" onclick="otDeleteHistoryEntry(' + idx + ')"><i class="fas fa-trash"></i> Ta bort</button>';
    html += '</div></div>';
  });
  html += '<button class="ot-btn-clear-history" onclick="otClearAllHistory()"><i class="fas fa-trash"></i> Rensa all historik</button>';
  container.innerHTML = html;
}

// ==========================================
// SETTINGS PANEL
// ==========================================

function otOpenSettings() {
  var overlay = document.getElementById('otSettingsOverlay');
  var drawer = document.getElementById('otSettingsDrawer');
  if (overlay) overlay.classList.add('open');
  if (drawer) drawer.classList.add('open');
  otRenderSettingsPanel();
}

function otCloseSettings() {
  var overlay = document.getElementById('otSettingsOverlay');
  var drawer = document.getElementById('otSettingsDrawer');
  if (overlay) overlay.classList.remove('open');
  if (drawer) drawer.classList.remove('open');
}

function otRenderSettingsPanel() {
  var settings = otGetSettings();

  // Saved name
  var namnEl = document.getElementById('otSavedNamnDisplay');
  if (namnEl) {
    namnEl.innerHTML = settings.namn
      ? '<div class="ot-setting-value"><span>' + otEscapeHtml(settings.namn) + '</span><button class="ot-btn-clear-setting" data-clear="namn"><i class="fas fa-times"></i></button></div>'
      : '<div class="ot-setting-empty">Inget sparat. Tryck 🔖 bredvid fältet.</div>';
  }

  // Saved AD
  var adEl = document.getElementById('otSavedAdDisplay');
  if (adEl) {
    adEl.innerHTML = settings.adNummer
      ? '<div class="ot-setting-value"><span>' + otEscapeHtml(settings.adNummer) + '</span><button class="ot-btn-clear-setting" data-clear="adNummer"><i class="fas fa-times"></i></button></div>'
      : '<div class="ot-setting-empty">Inget sparat. Tryck 🔖 bredvid fältet.</div>';
  }

  // Saved Komp/Pengar
  var kompEl = document.getElementById('otSavedKompDisplay');
  if (kompEl) {
    kompEl.innerHTML = '<div class="ot-setting-value"><span>' + otEscapeHtml(settings.kompPengar) + '</span></div>';
  }

  // Phrases
  var phraseListEl = document.getElementById('otPhraseList');
  if (phraseListEl) {
    phraseListEl.innerHTML = '';
    settings.phrases.forEach(function(phrase, idx) {
      var item = document.createElement('div');
      item.className = 'ot-phrase-item';
      item.innerHTML = '<span>' + otEscapeHtml(phrase) + '</span><button data-ot-phrase-idx="' + idx + '"><i class="fas fa-times"></i></button>';
      phraseListEl.appendChild(item);
    });
  }

  // Clear setting buttons (scoped to overtime page)
  var page = document.getElementById('overtimePage');
  if (page) {
    page.querySelectorAll('.ot-btn-clear-setting').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-clear');
        otUpdateSetting(key, '');
        if (key === 'namn') document.getElementById('otNamn').value = '';
        if (key === 'adNummer') document.getElementById('otAdNummer').value = '';
        otRenderSettingsPanel();
        otShowToast('Rensat!', 'info');
      });
    });

    // Remove phrase buttons
    page.querySelectorAll('[data-ot-phrase-idx]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-ot-phrase-idx'), 10);
        var s = otGetSettings();
        s.phrases.splice(idx, 1);
        otSaveSettings(s);
        otRenderSettingsPanel();
        otRenderOrsakDropdown();
      });
    });
  }

  // API status
  var statusText = document.getElementById('otApiStatusText');
  if (statusText) {
    statusText.textContent = '✅ Öppnar förifyllt formulär i ny flik';
  }
}

// ==========================================
// PRE-FILL URL SUBMISSION
// ==========================================

function otInitSubmitStatus() {
  var dot = document.getElementById('otStatusDot');
  var label = document.getElementById('otStatusLabel');
  if (dot) dot.className = 'ot-status-dot ok';
  if (label) label.textContent = 'Redo';
  var hint = document.getElementById('otSubmitHint');
  if (hint) hint.textContent = 'Öppnar förifyllt formulär — du trycker bara Skicka';
}

/**
 * Build a pre-filled MS Forms URL from form data.
 */
function otBuildPreFillUrl(formData) {
  var url = OT_FORM_PAGE_URL;
  for (var key in OT_QUESTION_IDS) {
    if (formData[key] !== undefined && formData[key] !== '') {
      url += '&' + OT_QUESTION_IDS[key] + '=' + encodeURIComponent(formData[key]);
    }
  }
  return url;
}

// ==========================================
// FORM VALIDATION & DATA
// ==========================================

function otValidateForm() {
  var errors = [];
  var fields = [
    { id: 'otNamn', label: 'Namn' },
    { id: 'otDatum', label: 'Datum' },
    { id: 'otAdNummer', label: 'AD-nummer' },
    { id: 'otTagNummer', label: 'Tågnummer' },
    { id: 'otOrdTid', label: 'Ordinarie ankomsttid' },
    { id: 'otFaktTid', label: 'Faktisk ankomsttid' },
    { id: 'otOrsak', label: 'Orsak' }
  ];

  // Clear previous errors within overtime page
  var page = document.getElementById('overtimePage');
  if (page) {
    page.querySelectorAll('.field-error').forEach(function(el) {
      el.classList.remove('field-error');
    });
  }

  fields.forEach(function(f) {
    var el = document.getElementById(f.id);
    if (el && !el.value.trim()) {
      errors.push(f.label);
      el.classList.add('field-error');
    }
  });

  var total = otGetCalculatedDelay() + otExtraMinutes;
  if (total <= 0) {
    errors.push('Försening måste vara > 0');
  }

  return errors;
}

function otGetFormData() {
  var trafikEl = document.getElementById('otTrafikomrade');
  var kompEl = document.querySelector('#overtimePage input[name="otKompPengar"]:checked');
  var total = otGetCalculatedDelay() + otExtraMinutes;

  return {
    trafikomrade: trafikEl ? trafikEl.value : 'Öresundståg',
    namn: document.getElementById('otNamn').value.trim(),
    datum: document.getElementById('otDatum').value,
    adNummer: document.getElementById('otAdNummer').value.trim(),
    tagNummer: document.getElementById('otTagNummer').value.trim(),
    ordTid: document.getElementById('otOrdTid').value,
    faktTid: document.getElementById('otFaktTid').value,
    forsening: String(total),
    orsak: document.getElementById('otOrsak').value.trim(),
    kompPengar: kompEl ? kompEl.value : 'Komp'
  };
}

// ==========================================
// SUBMIT HANDLER
// ==========================================

function otHandleSubmit() {
  var errors = otValidateForm();
  if (errors.length > 0) {
    otShowToast('Fyll i: ' + errors.join(', '), 'error');
    var firstError = document.querySelector('#overtimePage .field-error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  var formData = otGetFormData();
  otUpdateSetting('kompPengar', formData.kompPengar);

  // Build pre-filled URL and open in new tab
  var url = otBuildPreFillUrl(formData);
  window.open(url, '_blank');

  // Save to history (user will confirm submission in the form)
  otAddToHistory(formData);
  otShowSuccess('Formuläret har öppnats — tryck Skicka i formuläret!');
}

// ==========================================
// SUCCESS & RESET
// ==========================================

function otShowSuccess(message) {
  var btn = document.getElementById('otSubmitBtn');
  if (btn) {
    btn.classList.remove('loading');
    btn.classList.add('success');
    btn.innerHTML = '<i class="fas fa-external-link-alt"></i> Öppnat!';
    btn.disabled = false;
  }

  var msgEl = document.getElementById('otSuccessMessage');
  if (msgEl) msgEl.textContent = message || 'Förseningsövertiden har registrerats.';
  var overlay = document.getElementById('otSuccessOverlay');
  if (overlay) overlay.classList.add('open');
}

function otResetForNewEntry() {
  var overlay = document.getElementById('otSuccessOverlay');
  if (overlay) overlay.classList.remove('open');

  var btn = document.getElementById('otSubmitBtn');
  if (btn) {
    btn.className = 'ot-btn-submit';
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Skicka in';
    btn.disabled = false;
  }

  // Clear per-entry fields (keep saved ones)
  document.getElementById('otTagNummer').value = '';
  document.getElementById('otOrdTid').value = '';
  document.getElementById('otFaktTid').value = '';
  document.getElementById('otOrsak').value = '';
  otExtraMinutes = 0;
  document.getElementById('otExtraMin').textContent = '0';
  document.getElementById('otCalcDelay').textContent = '—';
  document.getElementById('otTotalDelay').textContent = '— min';

  // Set today's date again
  document.getElementById('otDatum').value = otGetTodayString();

  otUpdateProgress();

  // Reset train picker selection
  otSelectedTrainKey = null;
  otRenderTrainPicker();

  var page = document.getElementById('overtimePage');
  if (page) page.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// PROFILE TRAIN PICKER INTEGRATION
// ==========================================

var otSelectedTrainKey = null;  // 'last', 'rast', 'manual', or index string
var otProfileTrainsCache = null; // cached result of otGetProfileTrains()

/**
 * Gather trains from the profiled employee's dagvy for today.
 * Returns { available: bool, trains: [...], lastTrain, lastBeforeBreak, allSegments }
 */
function otGetProfileTrains() {
  var result = { available: false, trains: [], lastTrain: null, lastBeforeBreak: null };

  // Check if global profile functions exist
  if (typeof getProfileEmployeeId !== 'function') return result;
  var empId = getProfileEmployeeId();
  if (!empId) return result;

  if (typeof registeredEmployees === 'undefined' || !registeredEmployees[empId]) return result;
  var emp = registeredEmployees[empId];

  if (typeof normalizeName !== 'function' || typeof dagvyAllData === 'undefined') return result;
  var normalizedName = normalizeName(emp.name);
  var dagvyDoc = dagvyAllData[normalizedName];
  if (!dagvyDoc || !dagvyDoc.days) return result;

  // Find today
  var dateKey = (typeof getDateKey === 'function') ? getDateKey(new Date()) : otGetTodayString();
  var dayData = null;
  for (var i = 0; i < dagvyDoc.days.length; i++) {
    if (dagvyDoc.days[i].date === dateKey) { dayData = dagvyDoc.days[i]; break; }
  }
  if (!dayData || !dayData.segments) return result;

  var allSegs = dayData.segments;
  var extr = (typeof extractTrainNr === 'function') ? extractTrainNr : function(seg) {
    if (seg.trainNr && seg.trainNr.length > 0) return seg.trainNr.replace(/\s.*/g, '').trim();
    if (seg.activity && /^\d{3,5}(\s+\S+)*$/i.test(seg.activity.trim())) return seg.activity.trim().replace(/\s.*/g, '').trim();
    return null;
  };

  // Collect train segments
  var trainSegs = [];
  for (var s = 0; s < allSegs.length; s++) {
    var seg = allSegs[s];
    var tnr = extr(seg);
    if (!tnr) continue;
    trainSegs.push({
      trainNr: tnr,
      timeEnd: seg.timeEnd || '',
      timeStart: seg.timeStart || '',
      fromStation: seg.fromStation || '',
      toStation: seg.toStation || '',
      segIndex: s
    });
  }

  if (trainSegs.length === 0) return result;
  result.available = true;
  result.trains = trainSegs;

  // Last train of the day
  result.lastTrain = trainSegs[trainSegs.length - 1];

  // Last train before the last break (rast/rasto)
  var lastRastIndex = -1;
  for (var r = 0; r < allSegs.length; r++) {
    var act = (allSegs[r].activity || '').toLowerCase();
    if (act === 'rasto' || act === 'rast' || act.indexOf('rast obetald') !== -1 || act.indexOf('rast betald') !== -1) {
      lastRastIndex = r;
    }
  }
  if (lastRastIndex > 0) {
    for (var j = lastRastIndex - 1; j >= 0; j--) {
      var tnr2 = extr(allSegs[j]);
      if (tnr2) {
        result.lastBeforeBreak = {
          trainNr: tnr2,
          timeEnd: allSegs[j].timeEnd || '',
          timeStart: allSegs[j].timeStart || '',
          fromStation: allSegs[j].fromStation || '',
          toStation: allSegs[j].toStation || '',
          segIndex: j
        };
        break;
      }
    }
  }

  return result;
}

/**
 * Get realtime delay info for a train from the global stores.
 * Returns { delayMin, delayText, status } or null.
 */
function otGetTrainDelay(trainNr) {
  // Prefer destination-specific store (more accurate for arrival)
  if (typeof trainDestStore !== 'undefined' && trainDestStore[trainNr]) {
    return trainDestStore[trainNr];
  }
  if (typeof trainRealtimeStore !== 'undefined' && trainRealtimeStore[trainNr]) {
    return trainRealtimeStore[trainNr];
  }
  return null;
}

/**
 * Convert "HH:MM" + delayMin into a new "HH:MM" string.
 */
function otAddMinutesToTime(timeStr, minutes) {
  if (!timeStr || !minutes) return timeStr;
  var parts = timeStr.split(':');
  if (parts.length !== 2) return timeStr;
  var h = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var totalMin = h * 60 + m + minutes;
  if (totalMin < 0) totalMin += 1440;
  if (totalMin >= 1440) totalMin -= 1440;
  var nh = Math.floor(totalMin / 60);
  var nm = totalMin % 60;
  return String(nh).padStart(2, '0') + ':' + String(nm).padStart(2, '0');
}

/**
 * Render the train picker chips and info area.
 */
function otRenderTrainPicker() {
  var data = otGetProfileTrains();
  otProfileTrainsCache = data;

  var section = document.getElementById('otTrainPickerSection');
  if (!section) return;

  if (!data.available) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';

  var chipsEl = document.getElementById('otTrainChips');
  var html = '';

  // Chip: Last train of the day
  if (data.lastTrain) {
    html += '<button type="button" class="ot-train-chip' + (otSelectedTrainKey === 'last' ? ' active' : '') + '" data-ot-train="last">';
    html += '<span class="ot-chip-icon"><i class="fas fa-flag-checkered"></i></span> ';
    html += 'Sista <span class="ot-chip-nr">' + otEscapeHtml(data.lastTrain.trainNr) + '</span>';
    html += '</button>';
  }

  // Chip: Last train before break
  if (data.lastBeforeBreak && (!data.lastTrain || data.lastBeforeBreak.trainNr !== data.lastTrain.trainNr)) {
    html += '<button type="button" class="ot-train-chip' + (otSelectedTrainKey === 'rast' ? ' active' : '') + '" data-ot-train="rast">';
    html += '<span class="ot-chip-icon"><i class="fas fa-mug-hot"></i></span> ';
    html += 'Före rast <span class="ot-chip-nr">' + otEscapeHtml(data.lastBeforeBreak.trainNr) + '</span>';
    html += '</button>';
  }

  // Chip: Manual
  html += '<button type="button" class="ot-train-chip ot-chip-manual' + (otSelectedTrainKey === 'manual' ? ' active' : '') + '" data-ot-train="manual">';
  html += '<span class="ot-chip-icon"><i class="fas fa-pen"></i></span> Manuellt';
  html += '</button>';

  chipsEl.innerHTML = html;

  // Bind click events
  chipsEl.querySelectorAll('.ot-train-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var key = chip.getAttribute('data-ot-train');
      otSelectTrain(key);
    });
  });

  // Update info area for current selection
  otUpdateTrainInfo();
}

/**
 * Handle train chip selection.
 */
function otSelectTrain(key) {
  otSelectedTrainKey = key;

  // Update active state on all chips
  var chipsEl = document.getElementById('otTrainChips');
  if (chipsEl) {
    chipsEl.querySelectorAll('.ot-train-chip').forEach(function(chip) {
      chip.classList.toggle('active', chip.getAttribute('data-ot-train') === key);
    });
  }

  // Auto-fill form from selected train
  if (key === 'manual') {
    // Clear the auto-filled fields but keep any user data
    // Don't clear — user may have typed something
  } else {
    var trainData = null;
    if (key === 'last' && otProfileTrainsCache && otProfileTrainsCache.lastTrain) {
      trainData = otProfileTrainsCache.lastTrain;
    } else if (key === 'rast' && otProfileTrainsCache && otProfileTrainsCache.lastBeforeBreak) {
      trainData = otProfileTrainsCache.lastBeforeBreak;
    }
    if (trainData) {
      otAutoFillFromTrain(trainData);
    }
  }

  otUpdateTrainInfo();
}

/**
 * Fill in the form fields from a train segment.
 */
function otAutoFillFromTrain(trainData) {
  // Tågnummer
  var tagEl = document.getElementById('otTagNummer');
  if (tagEl) tagEl.value = trainData.trainNr;

  // Ordinarie ankomsttid (scheduled arrival = timeEnd of the segment)
  var ordEl = document.getElementById('otOrdTid');
  if (ordEl && trainData.timeEnd) ordEl.value = trainData.timeEnd;

  // Faktisk ankomsttid — from realtime data if available
  var faktEl = document.getElementById('otFaktTid');
  var delay = otGetTrainDelay(trainData.trainNr);
  if (faktEl && trainData.timeEnd) {
    if (delay && delay.delayMin !== undefined && !delay.canceled) {
      var actualTime = otAddMinutesToTime(trainData.timeEnd, delay.delayMin);
      faktEl.value = actualTime;
    } else {
      // No realtime data — leave empty so user fills in manually
      faktEl.value = '';
    }
  }

  // Recalculate delay and progress
  otCalculateDelay();
  otUpdateProgress();
}

/**
 * Update the info text below the chips for the selected train.
 */
function otUpdateTrainInfo() {
  var infoEl = document.getElementById('otTrainInfo');
  if (!infoEl) return;

  if (!otProfileTrainsCache || !otProfileTrainsCache.available || otSelectedTrainKey === 'manual') {
    infoEl.innerHTML = '';
    return;
  }

  var trainData = null;
  if (otSelectedTrainKey === 'last') trainData = otProfileTrainsCache.lastTrain;
  if (otSelectedTrainKey === 'rast') trainData = otProfileTrainsCache.lastBeforeBreak;
  if (!trainData) { infoEl.innerHTML = ''; return; }

  var delay = otGetTrainDelay(trainData.trainNr);

  var html = '<div class="ot-info-route">';
  html += '<i class="fas fa-route"></i> ';
  html += otEscapeHtml(trainData.fromStation || '?') + ' → ' + otEscapeHtml(trainData.toStation || '?');
  html += '</div>';

  html += '<div class="ot-info-times">';
  // Scheduled arrival
  html += '<span class="ot-info-time">Ord: <span class="ot-time-val">' + otEscapeHtml(trainData.timeEnd || '—') + '</span></span>';

  // Actual arrival (from realtime)
  if (delay && !delay.canceled) {
    var actualTime = otAddMinutesToTime(trainData.timeEnd, delay.delayMin);
    var statusClass = delay.status || 'ontime';
    html += '<span class="ot-info-time">Fakt: <span class="ot-time-val">' + otEscapeHtml(actualTime) + '</span>';
    if (delay.delayMin !== 0) {
      html += ' <span class="ot-time-delay ' + statusClass + '">' + otEscapeHtml(delay.delayText) + '</span>';
    }
    html += '</span>';
  } else if (delay && delay.canceled) {
    html += '<span class="ot-info-time">Fakt: <span class="ot-time-delay major">Inställt</span></span>';
  } else {
    html += '<span class="ot-info-time" style="opacity:0.6">Fakt: ingen realtidsdata</span>';
  }

  html += '</div>';
  infoEl.innerHTML = html;
}

// ==========================================
// PAGE SHOW / HIDE HOOKS
// ==========================================

function onOvertimePageShow() {
  if (!window._otInitialized) {
    initOvertime();
    window._otInitialized = true;
  }
  // Refresh date when re-entering page
  var datumEl = document.getElementById('otDatum');
  if (datumEl && !datumEl.value) {
    datumEl.value = otGetTodayString();
  }
  otUpdateBadges();

  // Refresh train picker (profile data or realtime may have changed)
  otRenderTrainPicker();
}

function onOvertimePageHide() {
  // Close any open drawers/modals/dropdowns
  otCloseSettings();
  otCloseOrsakDropdown();
  var modal = document.getElementById('otModalOverlay');
  if (modal) modal.classList.remove('open');
  var success = document.getElementById('otSuccessOverlay');
  if (success) success.classList.remove('open');
}

// ==========================================
// INITIALIZATION
// ==========================================

function initOvertime() {
  var settings = otGetSettings();

  // Set defaults
  document.getElementById('otDatum').value = otGetTodayString();
  if (settings.namn) {
    document.getElementById('otNamn').value = settings.namn;
    document.getElementById('otSaveNamn').classList.add('saved');
  }
  if (settings.adNummer) {
    document.getElementById('otAdNummer').value = settings.adNummer;
    document.getElementById('otSaveAd').classList.add('saved');
  }

  // Set Komp/Pengar default
  if (settings.kompPengar === 'Pengar') {
    var pengarRadio = document.querySelector('#overtimePage input[name="otKompPengar"][value="Pengar"]');
    if (pengarRadio) {
      pengarRadio.checked = true;
      var kompLabels = document.querySelectorAll('#otKompGroup .ot-radio-chip');
      kompLabels.forEach(function(l) { l.classList.remove('active'); });
      pengarRadio.closest('.ot-radio-chip').classList.add('active');
    }
  }

  // Init radio chips
  otInitRadioChips('otKompGroup');

  // Render orsak dropdown
  otRenderOrsakDropdown();

  // Orsak dropdown toggle
  var orsakTrigger = document.getElementById('otOrsakTrigger');
  if (orsakTrigger) {
    orsakTrigger.addEventListener('click', otToggleOrsakDropdown);
  }
  document.addEventListener('click', function(e) {
    var dd = document.getElementById('otOrsakDropdown');
    if (otOrsakDropdownOpen && dd && !dd.contains(e.target)) {
      otCloseOrsakDropdown();
    }
  });

  // Time input listeners for auto-delay
  document.getElementById('otOrdTid').addEventListener('input', otCalculateDelay);
  document.getElementById('otFaktTid').addEventListener('input', otCalculateDelay);

  // Extra minutes stepper
  document.getElementById('otExtraPlus').addEventListener('click', function() {
    otExtraMinutes += 1;
    document.getElementById('otExtraMin').textContent = otExtraMinutes;
    otCalculateDelay();
  });
  document.getElementById('otExtraMinus').addEventListener('click', function() {
    if (otExtraMinutes > 0) { otExtraMinutes -= 1; }
    document.getElementById('otExtraMin').textContent = otExtraMinutes;
    otCalculateDelay();
  });

  // Progress tracking
  ['otNamn', 'otDatum', 'otAdNummer', 'otTagNummer', 'otOrdTid', 'otFaktTid', 'otOrsak'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', otUpdateProgress);
  });
  otUpdateProgress();

  // Save buttons
  document.getElementById('otSaveNamn').addEventListener('click', function() {
    var val = document.getElementById('otNamn').value.trim();
    if (val) {
      otUpdateSetting('namn', val);
      this.classList.add('saved');
      otShowToast('Namn sparat: ' + val, 'success');
    }
  });
  document.getElementById('otSaveAd').addEventListener('click', function() {
    var val = document.getElementById('otAdNummer').value.trim();
    if (val) {
      otUpdateSetting('adNummer', val);
      this.classList.add('saved');
      otShowToast('AD-nummer sparat: ' + val, 'success');
    }
  });

  // Settings drawer
  document.getElementById('otSettingsBtn').addEventListener('click', otOpenSettings);
  document.getElementById('otSettingsOverlay').addEventListener('click', otCloseSettings);
  document.getElementById('otDrawerClose').addEventListener('click', otCloseSettings);

  // Add phrase
  document.getElementById('otBtnAddPhrase').addEventListener('click', function() {
    var input = document.getElementById('otNewPhraseInput');
    var val = input.value.trim();
    if (val) {
      var s = otGetSettings();
      if (s.phrases.indexOf(val) === -1) {
        s.phrases.push(val);
        otSaveSettings(s);
        otRenderOrsakDropdown();
        otRenderSettingsPanel();
      }
      input.value = '';
      otShowToast('Fras tillagd: ' + val, 'success');
    }
  });
  document.getElementById('otNewPhraseInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('otBtnAddPhrase').click();
    }
  });

  // Clear all
  document.getElementById('otBtnClearAll').addEventListener('click', function() {
    otShowConfirm('Rensa ALLA sparade data? (Namn, AD-nummer, fraser, utkast, historik)').then(function(confirmed) {
      if (confirmed) {
        otSaveSettings({ namn: '', adNummer: '', kompPengar: 'Komp', phrases: OT_DEFAULT_PHRASES.slice() });
        otSetDrafts([]);
        otSetHistory([]);
        document.getElementById('otNamn').value = '';
        document.getElementById('otAdNummer').value = '';
        document.getElementById('otSaveNamn').classList.remove('saved');
        document.getElementById('otSaveAd').classList.remove('saved');
        otRenderOrsakDropdown();
        otRenderSettingsPanel();
        otUpdateBadges();
        otShowToast('Alla sparade data rensade', 'info');
      }
    });
  });

  // View switching
  document.getElementById('otFormBtn').addEventListener('click', function() { otSwitchView('form'); });
  document.getElementById('otDraftsBtn').addEventListener('click', function() { otSwitchView('drafts'); });
  document.getElementById('otHistoryBtn').addEventListener('click', function() { otSwitchView('history'); });

  // Save draft
  document.getElementById('otSaveDraftBtn').addEventListener('click', otSaveDraft);

  // Submit
  document.getElementById('otSubmitBtn').addEventListener('click', otHandleSubmit);

  // New entry
  document.getElementById('otBtnNewEntry').addEventListener('click', otResetForNewEntry);

  // Initial badges
  otUpdateBadges();

  // Init submit status indicator
  otInitSubmitStatus();

  console.log('[OT] Overtime page initialized');
}
