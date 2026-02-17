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
    loadDocPdf('docs/Kollektivavtal.pdf');
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
    var dpr = window.devicePixelRatio || 1;
    if (dpr < 2) dpr = 2; // minimum 2x for sharp text
    var renderQueue = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      renderQueue.push(p);
    }

    function renderNext() {
      if (renderQueue.length === 0) {
        // All pages rendered — start text extraction for search
        if (!_docTextExtracted) extractAllText();
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
