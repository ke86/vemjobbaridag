/**
 * documents.js – Dokument-sida med PDF-visare och klickbar innehållsförteckning
 * Relies on: pdf.js (CDN), setupPinchZoom from la.js
 */

/* global pdfjsLib, setupPinchZoom, setFilterCookie, getFilterCookie */

// =============================================
// TOC DATA — Kollektivavtal
// =============================================
var DOC_KOLLEKTIVAVTAL_TOC = [
  { title: '§ 1 Avtalets omfattning', page: 4 },
  { title: '§ 2 Anställning', page: 5, children: [
    { title: 'Mom 1 Anställning tillsvidare', page: 5 },
    { title: 'Mom 2 Tidsbegränsad anställning', page: 5 },
    { title: 'Mom 3 Flyttning', page: 5 }
  ]},
  { title: '§ 3 Allmänna åligganden', page: 5 },
  { title: '§ 4 Bisyssla', page: 5, children: [
    { title: 'Mom 1 Uppgiftsskyldighet', page: 5 },
    { title: 'Mom 2 Konkurrensbisyssla', page: 5 }
  ]},
  { title: '§ 5 Lön', page: 6, children: [
    { title: 'Mom 1 Begreppet månadslön', page: 6 },
    { title: 'Mom 2 Löneutbetalning', page: 6 },
    { title: 'Mom 3 Lön för del av löneperiod', page: 6 },
    { title: 'Mom 4 Arbetstagare som tas ur tjänst', page: 6 },
    { title: 'Mom 5 Arbetstagare som omplaceras', page: 6 },
    { title: 'Mom 6 Särskilda lönetillägg', page: 6 }
  ]},
  { title: '§ 6 Arbetstid', page: 7, children: [
    { title: 'Mom 1 Grunden', page: 7 },
    { title: 'Mom 2 Definitioner', page: 7 },
    { title: 'Mom 3 Arbetstidens längd', page: 8 },
    { title: 'Mom 4 Avstämning av arbetstid', page: 9 },
    { title: 'Mom 5 Tillgodoräknad tid', page: 9 },
    { title: 'Mom 6 Fridagar', page: 9 },
    { title: 'Mom 7 Ordinarie arbetstidsförläggning', page: 10 },
    { title: 'Mom 7:1 Max landsgränspassager', page: 11 },
    { title: 'Mom 8 Utbildningskurs', page: 11 },
    { title: 'Mom 9 Tjänstgöringsfria uppehåll', page: 11 },
    { title: 'Mom 10 Tidsförskjutningstillägg', page: 11 }
  ]},
  { title: '§ 7 Övertid', page: 12, children: [
    { title: 'Mom 1 Övertidsarbete', page: 12 },
    { title: 'Mom 2 Skyldighet att utföra övertidsarbete', page: 12 },
    { title: 'Mom 3 Nödfallsövertid', page: 12 },
    { title: 'Mom 4 Rätt till övertidskompensation', page: 12 },
    { title: 'Mom 5 Ej i direkt anslutning', page: 13 },
    { title: 'Mom 6 Olika typer av övertidskompensation', page: 13 },
    { title: 'Mom 7 Beräkning av övertidsersättning', page: 13 },
    { title: 'Mom 8 Beräkning av kompensationsledighet', page: 13 }
  ]},
  { title: '§ 8 Mertid', page: 13, children: [
    { title: 'Mom 1 Mertidsarbete', page: 13 },
    { title: 'Mom 2 Skyldighet att utföra mertidsarbete', page: 14 },
    { title: 'Mom 3 Nödfallsmertid', page: 14 },
    { title: 'Mom 4 Rätt till mertidskompensation', page: 14 },
    { title: 'Mom 5 Ej i direkt anslutning', page: 14 },
    { title: 'Mom 6 Olika typer av mertidskompensation', page: 15 },
    { title: 'Mom 7 Beräkning av mertidsersättning', page: 15 },
    { title: 'Mom 8 Kompensationsledighet mertid', page: 15 }
  ]},
  { title: '§ 9 Restidsersättning m.m.', page: 15, children: [
    { title: 'Mom 1 Rätt till restidsersättning', page: 15 },
    { title: 'Mom 2 Restid', page: 15 },
    { title: 'Mom 3 Ersättning', page: 16 },
    { title: 'Mom 4 Traktamente', page: 16 },
    { title: 'Mom 5 Bilersättning', page: 16 }
  ]},
  { title: '§ 10 Ersättning för Ob, jour, beredskap', page: 16, children: [
    { title: 'Mom 1 Obekväm arbetstid', page: 16 },
    { title: 'Mom 2 Jour', page: 17 },
    { title: 'Mom 3 Beredskap', page: 17 }
  ]},
  { title: '§ 11 Semester', page: 18, children: [
    { title: 'Mom 1 Allmänna bestämmelser', page: 18 },
    { title: 'Mom 2 Semesterns längd', page: 18 },
    { title: 'Mom 3 Semesterlön', page: 19 },
    { title: 'Mom 4 Utbetalning av semesterlön', page: 19 },
    { title: 'Mom 5 Avdrag obetald semesterdag', page: 19 },
    { title: 'Mom 6 Avräkning', page: 19 },
    { title: 'Mom 7 Semesterersättning', page: 19 },
    { title: 'Mom 8 Sparande av semester', page: 19 },
    { title: 'Mom 9 Semester vid intermittent', page: 19 },
    { title: 'Mom 10 Ändrad sysselsättningsgrad', page: 20 },
    { title: 'Mom 11 Intyg om uttagen semester', page: 20 },
    { title: 'Mom 12 Semesterns förläggning', page: 20 }
  ]},
  { title: '§ 12 Sjuklön m.m.', page: 21, children: [
    { title: 'Mom 1 Rätten till sjuklön', page: 21 },
    { title: 'Mom 2 Sjukanmälan', page: 21 },
    { title: 'Mom 3 Försäkran och läkarintyg', page: 21 },
    { title: 'Mom 4 Sjuklönens storlek', page: 21 },
    { title: 'Mom 5 Sjuklönetidens längd', page: 22 },
    { title: 'Mom 6 Ersättning smittbärarpenning', page: 23 },
    { title: 'Mom 7 Avdrag vid sjukdom utan sjuklön', page: 23 },
    { title: 'Mom 8 Begreppet månadslön', page: 23 },
    { title: 'Mom 9 Samordningsregler', page: 23 },
    { title: 'Mom 10 Ersättning för sjukvård', page: 24 }
  ]},
  { title: '§ 13 Föräldraledighet', page: 24 },
  { title: '§ 14 Ledighet', page: 25, children: [
    { title: 'Mom 1 Ledighet med lön', page: 25 },
    { title: 'Mom 2 Ledighet utan lön', page: 27 },
    { title: 'Mom 3 Avdragsberäkning', page: 27 },
    { title: 'Mom 4 Frånvaro av annan anledning', page: 27 }
  ]},
  { title: '§ 15 Uppsägning', page: 27, children: [
    { title: 'Mom 1 Formen för uppsägning', page: 27 },
    { title: 'Mom 2 Uppsägning arbetstagarens sida', page: 27 },
    { title: 'Mom 3 Uppsägning arbetsgivarens sida', page: 28 },
    { title: 'Mom 4 Övriga bestämmelser', page: 28 },
    { title: 'Mom 5 Personalinskränkning', page: 29 }
  ]},
  { title: '§ 16 Giltighetstid', page: 30 },
  { title: 'Bilaga 2 – Arvodesavtal', page: 31 }
];

// =============================================
// TOC DATA — SR 26-3 (Sikkerhedsreglement, Banedanmark)
// Page numbers are PDF pages (printed page + 4)
// =============================================
var DOC_SR263_TOC = [
  { title: 'Afsnit 1 – Indledning og almindelige bestemmelser', page: 13, children: [
    { title: '§ 1 Indledning', page: 14 },
    { title: '§ 2 Almindelige bestemmelser', page: 16 },
    { title: '§ 3 Personalets kompetence og ansvar', page: 33 }
  ]},
  { title: 'Afsnit 2 – Signaler', page: 46, children: [
    { title: '§ 6 Hovedsignaler', page: 47 },
    { title: '§ 7 Forsignalering af hovedsignaler', page: 91 },
    { title: '§ 8 DV-signaler samt hvide lys', page: 104 },
    { title: '§ 9 Sporstopper med rødt lys og refleks', page: 113 },
    { title: '§ 10 Sporskiftesignaler og sporsperresignaler', page: 115 },
    { title: '§ 11 Automatisk sikrede overkørsler', page: 123 },
    { title: '§ 12 Signaler på tog og køretøjer', page: 133 },
    { title: '§ 13 Afgangssignaler', page: 139 },
    { title: '§ 15 Lydsignaler', page: 143 },
    { title: '§ 16 Standsignaler', page: 145 },
    { title: '§ 17 Mærker', page: 180 },
    { title: '§ 18 Håndsignaler', page: 204 }
  ]},
  { title: 'Afsnit 3 – Sikkerhedstjeneste', page: 224, children: [
    { title: '§ 32 Sikkerhedsmeldinger', page: 227 },
    { title: '§ 33 Sikring af køretøjer', page: 231 },
    { title: '§ 34 Forstyrrelser og arbejder i sikringsanlæg', page: 233 },
    { title: '§ 35 Betjening af togekspeditionssteder', page: 242 },
    { title: '§ 36 Rangering', page: 244 },
    { title: '§ 37 Kørestrøm', page: 251 }
  ]},
  { title: 'Afsnit 4 – Togenes fremførelse', page: 260, children: [
    { title: '§ 41 Sporbenyttelse og togfølge på den fri bane', page: 262 },
    { title: '§ 42 Togrækkefølge og krydsning', page: 264 },
    { title: '§ 43 Af- og tilbagemelding af tog', page: 266 },
    { title: '§ 44 Rangertogveje', page: 269 },
    { title: '§ 45 Hovedtogveje', page: 274 },
    { title: '§ 46 Kørsel når signalgivning ikke kan anvendes', page: 287 },
    { title: '§ 47 Kørsel på strækninger med linjeblok', page: 291 },
    { title: '§ 50 Togenes standsning og afgang', page: 296 },
    { title: '§ 52 Banestrækningens hastighed', page: 300 },
    { title: '§ 53 La', page: 306 }
  ]},
  { title: 'Afsnit 5 – Ekstratog', page: 310, children: [
    { title: '§ 55 Ekstratog', page: 311 }
  ]},
  { title: 'Afsnit 6 – Togenes størrelse, sammensætning og hastighed', page: 318, children: [
    { title: '§ 61 Togenes størrelse', page: 320 },
    { title: '§ 62 Bremser', page: 321 },
    { title: '§ 63 Transport af usædvanlig transport', page: 325 },
    { title: '§ 64 Transport af farligt gods (RID)', page: 327 },
    { title: '§ 66 Bremseprøver', page: 331 },
    { title: '§ 68 Togenes hastighed', page: 333 }
  ]},
  { title: 'Afsnit 7 – Infrastrukturarbejder', page: 336, children: [
    { title: '§ 70 Generelle forhold', page: 337 },
    { title: '§ 71 Arbejds- og placeringskørsel', page: 342 },
    { title: '§ 72 Planlægning af infrastrukturarbejder', page: 350 },
    { title: '§ 73 Udførelse af infrastrukturarbejder', page: 355 },
    { title: '§ 75 Arbejde i og ved køreledningsanlæg', page: 375 },
    { title: '§ 78 Arbejdskøretøjer', page: 383 }
  ]},
  { title: 'Afsnit 8 – Uregelmæssigheder', page: 387, children: [
    { title: '§ 84 Aflysning af tog', page: 392 },
    { title: '§ 85 Kørestrøm. Fejl og uregelmæssigheder', page: 393 },
    { title: '§ 86 Sporspærring uden SR-arbejdsleder', page: 401 },
    { title: '§ 89 Ekstraordinær standsning. Nedbrudte tog og hjælpetog', page: 406 },
    { title: '§ 90 Uheld, ulykker og sikkerhedsmæssige hændelser', page: 409 }
  ]},
  { title: 'Afsnit 9 – Bilag', page: 416, children: [
    { title: 'Bilag 1 Strækninger (signal 11.5)', page: 417 },
    { title: 'Bilag 2 S-blanketter', page: 418 },
    { title: 'Bilag 3 Udsigtslængde fra arbejdssted', page: 426 },
    { title: 'Bilag 5 Strækninger med elektrisk togopvarmning', page: 428 },
    { title: 'Bilag 6 Strækninger med køreledningsanlæg', page: 429 },
    { title: 'Bilag 7 Fortegnelse over faresedler', page: 430 },
    { title: 'Bilag 8 Strækninger med linjeblok, fjernstyring mv.', page: 438 },
    { title: 'Bilag 9 Strækninger med faste togkontrolanlæg', page: 440 },
    { title: 'Bilag 10 Stedlig dækning af sporspærringer', page: 441 },
    { title: 'Bilag 11 Stationer (midlertidige hastighedsnedsættelser)', page: 443 },
    { title: 'Bilag 12 Hastighed relateret til høj metervægt', page: 444 }
  ]},
  { title: 'Afsnit 10 – Definitioner', page: 446 }
];

// =============================================
// REMOTE ZIP CONFIG
// =============================================
var REMOTE_DOC_WORKER = 'https://onevr-auth.kenny-eriksson1986.workers.dev';
var REMOTE_DOC_API_KEY = 'onevr-docs-2026';
var REMOTE_DOC_MAP = {
  driftmeddelande: { endpoint: '/docs/Driftmeddelande', parsed: '/docs/Driftmeddelande/parsed', title: 'Driftmeddelande' },
  ta_danmark:      { endpoint: '/docs/TA_-_Danmark',    parsed: '/docs/TA_-_Danmark/parsed',    title: 'TA Danmark' }
};
var _remoteListCache = {};  // key → { items: [...], ts }
var _remoteZipCache = {};   // key → { zip: JSZip instance, ts }
var _remoteZipActiveId = null;

// =============================================
// STATE
// =============================================
var _docPdfLoaded = false;
var _docPdfDoc = null;
var _docPageCanvases = [];

// Search state
var _docTextCache = [];        // [{pageNum, text, items, viewport}]
var _docTextExtracted = false;
var _docSearchTimer = null;
var _docCurrentHighlights = [];

// Navigation depth: 'list' | 'zip' | 'pdf'
var _docNavDepth = 'list';

// Resize state
var _docLastRenderWidth = 0;
var _docResizeTimer = null;

// =============================================
// PAGE SHOW / HIDE
// =============================================
function onDocumentsPageShow() {
  // Reset to list view when entering page
  var listView = document.getElementById('docListView');
  var pdfView = document.getElementById('docPdfView');
  var zipView = document.getElementById('docZipView');
  if (listView) listView.style.display = '';
  if (pdfView) pdfView.style.display = 'none';
  if (zipView) zipView.style.display = 'none';
  _docNavDepth = 'list';

  // Fetch remote doc metadata (lightweight, no ZIP download)
  fetchRemoteDocMeta();
}

/**
 * Fetch metadata for remote documents via GET /docs.
 * Updates the date badges on remote doc cards.
 */
function fetchRemoteDocMeta() {
  var url = REMOTE_DOC_WORKER + '/docs';
  fetch(url, { headers: { 'X-API-Key': REMOTE_DOC_API_KEY } })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (!data) return;

      // Build lookup: category → {uploadedAt, ...}
      // Handle both formats:
      //   New: { files: [{category, uploadedAt, ...}] }
      //   Old: { "TA_-_Danmark": {uploadedAt, ...} }
      var byCategory = {};
      if (data.files && Array.isArray(data.files)) {
        for (var i = 0; i < data.files.length; i++) {
          var f = data.files[i];
          if (f.category) byCategory[f.category] = f;
        }
      } else {
        // Try old format: keys are category names directly
        for (var key in data) {
          if (data.hasOwnProperty(key) && data[key] && data[key].uploadedAt) {
            byCategory[key] = data[key];
          }
        }
      }

      // Map worker category names to our remote IDs
      var mapping = {
        'Driftmeddelande': 'driftmeddelande',
        'TA_-_Danmark': 'ta_danmark'
      };
      for (var catKey in mapping) {
        if (!mapping.hasOwnProperty(catKey)) continue;
        var remoteId = mapping[catKey];
        var meta = byCategory[catKey];
        if (!meta || !meta.uploadedAt) continue;

        var dateStr = formatUploadedAt(meta.uploadedAt);
        if (!dateStr) continue;

        // Update the card
        var card = document.querySelector('.doc-card[data-remote="' + remoteId + '"]');
        if (!card) continue;
        var badge = card.querySelector('.doc-card-date');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'doc-card-date';
          var arrow = card.querySelector('.doc-card-arrow');
          if (arrow) {
            card.insertBefore(badge, arrow);
          } else {
            card.appendChild(badge);
          }
        }
        badge.textContent = dateStr;
      }
    })
    .catch(function() { /* fail silently */ });
}

/**
 * Format an uploadedAt string to a short Swedish date.
 * Handles ISO strings and Firestore timestamps.
 */
function formatUploadedAt(val) {
  var d;
  if (typeof val === 'string') {
    d = new Date(val);
  } else if (val && val.seconds) {
    // Firestore timestamp
    d = new Date(val.seconds * 1000);
  } else if (val && val._seconds) {
    d = new Date(val._seconds * 1000);
  } else {
    return '';
  }
  if (isNaN(d.getTime())) return '';

  var day = d.getDate();
  var months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun',
                'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return day + ' ' + months[d.getMonth()];
}

// =============================================
// INIT
// =============================================
function initDocuments() {
  // Card clicks → open local PDF
  var cards = document.querySelectorAll('.doc-card[data-doc]');
  for (var c = 0; c < cards.length; c++) {
    (function(card) {
      card.addEventListener('click', function() {
        _docNavDepth = 'pdf';
        openDocPdf(card.getAttribute('data-doc'));
      });
    })(cards[c]);
  }

  // Remote ZIP card clicks
  var remoteCards = document.querySelectorAll('.doc-card[data-remote]');
  for (var r = 0; r < remoteCards.length; r++) {
    (function(card) {
      card.addEventListener('click', function() {
        openRemoteZip(card.getAttribute('data-remote'));
      });
    })(remoteCards[r]);
  }

  // PDF Back button — context-aware (back to list or back to zip file list)
  var backBtn = document.getElementById('docBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      var pdfView = document.getElementById('docPdfView');
      if (pdfView) pdfView.style.display = 'none';

      if (_docNavDepth === 'pdf' && _remoteZipActiveId) {
        // Came from ZIP file list → go back to ZIP list
        var zipView = document.getElementById('docZipView');
        if (zipView) zipView.style.display = '';
        _docNavDepth = 'zip';
      } else {
        // Came from main list → go back to main list
        var listView = document.getElementById('docListView');
        if (listView) listView.style.display = '';
        _remoteZipActiveId = null;
        _docNavDepth = 'list';
      }
    });
  }

  // ZIP Back button → back to main document list
  var zipBackBtn = document.getElementById('docZipBackBtn');
  if (zipBackBtn) {
    zipBackBtn.addEventListener('click', function() {
      var zipView = document.getElementById('docZipView');
      var listView = document.getElementById('docListView');
      if (zipView) zipView.style.display = 'none';
      if (listView) listView.style.display = '';
      _remoteZipActiveId = null;
      _docNavDepth = 'list';
    });
  }

  // TOC toggle button
  var tocBtn = document.getElementById('docTocBtn');
  var searchBtn = document.getElementById('docSearchBtn');
  var tocPanel = document.getElementById('docTocPanel');
  var searchPanel = document.getElementById('docSearchPanel');

  if (tocBtn) {
    tocBtn.addEventListener('click', function() {
      if (!tocPanel) return;
      var isOpen = tocPanel.style.display !== 'none';
      tocPanel.style.display = isOpen ? 'none' : 'block';
      tocBtn.classList.toggle('doc-toc-btn-active', !isOpen);
      // Close search panel when opening TOC
      if (!isOpen && searchPanel) {
        searchPanel.style.display = 'none';
        if (searchBtn) searchBtn.classList.remove('doc-search-btn-active');
      }
    });
  }

  // Search toggle button
  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      if (!searchPanel) return;
      var isOpen = searchPanel.style.display !== 'none';
      searchPanel.style.display = isOpen ? 'none' : 'block';
      searchBtn.classList.toggle('doc-search-btn-active', !isOpen);
      // Close TOC panel when opening search
      if (!isOpen && tocPanel) {
        tocPanel.style.display = 'none';
        if (tocBtn) tocBtn.classList.remove('doc-toc-btn-active');
      }
      // Focus input when opening
      if (!isOpen) {
        var input = document.getElementById('docSearchInput');
        if (input) input.focus();
        // Extract text if not done yet
        if (!_docTextExtracted && _docPdfDoc) {
          extractAllText();
        }
      }
    });
  }

  // Search input events
  initDocSearch();
}

// =============================================
// BUILD TOC
// =============================================
function buildTocPanel(tocData) {
  var list = document.getElementById('docTocList');
  if (!list) return;
  var html = '';
  for (var i = 0; i < tocData.length; i++) {
    var item = tocData[i];
    html += '<div class="doc-toc-item doc-toc-section" data-page="' + item.page + '">';
    html += '<span class="doc-toc-title">' + item.title + '</span>';
    html += '<span class="doc-toc-page">s. ' + item.page + '</span>';
    html += '</div>';
    if (item.children) {
      for (var j = 0; j < item.children.length; j++) {
        var child = item.children[j];
        html += '<div class="doc-toc-item doc-toc-child" data-page="' + child.page + '">';
        html += '<span class="doc-toc-title">' + child.title + '</span>';
        html += '<span class="doc-toc-page">s. ' + child.page + '</span>';
        html += '</div>';
      }
    }
  }
  list.innerHTML = html;

  // Click handlers
  list.addEventListener('click', function(e) {
    var tocItem = e.target.closest('.doc-toc-item');
    if (!tocItem) return;
    var pageNum = parseInt(tocItem.getAttribute('data-page'), 10);
    if (!pageNum) return;
    scrollToDocPage(pageNum);
    // Close TOC panel on mobile
    var panel = document.getElementById('docTocPanel');
    var tocBtn = document.getElementById('docTocBtn');
    if (panel) panel.style.display = 'none';
    if (tocBtn) tocBtn.classList.remove('doc-toc-btn-active');
  });
}

// =============================================
// REMOTE ZIP — FETCH, UNZIP, LIST, OPEN PDF
// =============================================

/**
 * Open a remote document list: fetch /parsed endpoint for metadata,
 * then show list. ZIP is only fetched when user clicks a PDF.
 */
function openRemoteZip(remoteId) {
  var config = REMOTE_DOC_MAP[remoteId];
  if (!config) return;

  _remoteZipActiveId = remoteId;
  _docNavDepth = 'zip';

  var listView = document.getElementById('docListView');
  var zipView = document.getElementById('docZipView');
  var pdfView = document.getElementById('docPdfView');
  if (listView) listView.style.display = 'none';
  if (pdfView) pdfView.style.display = 'none';
  if (zipView) zipView.style.display = '';

  var titleEl = document.getElementById('docZipTitle');
  if (titleEl) titleEl.textContent = config.title;

  // Check list cache (valid 10 min)
  var cached = _remoteListCache[remoteId];
  if (cached && (Date.now() - cached.ts) < 10 * 60 * 1000) {
    renderDocList(cached.items);
    return;
  }

  // Show loading
  var zipList = document.getElementById('docZipList');
  if (zipList) {
    zipList.innerHTML =
      '<div class="doc-zip-loading">' +
        '<div class="doc-zip-spinner"></div>' +
        '<div>Hämtar dokument…</div>' +
      '</div>';
  }

  // Fetch parsed metadata (lightweight JSON)
  fetchRemoteDocList(config.parsed).then(function(items) {
    _remoteListCache[remoteId] = { items: items, ts: Date.now() };
    if (_remoteZipActiveId === remoteId) {
      renderDocList(items);
    }
  }).catch(function(err) {
    if (_remoteZipActiveId === remoteId && zipList) {
      zipList.innerHTML =
        '<div class="doc-zip-loading doc-zip-error">' +
          'Kunde inte hämta dokument: ' + (err.message || 'okänt fel') +
        '</div>';
    }
  });
}

/**
 * Fetch parsed document list from /parsed endpoint.
 * Returns array of metadata objects sorted by start date.
 */
async function fetchRemoteDocList(parsedEndpoint) {
  var url = REMOTE_DOC_WORKER + parsedEndpoint;
  var resp = await fetch(url, {
    headers: { 'X-API-Key': REMOTE_DOC_API_KEY }
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  var items = await resp.json();
  if (!Array.isArray(items)) throw new Error('Oväntat svar');

  // Enrich with parsed date info
  for (var i = 0; i < items.length; i++) {
    var parsed = parseZipFileMeta(items[i].filename || '', items[i]);
    items[i]._title = parsed.title;
    items[i]._dateFrom = parsed.dateFrom;
    items[i]._dateTo = parsed.dateTo;
    items[i]._week = parsed.week;
    items[i]._taNumber = parsed.taNumber;
  }

  // Sort by start date (earliest first)
  items.sort(function(a, b) {
    if (a._dateFrom && b._dateFrom) {
      if (a._dateFrom < b._dateFrom) return -1;
      if (a._dateFrom > b._dateFrom) return 1;
    } else if (a._dateFrom) return -1;
    else if (b._dateFrom) return 1;
    return (a.filename || '').localeCompare(b.filename || '', 'sv');
  });

  return items;
}

/**
 * Fetch the actual ZIP file (for PDF viewing).
 * Handles both raw ZIP and base64-encoded responses.
 * Cached 10 min.
 */
async function fetchRemoteZipBlob(remoteId) {
  // Check cache
  var cached = _remoteZipCache[remoteId];
  if (cached && (Date.now() - cached.ts) < 10 * 60 * 1000) {
    return cached.zip;
  }

  var config = REMOTE_DOC_MAP[remoteId];
  if (!config) throw new Error('Okänd dokumenttyp');

  var url = REMOTE_DOC_WORKER + config.endpoint;
  var resp = await fetch(url, {
    headers: { 'X-API-Key': REMOTE_DOC_API_KEY }
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);

  var blob = await resp.blob();
  var zip = await JSZip.loadAsync(blob);
  _remoteZipCache[remoteId] = { zip: zip, ts: Date.now() };
  return zip;
}

/**
 * Parse metadata for a ZIP PDF file.
 * Extracts title, date range from filename and/or ta_data.json entry.
 */
function parseZipFileMeta(filename, meta) {
  var result = {
    title: filename.replace(/\.pdf$/i, ''),
    dateFrom: null,
    dateTo: null,
    period: null,
    week: (meta && meta.week) || null,
    taNumber: (meta && meta.taNumber) || null
  };

  // Try to extract date range from filename: "2026.02.03-2026.02.05 ..." or "V2608 TA 670.pdf"
  var dateMatch = filename.match(/^(\d{4}\.\d{2}\.\d{2})\s*-\s*(\d{4}\.\d{2}\.\d{2})\s+(.+)\.pdf$/i);
  if (dateMatch) {
    result.dateFrom = dateMatch[1].replace(/\./g, '-');  // "2026-02-03"
    result.dateTo = dateMatch[2].replace(/\./g, '-');
    result.title = dateMatch[3].trim();
  }

  // If meta has period, use it (format: "16.02.2026 - 20.02.2026")
  if (meta && meta.period) {
    var periodMatch = meta.period.match(/(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{2})\.(\d{2})\.(\d{4})/);
    if (periodMatch) {
      result.dateFrom = periodMatch[3] + '-' + periodMatch[2] + '-' + periodMatch[1];
      result.dateTo = periodMatch[6] + '-' + periodMatch[5] + '-' + periodMatch[4];
    }
    result.period = meta.period;
  }

  // For TA Danmark files like "V2608 TA 670.pdf" — build nicer title
  if (!dateMatch && meta && meta.taNumber) {
    result.title = 'TA ' + meta.taNumber;
  }

  return result;
}

/**
 * Format a date range for display: "3 feb – 5 feb" or "3 – 5 feb" if same month.
 */
function formatDateRange(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return '';
  var months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun',
                'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var f = new Date(dateFrom);
  var t = new Date(dateTo);
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return '';

  var fDay = f.getDate();
  var tDay = t.getDate();
  var fMon = months[f.getMonth()];
  var tMon = months[t.getMonth()];

  if (fMon === tMon) {
    return fDay + ' – ' + tDay + ' ' + tMon;
  }
  return fDay + ' ' + fMon + ' – ' + tDay + ' ' + tMon;
}

/**
 * Check if today falls within a date range.
 */
function isDateRangeActive(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return false;
  var now = new Date();
  var today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
  return today >= dateFrom && today <= dateTo;
}

/**
 * Render the document list from /parsed JSON data.
 */
function renderDocList(items) {
  var zipList = document.getElementById('docZipList');
  if (!zipList) return;

  if (!items || items.length === 0) {
    zipList.innerHTML = '<div class="doc-zip-loading">Inga dokument hittades</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < items.length; i++) {
    var f = items[i];
    var active = isDateRangeActive(f._dateFrom, f._dateTo);
    var dateRange = formatDateRange(f._dateFrom, f._dateTo);

    // Build subtitle line
    var subtitle = '';
    if (dateRange) subtitle = dateRange;
    if (f._week) subtitle += (subtitle ? '  ·  ' : '') + f._week;

    // Show train numbers if available
    if (f.trainNumbers && f.trainNumbers.length > 0) {
      var trainStr = f.trainNumbers.slice(0, 5).join(', ');
      if (f.trainNumbers.length > 5) trainStr += ' …';
      subtitle += (subtitle ? '  ·  ' : '') + trainStr;
    }

    // Badge (right side)
    var badge = '';
    if (f._week) badge = f._week;
    else if (f._taNumber) badge = 'TA ' + f._taNumber;

    html +=
      '<div class="doc-zip-item' + (active ? ' doc-zip-item-active' : '') + '" data-zip-idx="' + i + '">' +
        '<span class="doc-zip-item-icon">' + (active ? '🟢' : '📄') + '</span>' +
        '<div class="doc-zip-item-info">' +
          '<span class="doc-zip-item-name">' + f._title + '</span>' +
          (subtitle ? '<span class="doc-zip-item-size">' + subtitle + '</span>' : '') +
        '</div>' +
        (badge ? '<span class="doc-zip-item-badge">' + badge + '</span>' : '') +
        '<span class="doc-zip-item-arrow">›</span>' +
      '</div>';
  }
  zipList.innerHTML = html;

  // Click handlers — lazy-load ZIP and open PDF
  var itemEls = zipList.querySelectorAll('.doc-zip-item');
  for (var j = 0; j < itemEls.length; j++) {
    (function(item) {
      item.addEventListener('click', function() {
        var idx = parseInt(item.getAttribute('data-zip-idx'), 10);
        openRemotePdf(idx);
      });
    })(itemEls[j]);
  }
}

/**
 * Open a PDF by fetching the ZIP lazily and extracting the right file.
 */
function openRemotePdf(fileIdx) {
  if (!_remoteZipActiveId) return;
  var cached = _remoteListCache[_remoteZipActiveId];
  if (!cached || !cached.items[fileIdx]) return;

  var item = cached.items[fileIdx];
  var filename = item.filename;
  _docNavDepth = 'pdf';

  // Hide ZIP list, show PDF viewer
  var zipView = document.getElementById('docZipView');
  var pdfView = document.getElementById('docPdfView');
  if (zipView) zipView.style.display = 'none';
  if (pdfView) pdfView.style.display = '';

  // Reset PDF state
  _docCurrentId = 'zip_' + _remoteZipActiveId + '_' + fileIdx;
  _docPdfLoaded = false;
  _docPdfDoc = null;
  _docTextExtracted = false;
  _docTextCache = [];
  _docPageCanvases = [];
  clearDocHighlights();

  // No TOC for remote PDFs
  var tocPanel = document.getElementById('docTocPanel');
  var tocBtn = document.getElementById('docTocBtn');
  if (tocPanel) tocPanel.style.display = 'none';
  if (tocBtn) { tocBtn.style.display = 'none'; tocBtn.classList.remove('doc-toc-btn-active'); }

  // Reset search
  var searchPanel = document.getElementById('docSearchPanel');
  var searchBtn = document.getElementById('docSearchBtn');
  var searchInput = document.getElementById('docSearchInput');
  if (searchPanel) searchPanel.style.display = 'none';
  if (searchBtn) searchBtn.classList.remove('doc-search-btn-active');
  if (searchInput) searchInput.value = '';
  clearDocSearchResults();

  // Show loading in PDF viewer
  var pagesContainer = document.getElementById('docPdfPages');
  if (pagesContainer) {
    pagesContainer.innerHTML =
      '<div class="doc-loading">' +
        '<div class="doc-zip-spinner"></div>' +
        '<div>Hämtar PDF…</div>' +
      '</div>';
  }

  // Fetch ZIP (cached) → extract PDF → display
  var remoteId = _remoteZipActiveId;
  fetchRemoteZipBlob(remoteId).then(function(zip) {
    // Find the PDF file in the ZIP
    var pdfFile = zip.file(filename);
    if (!pdfFile) {
      // Try without path prefix
      zip.forEach(function(path, entry) {
        if (!entry.dir && path.split('/').pop() === filename) {
          pdfFile = entry;
        }
      });
    }
    if (!pdfFile) throw new Error('PDF hittades inte i arkivet');
    return pdfFile.async('blob');
  }).then(function(blob) {
    var blobUrl = URL.createObjectURL(blob);
    loadDocPdf(blobUrl);
  }).catch(function(err) {
    if (pagesContainer) {
      pagesContainer.innerHTML =
        '<div class="doc-loading doc-error">' +
          'Kunde inte ladda PDF: ' + (err.message || 'okänt fel') +
        '</div>';
    }
  });
}

// =============================================
// DOCUMENT REGISTRY
// =============================================
var DOC_REGISTRY = {
  kollektivavtal: {
    url: 'docs/Kollektivavtal.pdf',
    toc: DOC_KOLLEKTIVAVTAL_TOC
  },
  k26tko: {
    url: 'docs/K26-TKO.pdf',
    toc: null
  },
  sr263: {
    url: 'docs/SR-26-3.pdf',
    toc: DOC_SR263_TOC
  }
};

var _docCurrentId = null;

// =============================================
// OPEN PDF
// =============================================
function openDocPdf(docId) {
  var listView = document.getElementById('docListView');
  var pdfView = document.getElementById('docPdfView');
  var zipView = document.getElementById('docZipView');
  if (listView) listView.style.display = 'none';
  if (zipView) zipView.style.display = 'none';
  if (pdfView) pdfView.style.display = '';
  // Clear remote zip context when opening local PDF
  _remoteZipActiveId = null;

  var doc = DOC_REGISTRY[docId];
  if (!doc) return;

  // If switching document or first load
  if (_docCurrentId !== docId) {
    _docCurrentId = docId;
    _docPdfLoaded = false;
    _docPdfDoc = null;
    _docTextExtracted = false;
    _docTextCache = [];
    _docPageCanvases = [];
    clearDocHighlights();

    // Update TOC
    var tocPanel = document.getElementById('docTocPanel');
    var tocBtn = document.getElementById('docTocBtn');
    if (doc.toc) {
      buildTocPanel(doc.toc);
      if (tocBtn) tocBtn.style.display = '';
    } else {
      if (tocPanel) tocPanel.style.display = 'none';
      if (tocBtn) { tocBtn.style.display = 'none'; tocBtn.classList.remove('doc-toc-btn-active'); }
    }

    // Reset search
    var searchPanel = document.getElementById('docSearchPanel');
    var searchBtn = document.getElementById('docSearchBtn');
    var searchInput = document.getElementById('docSearchInput');
    if (searchPanel) searchPanel.style.display = 'none';
    if (searchBtn) searchBtn.classList.remove('doc-search-btn-active');
    if (searchInput) searchInput.value = '';
    clearDocSearchResults();

    loadDocPdf(doc.url);
  }
}

// =============================================
// LOAD & RENDER PDF
// =============================================
function loadDocPdf(url) {
  var pagesContainer = document.getElementById('docPdfPages');
  if (!pagesContainer) return;
  pagesContainer.innerHTML = '<div class="doc-loading">Laddar PDF…</div>';

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  pdfjsLib.getDocument(url).promise.then(function(pdf) {
    _docPdfDoc = pdf;
    _docPdfLoaded = true;
    renderDocPages();
  }).catch(function() {
    pagesContainer.innerHTML = '<div class="doc-loading doc-error">Kunde inte ladda PDF</div>';
  });
}

// Render (or re-render) all pages of the already-loaded PDF
function renderDocPages() {
  var pagesContainer = document.getElementById('docPdfPages');
  if (!pagesContainer || !_docPdfDoc) return;

  // Detect which page is currently visible before re-render
  var visiblePage = getVisibleDocPage();

  // Clear old canvases & highlights
  clearDocHighlights();
  pagesContainer.innerHTML = '';
  _docPageCanvases = [];

  var containerWidth = pagesContainer.clientWidth || 360;
  _docLastRenderWidth = containerWidth;
  var dpr = window.devicePixelRatio || 1;
  if (dpr < 2) dpr = 2; // minimum 2x for sharp text
  var pdf = _docPdfDoc;
  var renderQueue = [];
  for (var p = 1; p <= pdf.numPages; p++) {
    renderQueue.push(p);
  }

  function renderNext() {
    if (renderQueue.length === 0) {
      // All pages rendered — start text extraction for search
      if (!_docTextExtracted) extractAllText();
      // Restore scroll position
      if (visiblePage > 0) {
        setTimeout(function() { scrollToDocPage(visiblePage); }, 50);
      }
      return;
    }
    var pageNum = renderQueue.shift();
    pdf.getPage(pageNum).then(function(page) {
      var cssScale = containerWidth / page.getViewport({ scale: 1 }).width;
      var renderScale = cssScale * dpr;
      var viewport = page.getViewport({ scale: renderScale });

      var wrap = document.createElement('div');
      wrap.className = 'doc-page-wrap';
      wrap.setAttribute('data-page', pageNum);

      var canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = (viewport.width / dpr) + 'px';
      canvas.style.height = (viewport.height / dpr) + 'px';
      wrap.appendChild(canvas);
      pagesContainer.appendChild(wrap);

      _docPageCanvases.push({ pageNum: pageNum, wrap: wrap });

      var ctx = canvas.getContext('2d');
      page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
        // Setup pinch zoom if available (from la.js)
        if (typeof setupPinchZoom === 'function') {
          setupPinchZoom(wrap, canvas);
        }
        renderNext();
      });
    });
  }
  renderNext();
}

// Find which page is currently most visible in the scroll container
function getVisibleDocPage() {
  var pagesContainer = document.getElementById('docPdfPages');
  if (!pagesContainer || _docPageCanvases.length === 0) return 0;
  var containerTop = pagesContainer.scrollTop;
  var containerMid = containerTop + pagesContainer.clientHeight / 3;
  for (var i = 0; i < _docPageCanvases.length; i++) {
    var wrap = _docPageCanvases[i].wrap;
    var top = wrap.offsetTop;
    var bottom = top + wrap.offsetHeight;
    if (top <= containerMid && bottom > containerMid) {
      return _docPageCanvases[i].pageNum;
    }
  }
  return _docPageCanvases.length > 0 ? _docPageCanvases[0].pageNum : 0;
}

// =============================================
// RESIZE / ORIENTATION — re-render at new width
// =============================================
function onDocResize() {
  if (!_docPdfLoaded || !_docPdfDoc) return;
  // Only re-render if PDF view is visible
  var pdfView = document.getElementById('docPdfView');
  if (!pdfView || pdfView.style.display === 'none') return;

  var pagesContainer = document.getElementById('docPdfPages');
  if (!pagesContainer) return;
  var newWidth = pagesContainer.clientWidth || 360;

  // Only re-render if width changed significantly (> 30px)
  if (Math.abs(newWidth - _docLastRenderWidth) < 30) return;

  if (_docResizeTimer) clearTimeout(_docResizeTimer);
  _docResizeTimer = setTimeout(function() {
    renderDocPages();
  }, 300);
}

window.addEventListener('resize', onDocResize);

// =============================================
// SCROLL TO PAGE
// =============================================
function scrollToDocPage(pageNum) {
  for (var i = 0; i < _docPageCanvases.length; i++) {
    if (_docPageCanvases[i].pageNum === pageNum) {
      var wrap = _docPageCanvases[i].wrap;
      var pagesContainer = document.getElementById('docPdfPages');
      if (wrap && pagesContainer) {
        // Scroll within the pages container's parent (the doc-pdf-view)
        wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
  }
}

// =============================================
// SEARCH — Init
// =============================================
function initDocSearch() {
  var input = document.getElementById('docSearchInput');
  var clearBtn = document.getElementById('docSearchClear');
  if (!input) return;

  input.addEventListener('input', function() {
    var query = input.value.trim();
    // Show/hide clear button
    if (clearBtn) clearBtn.hidden = query.length === 0;
    // Debounce search
    if (_docSearchTimer) clearTimeout(_docSearchTimer);
    if (query.length < 2) {
      clearDocSearchResults();
      return;
    }
    var statusEl = document.getElementById('docSearchStatus');
    if (statusEl) statusEl.textContent = 'Söker…';
    _docSearchTimer = setTimeout(function() {
      performDocSearch(query);
    }, 300);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      input.value = '';
      clearBtn.hidden = true;
      clearDocSearchResults();
      input.focus();
    });
  }
}

// =============================================
// SEARCH — Extract text from all pages
// =============================================
function extractAllText() {
  if (!_docPdfDoc || _docTextExtracted) return;
  _docTextExtracted = true;
  _docTextCache = [];

  var total = _docPdfDoc.numPages;
  var done = 0;

  function extractPage(num) {
    _docPdfDoc.getPage(num).then(function(page) {
      var vp = page.getViewport({ scale: 1 });
      page.getTextContent().then(function(textContent) {
        var fullText = '';
        for (var k = 0; k < textContent.items.length; k++) {
          fullText += textContent.items[k].str + ' ';
        }
        _docTextCache.push({
          pageNum: num,
          text: fullText,
          items: textContent.items,
          viewport: vp
        });
        done++;
        if (done < total) {
          extractPage(done + 1);
        } else {
          // Sort by page number
          _docTextCache.sort(function(a, b) { return a.pageNum - b.pageNum; });
        }
      });
    });
  }

  if (total > 0) extractPage(1);
}

// =============================================
// SEARCH — Perform search
// =============================================
function performDocSearch(query) {
  var resultsEl = document.getElementById('docSearchResults');
  var statusEl = document.getElementById('docSearchStatus');
  if (!resultsEl) return;

  // Clear old highlights
  clearDocHighlights();

  if (!_docTextExtracted || _docTextCache.length === 0) {
    if (statusEl) statusEl.textContent = 'Texten laddas, försök igen…';
    return;
  }

  var queryLower = query.toLowerCase();
  var matches = []; // [{pageNum, count, snippets}]
  var totalHits = 0;

  for (var i = 0; i < _docTextCache.length; i++) {
    var entry = _docTextCache[i];
    var textLower = entry.text.toLowerCase();
    var count = 0;
    var snippets = [];
    var pos = 0;

    while (true) {
      var idx = textLower.indexOf(queryLower, pos);
      if (idx === -1) break;
      count++;
      // Extract snippet (40 chars before, 60 chars after)
      var snippetStart = Math.max(0, idx - 40);
      var snippetEnd = Math.min(entry.text.length, idx + query.length + 60);
      var snippet = (snippetStart > 0 ? '…' : '') +
        entry.text.substring(snippetStart, snippetEnd) +
        (snippetEnd < entry.text.length ? '…' : '');
      snippets.push(snippet);
      pos = idx + 1;
    }

    if (count > 0) {
      matches.push({ pageNum: entry.pageNum, count: count, snippets: snippets });
      totalHits += count;
    }
  }

  // Update status
  if (statusEl) {
    if (totalHits === 0) {
      statusEl.textContent = 'Inga träffar';
    } else {
      statusEl.textContent = totalHits + ' träff' + (totalHits === 1 ? '' : 'ar') +
        ' på ' + matches.length + ' sid' + (matches.length === 1 ? 'a' : 'or');
    }
  }

  // Build results HTML
  if (totalHits === 0) {
    resultsEl.innerHTML = '<div class="doc-search-no-results">Inga träffar för "' +
      escapeHtml(query) + '"</div>';
    return;
  }

  var html = '';
  for (var m = 0; m < matches.length; m++) {
    var match = matches[m];
    // Show first snippet with highlighted query
    var snippetHtml = highlightInSnippet(match.snippets[0], query);

    html += '<div class="doc-search-result-item" data-page="' + match.pageNum +
      '" data-query="' + escapeHtml(query) + '">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div class="doc-search-result-page">Sida ' + match.pageNum + '</div>';
    html += '<div class="doc-search-result-snippet">' + snippetHtml + '</div>';
    html += '</div>';
    html += '<span class="doc-search-result-count">' + match.count + '</span>';
    html += '</div>';
  }
  resultsEl.innerHTML = html;

  // Click handlers on results
  resultsEl.addEventListener('click', handleSearchResultClick);
}

function handleSearchResultClick(e) {
  var item = e.target.closest('.doc-search-result-item');
  if (!item) return;
  var pageNum = parseInt(item.getAttribute('data-page'), 10);
  var query = item.getAttribute('data-query');
  if (!pageNum) return;

  // Close search panel
  var searchPanel = document.getElementById('docSearchPanel');
  var searchBtn = document.getElementById('docSearchBtn');
  if (searchPanel) searchPanel.style.display = 'none';
  if (searchBtn) searchBtn.classList.remove('doc-search-btn-active');

  // Scroll to page
  scrollToDocPage(pageNum);

  // Add highlights on that page
  if (query) {
    setTimeout(function() {
      highlightOnPage(pageNum, query);
    }, 400);
  }
}

// =============================================
// SEARCH — Highlight text on canvas page
// =============================================
function highlightOnPage(pageNum, query) {
  clearDocHighlights();

  // Find page data
  var pageData = null;
  for (var i = 0; i < _docTextCache.length; i++) {
    if (_docTextCache[i].pageNum === pageNum) {
      pageData = _docTextCache[i];
      break;
    }
  }
  if (!pageData) return;

  // Find page wrap element
  var wrap = null;
  for (var w = 0; w < _docPageCanvases.length; w++) {
    if (_docPageCanvases[w].pageNum === pageNum) {
      wrap = _docPageCanvases[w].wrap;
      break;
    }
  }
  if (!wrap) return;

  var canvas = wrap.querySelector('canvas');
  if (!canvas) return;

  // Create highlight layer — same size as canvas, follows zoom transform
  var layer = document.createElement('div');
  layer.className = 'doc-highlight-layer';
  layer.style.width = canvas.style.width;
  layer.style.height = canvas.style.height;
  // Copy current canvas transform so highlights match zoom state
  if (canvas.style.transform) {
    layer.style.transform = canvas.style.transform;
  }
  wrap.appendChild(layer);
  _docCurrentHighlights.push(layer);

  var queryLower = query.toLowerCase();
  var scaleX = canvas.clientWidth / pageData.viewport.width;
  var scaleY = canvas.clientHeight / pageData.viewport.height;
  var items = pageData.items;
  var vpHeight = pageData.viewport.height;

  for (var t = 0; t < items.length; t++) {
    var textItem = items[t];
    if (!textItem.str || textItem.str.toLowerCase().indexOf(queryLower) === -1) continue;
    if (!textItem.transform) continue;

    // pdf.js text item transform: [scaleX, skewX, skewY, scaleY, x, y]
    var tx = textItem.transform[4];
    var ty = textItem.transform[5];
    var itemWidth = textItem.width || 0;
    var itemHeight = textItem.height || (Math.abs(textItem.transform[3]) || 12);

    // Convert PDF coordinates (bottom-left origin) to CSS (top-left origin)
    var cssLeft = tx * scaleX;
    var cssTop = (vpHeight - ty - itemHeight) * scaleY;
    var cssWidth = itemWidth * scaleX;
    var cssHeight = itemHeight * scaleY;

    var overlay = document.createElement('div');
    overlay.className = 'doc-highlight-overlay';
    overlay.style.left = cssLeft + 'px';
    overlay.style.top = cssTop + 'px';
    overlay.style.width = Math.max(cssWidth, 20) + 'px';
    overlay.style.height = Math.max(cssHeight, 10) + 'px';
    layer.appendChild(overlay);
  }
}

// =============================================
// SEARCH — Clear results & highlights
// =============================================
function clearDocSearchResults() {
  var resultsEl = document.getElementById('docSearchResults');
  var statusEl = document.getElementById('docSearchStatus');
  if (resultsEl) {
    resultsEl.innerHTML = '';
    resultsEl.removeEventListener('click', handleSearchResultClick);
  }
  if (statusEl) statusEl.textContent = '';
  clearDocHighlights();
}

function clearDocHighlights() {
  for (var i = 0; i < _docCurrentHighlights.length; i++) {
    var el = _docCurrentHighlights[i];
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  _docCurrentHighlights = [];
}

// =============================================
// SEARCH — Helpers
// =============================================
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlightInSnippet(snippet, query) {
  var escaped = escapeHtml(snippet);
  var queryEscaped = escapeHtml(query);
  // Case-insensitive replace with <mark>
  var regex = new RegExp('(' + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return escaped.replace(regex, '<mark>$1</mark>');
}
