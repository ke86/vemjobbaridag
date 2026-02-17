/**
 * documents.js – Dokument-sida med PDF-visare och klickbar innehållsförteckning
 * Relies on: pdf.js (CDN), setupPinchZoom from la.js
 */

/* global pdfjsLib, setupPinchZoom */

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
// STATE
// =============================================
var _docPdfLoaded = false;
var _docPdfDoc = null;
var _docPageCanvases = [];

// =============================================
// PAGE SHOW / HIDE
// =============================================
function onDocumentsPageShow() {
  // Reset to list view when entering page
  var listView = document.getElementById('docListView');
  var pdfView = document.getElementById('docPdfView');
  if (listView) listView.style.display = '';
  if (pdfView) pdfView.style.display = 'none';
}

// =============================================
// INIT
// =============================================
function initDocuments() {
  // Card click → open PDF
  var card = document.querySelector('.doc-card[data-doc="kollektivavtal"]');
  if (card) {
    card.addEventListener('click', function() {
      openDocPdf('kollektivavtal');
    });
  }

  // Back button
  var backBtn = document.getElementById('docBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      var listView = document.getElementById('docListView');
      var pdfView = document.getElementById('docPdfView');
      if (listView) listView.style.display = '';
      if (pdfView) pdfView.style.display = 'none';
    });
  }

  // TOC toggle button
  var tocBtn = document.getElementById('docTocBtn');
  if (tocBtn) {
    tocBtn.addEventListener('click', function() {
      var panel = document.getElementById('docTocPanel');
      if (!panel) return;
      var isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'block';
      tocBtn.classList.toggle('doc-toc-btn-active', !isOpen);
    });
  }

  // Build TOC HTML
  buildTocPanel(DOC_KOLLEKTIVAVTAL_TOC);
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
// OPEN PDF
// =============================================
function openDocPdf(docId) {
  var listView = document.getElementById('docListView');
  var pdfView = document.getElementById('docPdfView');
  if (listView) listView.style.display = 'none';
  if (pdfView) pdfView.style.display = '';

  if (docId === 'kollektivavtal' && !_docPdfLoaded) {
    loadDocPdf('mnt/Kollektivavtal.pdf');
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
    pagesContainer.innerHTML = '';
    _docPageCanvases = [];

    var containerWidth = pagesContainer.clientWidth || 360;
    var renderQueue = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      renderQueue.push(p);
    }

    function renderNext() {
      if (renderQueue.length === 0) return;
      var pageNum = renderQueue.shift();
      pdf.getPage(pageNum).then(function(page) {
        var scale = containerWidth / page.getViewport({ scale: 1 }).width;
        var viewport = page.getViewport({ scale: scale });

        var wrap = document.createElement('div');
        wrap.className = 'doc-page-wrap';
        wrap.setAttribute('data-page', pageNum);

        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
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
  }).catch(function() {
    pagesContainer.innerHTML = '<div class="doc-loading doc-error">Kunde inte ladda PDF</div>';
  });
}

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
