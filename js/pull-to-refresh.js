/**
 * pull-to-refresh.js
 * Handles pull-to-refresh gesture on mobile devices
 * Fetches all updated data when user pulls down
 */

let ptr_touchStartY = 0;
let ptr_isRefreshing = false;
let ptr_scrollStarted = false;

// Store references to all fetch functions
const ptr_fetchFunctions = [];

/**
 * Initialize pull-to-refresh functionality
 */
function initPullToRefresh() {
  console.log('[PTR] Initializing pull-to-refresh...');

  // Register fetch functions (positions excluded — handles its own refresh)
  if (typeof fetchAllData === 'function') {
    registerPullToRefreshFetcher('firebase', () => fetchAllData('ptr'));
    console.log('[PTR] Registered: fetchAllData');
  } else {
    console.warn('[PTR] fetchAllData not found');
  }

  console.log('[PTR] Registered', ptr_fetchFunctions.length, 'fetch functions');

  // Touch events
  document.addEventListener('touchstart', ptr_handleTouchStart, false);
  document.addEventListener('touchmove', ptr_handleTouchMove, false);
  document.addEventListener('touchend', ptr_handleTouchEnd, false);

  console.log('[PTR] Pull-to-refresh initialized successfully ✓');
}

/**
 * Register a fetch function to be called on pull-to-refresh
 */
function registerPullToRefreshFetcher(name, fetchFunc) {
  ptr_fetchFunctions.push({ name, func: fetchFunc });
}

/**
 * Handle touch start
 */
function ptr_handleTouchStart(e) {
  if (ptr_isRefreshing) return;
  if (window._ptrDisabled) return;

  // Only trigger from top of page
  if (window.scrollY === 0) {
    ptr_touchStartY = e.touches[0].clientY;
    ptr_scrollStarted = false;
  }
}

/**
 * Handle touch move
 */
function ptr_handleTouchMove(e) {
  if (window._ptrDisabled) return;
  if (ptr_isRefreshing || window.scrollY !== 0) {
    ptr_scrollStarted = true;
    return;
  }

  if (ptr_touchStartY === 0) return;

  const currentY = e.touches[0].clientY;
  const diff = currentY - ptr_touchStartY;

  // Only handle downward drag from top
  if (diff > 0 && !ptr_scrollStarted) {
    e.preventDefault(); // Prevent default scroll
  }
}

/**
 * Handle touch end - trigger refresh if pulled enough
 */
function ptr_handleTouchEnd(e) {
  if (window._ptrDisabled) { ptr_touchStartY = 0; return; }
  if (ptr_isRefreshing || ptr_scrollStarted) {
    ptr_touchStartY = 0;
    return;
  }

  const currentY = e.changedTouches ? e.changedTouches[0].clientY : 0;
  const pullDistance = currentY - ptr_touchStartY;

  console.log('[PTR] Touch end - pullDistance:', pullDistance, 'scrollY:', window.scrollY);

  // Require at least 100px pull to refresh
  if (pullDistance > 100) {
    console.log('[PTR] Pull detected! Triggering refresh...');
    ptr_executeRefresh();
  } else if (pullDistance > 0) {
    console.log('[PTR] Pulled', pullDistance, 'px - need 100px to refresh');
  }

  ptr_touchStartY = 0;
}

/**
 * Execute the refresh - fetch all data
 */
async function ptr_executeRefresh() {
  if (ptr_isRefreshing) return;

  ptr_isRefreshing = true;
  const indicator = document.getElementById('pullToRefreshIndicator');
  const ptrText = document.getElementById('ptrText');

  // Show indicator
  if (indicator) {
    indicator.classList.remove('completed');
    indicator.classList.add('active');
    ptrText.textContent = 'Uppdaterar data...';
  }

  try {
    // Fetch all data in parallel
    const promises = ptr_fetchFunctions.map(fetcher => {
      return Promise.resolve()
        .then(() => {
          if (typeof fetcher.func === 'function') {
            return fetcher.func();
          }
        })
        .catch(err => {
          console.warn(`[PTR] Error fetching ${fetcher.name}:`, err);
        });
    });

    // Wait for all fetches to complete
    await Promise.all(promises);

    // Show success state
    if (indicator) {
      const spinner = indicator.querySelector('.ptr-spinner');
      if (spinner) {
        spinner.textContent = '✓';
      }
      indicator.classList.add('completed');
      ptrText.textContent = 'Uppdaterad ✓';

      // Hide after 1.5 seconds
      setTimeout(() => {
        indicator.classList.remove('active', 'completed');
        spinner.textContent = '';
        ptr_isRefreshing = false;
      }, 1500);
    }

    console.log('[PTR] Refresh completed');
  } catch (error) {
    console.error('[PTR] Refresh failed:', error);
    if (indicator) {
      ptrText.textContent = 'Uppdatering misslyckades';
      setTimeout(() => {
        indicator.classList.remove('active');
        ptr_isRefreshing = false;
      }, 2000);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPullToRefresh);
} else {
  initPullToRefresh();
}
