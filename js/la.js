/**
 * la.js — Dagens LA (Banedanmark PDF viewer)
 * Fetches and renders LA PDFs for Sträcka 10 & 11 via Cloudflare Worker proxy.
 * Supports offline caching via Cache API.
 */
(function() {
  'use strict';

  var LA_PROXY = 'https://banedk-la-proxy.kenny-eriksson1986.workers.dev';
  var LA_CACHE_NAME = 'vemjobbar-la-pdfs';

  var ROUTES = [
    { nr: '10', name: 'Sträcka 10', desc: 'København H – Helsingør' },
    { nr: '11', name: 'Sträcka 11', desc: 'København H / Hvidovre Fjern – Peberholm' }
  ];

  // ── Helpers ────────────────────────────────────────────

  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + dd;
  }

  function tomorrowStr() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + dd;
  }

  function formatDateLabel(dateStr) {
    var parts = dateStr.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var days = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
    var months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
  }

  function pdfUrl(nr, date) {
    return LA_PROXY + '/?nr=' + nr + '&date=' + date;
  }

  // ── Cache API helpers ──────────────────────────────────

  function cacheGet(nr, date) {
    if (!('caches' in window)) return Promise.resolve(null);
    return caches.open(LA_CACHE_NAME).then(function(cache) {
      return cache.match(pdfUrl(nr, date));
    }).then(function(resp) {
      return resp || null;
    }).catch(function() {
      return null;
    });
  }

  function cachePut(nr, date, arrayBuffer) {
    if (!('caches' in window)) return Promise.resolve();
    var resp = new Response(arrayBuffer, {
      headers: { 'Content-Type': 'application/pdf' }
    });
    return caches.open(LA_CACHE_NAME).then(function(cache) {
      return cache.put(pdfUrl(nr, date), resp);
    }).catch(function() {});
  }

  function cacheHas(nr, date) {
    if (!('caches' in window)) return Promise.resolve(false);
    return caches.open(LA_CACHE_NAME).then(function(cache) {
      return cache.match(pdfUrl(nr, date));
    }).then(function(resp) {
      return !!resp;
    }).catch(function() {
      return false;
    });
  }

  /** Remove old cached PDFs that don't match today or tomorrow */
  function cacheCleanup() {
    if (!('caches' in window)) return;
    var today = todayStr();
    var tomorrow = tomorrowStr();
    var keepUrls = {};
    for (var i = 0; i < ROUTES.length; i++) {
      keepUrls[pdfUrl(ROUTES[i].nr, today)] = true;
      keepUrls[pdfUrl(ROUTES[i].nr, tomorrow)] = true;
    }
    caches.open(LA_CACHE_NAME).then(function(cache) {
      return cache.keys().then(function(requests) {
        requests.forEach(function(req) {
          if (!keepUrls[req.url]) {
            cache.delete(req);
          }
        });
      });
    }).catch(function() {});
  }

  // ── View toggling ──────────────────────────────────────

  function showCards() {
    var cards = document.getElementById('laCards');
    var pdfView = document.getElementById('laPdfView');
    if (cards) cards.style.display = '';
    if (pdfView) { pdfView.style.display = 'none'; pdfView.innerHTML = ''; }
  }

  function showPdfView() {
    var cards = document.getElementById('laCards');
    var pdfView = document.getElementById('laPdfView');
    if (cards) cards.style.display = 'none';
    if (pdfView) pdfView.style.display = '';
  }

  // ── Build card list ────────────────────────────────────

  function buildCards() {
    var container = document.getElementById('laCards');
    if (!container) return;

    var today = todayStr();
    var tomorrow = tomorrowStr();

    // Clean up old cached PDFs
    cacheCleanup();

    // Check cache status for all cards, then render
    var checks = [];
    for (var i = 0; i < ROUTES.length; i++) {
      checks.push(cacheHas(ROUTES[i].nr, today));
    }
    for (var j = 0; j < ROUTES.length; j++) {
      checks.push(cacheHas(ROUTES[j].nr, tomorrow));
    }

    Promise.all(checks).then(function(results) {
      var html = '';
      var idx = 0;

      // Today group
      html += '<div class="la-date-group">';
      html += '<div class="la-date-label">Idag — ' + formatDateLabel(today) + '</div>';
      for (var a = 0; a < ROUTES.length; a++) {
        html += buildCard(ROUTES[a], today, results[idx]);
        idx++;
      }
      html += '</div>';

      // Tomorrow group
      html += '<div class="la-date-group">';
      html += '<div class="la-date-label">Imorgon — ' + formatDateLabel(tomorrow) + '</div>';
      for (var b = 0; b < ROUTES.length; b++) {
        html += buildCard(ROUTES[b], tomorrow, results[idx]);
        idx++;
      }
      html += '</div>';

      container.innerHTML = html;
    });
  }

  function buildCard(route, date, isCached) {
    var badge = isCached
      ? '<span class="la-badge la-badge-cached">✓ Sparad</span>'
      : '<span class="la-badge la-badge-ok">PDF</span>';

    return '<div class="la-card" data-nr="' + route.nr + '" data-date="' + date + '" onclick="window._laOpen(\'' + route.nr + '\',\'' + date + '\',\'' + route.name + '\')">'
      + '<div class="la-card-icon">📄</div>'
      + '<div class="la-card-info">'
      + '<div class="la-card-title">' + route.name + ' ' + badge + '</div>'
      + '<div class="la-card-sub">' + route.desc + '</div>'
      + '</div>'
      + '<div class="la-card-arrow">›</div>'
      + '</div>';
  }

  // ── Fetch PDF (cache-first, then network) ──────────────

  function networkFetch(nr, date) {
    return fetch(pdfUrl(nr, date)).then(function(resp) {
      if (!resp.ok) {
        if (resp.status === 404 || resp.status === 500) {
          throw new Error('NOT_PUBLISHED');
        }
        throw new Error('HTTP ' + resp.status);
      }
      return resp.arrayBuffer();
    }).then(function(buf) {
      cachePut(nr, date, buf.slice(0));
      return { buffer: buf, source: 'network' };
    });
  }

  function fetchPdf(nr, date) {
    if (!('caches' in window)) {
      return networkFetch(nr, date);
    }

    // 1. Try cache first
    return caches.open(LA_CACHE_NAME).then(function(cache) {
      return cache.match(pdfUrl(nr, date));
    }).then(function(cachedResp) {
      if (cachedResp) {
        return cachedResp.clone().arrayBuffer().then(function(buf) {
          return { buffer: buf, source: 'cache' };
        });
      }
      // 2. Not in cache — try network
      return networkFetch(nr, date);
    }).catch(function(err) {
      // Cache failed — if offline this is the end
      if (err.message === 'NOT_PUBLISHED') throw err;
      if (!navigator.onLine) {
        throw new Error('OFFLINE');
      }
      // Cache error but online — try network directly
      return networkFetch(nr, date);
    });
  }

  // ── Open PDF viewer ────────────────────────────────────

  function backBtnHtml(label) {
    return '<button class="la-float-back" onclick="window._laClose()">← ' + label + '</button>';
  }

  window._laOpen = function(nr, date, name) {
    var pdfView = document.getElementById('laPdfView');
    if (!pdfView) return;

    var label = name + ' — ' + formatDateLabel(date);

    // Switch to PDF view
    pdfView.innerHTML = backBtnHtml(label)
      + '<div class="la-viewer-loading">'
      + '<div class="la-card-loading"></div>'
      + '<span>Hämtar PDF…</span>'
      + '</div>';
    showPdfView();

    fetchPdf(nr, date)
      .then(function(result) {
        renderPdf(result.buffer, pdfView, label);
        // Update cards to reflect new cache status
        if (result.source === 'network') {
          updateCardBadge(nr, date);
        }
      })
      .catch(function(err) {
        var errorHtml;
        if (err.message === 'NOT_PUBLISHED') {
          errorHtml = '<div class="la-viewer-error">'
            + '<div class="la-viewer-error-icon">📭</div>'
            + '<div class="la-viewer-error-text">Denna LA är inte<br>publicerad ännu.</div>'
            + '</div>';
        } else if (err.message === 'OFFLINE' || !navigator.onLine) {
          errorHtml = '<div class="la-viewer-error">'
            + '<div class="la-viewer-error-icon">📴</div>'
            + '<div class="la-viewer-error-text">Du är offline.<br>Denna PDF är inte sparad.</div>'
            + '</div>';
        } else {
          errorHtml = '<div class="la-viewer-error">'
            + '<div class="la-viewer-error-icon">⚠️</div>'
            + '<div class="la-viewer-error-text">Kunde inte hämta PDF.<br>'
            + err.message + '</div>'
            + '</div>';
        }
        pdfView.innerHTML = backBtnHtml(label) + errorHtml;
      });
  };

  /** Update a specific card's badge to "Sparad" after caching */
  function updateCardBadge(nr, date) {
    var cards = document.querySelectorAll('.la-card[data-nr="' + nr + '"][data-date="' + date + '"]');
    for (var i = 0; i < cards.length; i++) {
      var badge = cards[i].querySelector('.la-badge');
      if (badge) {
        badge.className = 'la-badge la-badge-cached';
        badge.textContent = '✓ Sparad';
      }
    }
  }

  // ── Render PDF pages to canvases ───────────────────────

  function renderPdf(buffer, container, label) {
    var loadingTask = pdfjsLib.getDocument({
      data: buffer,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true
    });

    loadingTask.promise.then(function(pdf) {
      container.innerHTML = backBtnHtml(label || '');
      var scale = 2; // render at 2x for sharpness

      for (var p = 1; p <= pdf.numPages; p++) {
        (function(pageNum) {
          pdf.getPage(pageNum).then(function(page) {
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.order = pageNum; // keep order even if async
            container.appendChild(canvas);

            var ctx = canvas.getContext('2d');
            page.render({ canvasContext: ctx, viewport: viewport });
          });
        })(p);
      }
    }).catch(function(err) {
      container.innerHTML = backBtnHtml(label || '')
        + '<div class="la-viewer-error">'
        + '<div class="la-viewer-error-icon">⚠️</div>'
        + '<div class="la-viewer-error-text">Kunde inte läsa PDF.<br>'
        + err.message + '</div>'
        + '</div>';
    });
  }

  /**
   * Render a single page from a PDF buffer into a container.
   * pageNum is 1-based. Container is cleared before rendering.
   */
  function renderPdfPage(buffer, container, pageNum) {
    var loadingTask = pdfjsLib.getDocument({
      data: buffer,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true
    });

    loadingTask.promise.then(function(pdf) {
      if (pageNum < 1 || pageNum > pdf.numPages) {
        container.innerHTML =
          '<div class="la-viewer-error">'
          + '<div class="la-viewer-error-icon">⚠️</div>'
          + '<div class="la-viewer-error-text">Sida ' + pageNum + ' finns inte (PDF har ' + pdf.numPages + ' sidor).</div>'
          + '</div>';
        return;
      }
      container.innerHTML = '';
      var scale = 2;
      pdf.getPage(pageNum).then(function(page) {
        var viewport = page.getViewport({ scale: scale });
        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        page.render({ canvasContext: ctx, viewport: viewport });
      });
    }).catch(function(err) {
      container.innerHTML =
        '<div class="la-viewer-error">'
        + '<div class="la-viewer-error-icon">⚠️</div>'
        + '<div class="la-viewer-error-text">Kunde inte läsa PDF.<br>' + err.message + '</div>'
        + '</div>';
    });
  }

  // ── Close PDF view (back to cards) ─────────────────────

  window._laClose = function() {
    showCards();
    buildCards(); // refresh badges
  };

  // ── Page show/hide hooks ───────────────────────────────

  window.onLaPageShow = function() {
    showCards();
    buildCards();
  };

  window.onLaPageHide = function() {
    showCards(); // reset to cards view
  };

  // Export for reuse by train-follow LA tab
  window.laApi = {
    fetchPdf: fetchPdf,
    renderPdf: function(buffer, container, label) {
      renderPdf(buffer, container, label);
    },
    renderPdfPage: function(buffer, container, pageNum) {
      renderPdfPage(buffer, container, pageNum);
    }
  };

})();
