/**
 * onevr-auth.js — Cloudflare Worker
 * Combined worker: auth, scrape triggers, docs storage, and positions API.
 *
 * Environment variables needed:
 *   FIREBASE_API_KEY       — Firebase Web API key
 *   FIREBASE_EMAIL         — Service account email for Firebase Auth
 *   FIREBASE_PASSWORD      — Service account password for Firebase Auth
 *   GITHUB_PAT            — GitHub Personal Access Token for triggering Actions
 *   SCRAPE_PIN            — PIN code for scrape trigger/status access
 *   POSITIONS_API_KEY     — API key for docs/positions endpoints (default: onevr-docs-2026)
 *
 * KV Namespace binding needed:
 *   DOCS_KV               — KV namespace for storing docs and positions data
 *
 * Deploy:
 *   wrangler deploy --name onevr-auth worker/onevr-auth.js
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight — allow all paths
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ── Auth (no API key) ──
    if (path === '/auth-token' && request.method === 'GET') {
      return handleAuthToken(env);
    }

    // ── Scrape trigger/status (PIN protected) ──
    if (path === '/trigger-scrape' && request.method === 'POST') {
      return handleTriggerScrape(request, env);
    }
    if (path === '/scrape-status' && request.method === 'GET') {
      return handleScrapeStatus(request, env);
    }

    // ── Positions (API key protected) ──
    if (path === '/positions' || path === '/positions/dates' || path === '/positions/disappeared' || path === '/positions/update-log') {
      if (!validateApiKey(request, env)) {
        return jsonResp({ error: 'Invalid API key' }, 401);
      }
      if (path === '/positions/dates' && request.method === 'GET') {
        return handleGetPositionDates(env);
      }
      if (path === '/positions/disappeared' && request.method === 'GET') {
        return handleGetDisappeared(env);
      }
      if (path === '/positions/update-log' && request.method === 'GET') {
        return handleGetUpdateLog(env);
      }
      if (request.method === 'GET') return handleGetPositions(env, url);
      if (request.method === 'PUT') return handlePutPositions(request, env);
    }

    // ── Docs (API key protected) ──
    if (path === '/docs' || path.startsWith('/docs/')) {
      if (!validateApiKey(request, env)) {
        return jsonResp({ error: 'Invalid API key' }, 401);
      }

      // GET /docs — list all docs metadata
      if (path === '/docs' && request.method === 'GET') {
        return handleListDocs(env);
      }

      // /docs/{category}/parsed
      const parsedMatch = path.match(/^\/docs\/([^/]+)\/parsed$/);
      if (parsedMatch) {
        const category = parsedMatch[1];
        if (request.method === 'GET') return handleGetDocParsed(env, category);
        if (request.method === 'PUT') return handlePutDocParsed(request, env, category);
      }

      // /docs/{category}
      const docMatch = path.match(/^\/docs\/([^/]+)$/);
      if (docMatch) {
        const category = docMatch[1];
        if (request.method === 'GET') return handleGetDoc(env, category);
        if (request.method === 'PUT') return handlePutDoc(request, env, category);
      }
    }

    return jsonResp({ error: 'Not found' }, 404);
  }
};

// =============================================
// API KEY VALIDATION
// =============================================
function validateApiKey(request, env) {
  const apiKey = request.headers.get('X-API-Key') || '';
  const expectedKey = env.POSITIONS_API_KEY || 'onevr-docs-2026';
  return apiKey === expectedKey;
}

// =============================================
// /auth-token — Firebase sign-in
// =============================================
async function handleAuthToken(env) {
  const apiKey = env.FIREBASE_API_KEY;
  const email = env.FIREBASE_EMAIL;
  const pass = env.FIREBASE_PASSWORD;

  if (!apiKey || !email || !pass) {
    return jsonResp({ error: 'Firebase credentials not configured in Worker env' }, 500);
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, returnSecureToken: true })
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return jsonResp({ error: err.error?.message || 'Firebase auth failed' }, 401);
    }

    const data = await res.json();
    return jsonResp({ idToken: data.idToken });
  } catch (err) {
    return jsonResp({ error: 'Auth request failed: ' + err.message }, 500);
  }
}

// =============================================
// /trigger-scrape — kick off GitHub Action
// =============================================
async function handleTriggerScrape(request, env) {
  const pin = request.headers.get('X-PIN') || '';
  if (pin !== env.SCRAPE_PIN) {
    return jsonResp({ error: 'Invalid PIN' }, 401);
  }

  const pat = env.GITHUB_PAT;
  if (!pat) {
    return jsonResp({ error: 'GitHub PAT not configured' }, 500);
  }

  try {
    const res = await fetch(
      'https://api.github.com/repos/ke86/snok/actions/workflows/daily-scrape.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': 'token ' + pat,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'onevr-auth-worker'
        },
        body: JSON.stringify({ ref: 'main' })
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return jsonResp({ error: 'GitHub API error: ' + res.status + ' ' + err }, res.status);
    }

    return jsonResp({ success: true, message: 'Workflow triggered' });
  } catch (err) {
    return jsonResp({ error: 'Request failed: ' + err.message }, 500);
  }
}

// =============================================
// /scrape-status — poll GitHub Actions runs
// =============================================
async function handleScrapeStatus(request, env) {
  const pin = request.headers.get('X-PIN') || '';
  if (pin !== env.SCRAPE_PIN) {
    return jsonResp({ error: 'Invalid PIN' }, 401);
  }

  const pat = env.GITHUB_PAT;
  if (!pat) {
    return jsonResp({ error: 'GitHub PAT not configured' }, 500);
  }

  try {
    const res = await fetch(
      'https://api.github.com/repos/ke86/snok/actions/workflows/daily-scrape.yml/runs?per_page=5',
      {
        headers: {
          'Authorization': 'token ' + pat,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'onevr-auth-worker'
        }
      }
    );

    if (!res.ok) {
      return jsonResp({ error: 'GitHub API error: ' + res.status }, res.status);
    }

    const data = await res.json();
    const runs = (data.workflow_runs || []).map(run => {
      const started = run.created_at ? new Date(run.created_at) : null;
      const now = new Date();
      return {
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        created_at: run.created_at,
        elapsed: started ? (now - started) / 1000 : null
      };
    });

    return jsonResp({ runs });
  } catch (err) {
    return jsonResp({ error: 'Request failed: ' + err.message }, 500);
  }
}

// =============================================
// /positions — GET (read) and PUT (upload)
// =============================================
async function handleGetPositions(env, url) {
  if (!env.DOCS_KV) {
    return jsonResp({ error: 'KV storage not configured' }, 500);
  }

  try {
    // Check for ?date=YYYY-MM-DD parameter for historical data
    const dateParam = url ? url.searchParams.get('date') : null;
    const key = dateParam ? 'positions:' + dateParam : 'positions';

    const data = await env.DOCS_KV.get(key, 'json');
    if (!data) {
      return jsonResp({ error: 'No positions data found' + (dateParam ? ' for ' + dateParam : '') }, 404);
    }
    return jsonResp(data);
  } catch (err) {
    return jsonResp({ error: 'Failed to read positions: ' + err.message }, 500);
  }
}

/** GET /positions/dates — list available historical dates */
async function handleGetPositionDates(env) {
  if (!env.DOCS_KV) {
    return jsonResp({ error: 'KV storage not configured' }, 500);
  }

  try {
    const dateList = await env.DOCS_KV.get('positions:_dates', 'json');
    return jsonResp({ dates: dateList || [] });
  } catch (err) {
    return jsonResp({ error: 'Failed to list dates: ' + err.message }, 500);
  }
}

const POSITIONS_HISTORY_DAYS = 30;

async function handlePutPositions(request, env) {
  if (!env.DOCS_KV) {
    return jsonResp({ error: 'KV storage not configured' }, 500);
  }

  try {
    const body = await request.json();
    const bodyStr = JSON.stringify(body);
    const today = new Date().toISOString().slice(0, 10);

    // Save current positions (latest)
    await env.DOCS_KV.put('positions', bodyStr);

    // Save date-specific copy for history
    await env.DOCS_KV.put('positions:' + today, bodyStr);

    // Update date index
    let dateList = (await env.DOCS_KV.get('positions:_dates', 'json')) || [];
    if (!dateList.includes(today)) {
      dateList.push(today);
      dateList.sort();
    }

    // Remove dates older than N days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - POSITIONS_HISTORY_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const expired = dateList.filter(d => d < cutoffStr);
    dateList = dateList.filter(d => d >= cutoffStr);

    // Delete expired KV entries (fire-and-forget)
    for (const old of expired) {
      env.DOCS_KV.delete('positions:' + old).catch(() => {});
    }

    // Save updated date index
    await env.DOCS_KV.put('positions:_dates', JSON.stringify(dateList));

    // Update metadata
    await updateDocMeta(env, '_positions', {
      category: '_positions',
      uploadedAt: new Date().toISOString(),
      size: bodyStr.length
    });

    // Compute disappeared persons/shifts (baseline comparison)
    await computeDisappeared(env, body);

    // Count total entries for log
    let totalEntries = 0;
    if (body.dagar) {
      for (const dk in body.dagar) {
        totalEntries += (body.dagar[dk] || []).length;
      }
    }

    // Append to update log
    await appendUpdateLog(env, {
      ts: Date.now(),
      status: 'ok',
      date: today,
      entries: totalEntries,
      days: Object.keys(body.dagar || {}).length
    });

    return jsonResp({ success: true, message: 'Positions data saved', date: today, historyDates: dateList.length });
  } catch (err) {
    return jsonResp({ error: 'Failed to save positions: ' + err.message }, 500);
  }
}

// =============================================
// /positions/disappeared — Baseline comparison
// =============================================

/** GET /positions/update-log — return last 10 update entries */
async function handleGetUpdateLog(env) {
  if (!env.DOCS_KV) {
    return jsonResp({ error: 'KV storage not configured' }, 500);
  }

  try {
    const log = await env.DOCS_KV.get('positions:_updateLog', 'json');
    return jsonResp({ entries: log || [] });
  } catch (err) {
    return jsonResp({ error: 'Failed to read update log: ' + err.message }, 500);
  }
}

/** Append an entry to the update log (max 10 entries) */
async function appendUpdateLog(env, entry) {
  try {
    let log = (await env.DOCS_KV.get('positions:_updateLog', 'json')) || [];
    log.unshift(entry); // newest first
    if (log.length > 10) log = log.slice(0, 10);
    await env.DOCS_KV.put('positions:_updateLog', JSON.stringify(log));
  } catch (err) {
    // Non-critical — don't fail the PUT request
    console.error('[WORKER] Failed to append update log:', err);
  }
}

/** GET /positions/disappeared — return stored comparison results */
async function handleGetDisappeared(env) {
  if (!env.DOCS_KV) {
    return jsonResp({ error: 'KV storage not configured' }, 500);
  }

  try {
    const result = await env.DOCS_KV.get('positions:_disappeared', 'json');
    if (!result) {
      return jsonResp({ ts: null, status: 'none', persons: [], shifts: [] });
    }
    return jsonResp(result);
  } catch (err) {
    return jsonResp({ error: 'Failed to read disappeared: ' + err.message }, 500);
  }
}

/**
 * Run baseline comparison after new positions data is saved.
 * Computes disappeared persons (⚠️) and disappeared shifts ($).
 * Stores results in KV: positions:_disappeared, positions:_baseline
 */
async function computeDisappeared(env, newData) {
  if (!newData || !newData.dagar) return;

  const BASELINE_MAX_GAP = 24 * 60 * 60 * 1000; // 24h
  const MAX_SHIFTS = 50;
  const MAX_PERSONS = 30;

  const today = new Date().toISOString().slice(0, 10);
  const newDagar = newData.dagar;

  // Validate: today must exist with ≥50 entries
  if (!newDagar[today] || newDagar[today].length < 50) {
    await env.DOCS_KV.put('positions:_disappeared', JSON.stringify({
      ts: Date.now(), status: 'invalid', persons: [], shifts: [],
      detail: 'Dagens data saknas eller har för få poster'
    }));
    return;
  }

  // Load existing baseline from KV
  let baseline = await env.DOCS_KV.get('positions:_baseline', 'json');

  // No baseline or too old → save current as first baseline
  if (!baseline || !baseline.dagar || !baseline.ts || (Date.now() - baseline.ts) > BASELINE_MAX_GAP) {
    await env.DOCS_KV.put('positions:_baseline', JSON.stringify({
      dagar: newDagar, ts: Date.now()
    }));
    await env.DOCS_KV.put('positions:_disappeared', JSON.stringify({
      ts: Date.now(), status: 'first', persons: [], shifts: []
    }));
    return;
  }

  const oldDagar = baseline.dagar;

  // Dates to check: today + next 6 days
  const checkDates = [];
  for (let d = 0; d < 7; d++) {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    checkDates.push(dt.toISOString().slice(0, 10));
  }

  // ── (1) Per-person schedule comparison ──
  const oldByPerson = {};
  const newByPerson = {};

  for (const dateStr of checkDates) {
    const oldDay = oldDagar[dateStr] || [];
    const newDay = newDagar[dateStr] || [];

    for (const op of oldDay) {
      if (!op.namn) continue;
      const key = op.namn.toLowerCase();
      if (!oldByPerson[key]) oldByPerson[key] = { namn: op.namn, anstNr: op.anstNr || '', dates: {} };
      oldByPerson[key].dates[dateStr] = op;
    }

    for (const np of newDay) {
      if (!np.namn) continue;
      newByPerson[np.namn.toLowerCase()] = true;
    }
  }

  const disappearedPersons = [];
  for (const personKey in oldByPerson) {
    const person = oldByPerson[personKey];
    const oldDates = Object.keys(person.dates);
    const existsInNew = !!newByPerson[personKey];
    const lostDates = [];

    for (const dd of oldDates) {
      const newDayForDate = newDagar[dd] || [];
      if (newDayForDate.length === 0) continue;

      let foundOnDate = false;
      for (const entry of newDayForDate) {
        if (entry.namn && entry.namn.toLowerCase() === personKey) {
          foundOnDate = true;
          break;
        }
      }
      if (!foundOnDate) lostDates.push(dd);
    }

    if (lostDates.length === 0) continue;

    if (existsInNew || oldDates.length >= 2) {
      lostDates.sort();
      const entries = lostDates.map(ld => {
        const e = person.dates[ld];
        return { date: ld, turnr: e.turnr || '', start: e.start || '', slut: e.slut || '', ort: e.ort || '' };
      });
      disappearedPersons.push({
        namn: person.namn, anstNr: person.anstNr,
        lostDates: entries, totalOld: oldDates.length, stillActive: existsInNew
      });
    }
  }

  disappearedPersons.sort((a, b) => b.lostDates.length - a.lostDates.length || a.namn.localeCompare(b.namn));

  // ── (2) Per-date shift comparison ──
  const disappearedShifts = [];

  for (const dateStr of checkDates) {
    const oldDay = oldDagar[dateStr] || [];
    const newDay = newDagar[dateStr] || [];
    if (oldDay.length === 0 || newDay.length === 0) continue;

    // Build lookup of new turns + person times
    const newTurnsNorm = {};
    const newPersonTimes = {};
    for (const nt of newDay) {
      const turnUpper = (nt.turnr || '').trim().toUpperCase();
      if (turnUpper) newTurnsNorm[_normTurn(nt.turnr)] = true;
      const nName = nt.namn ? nt.namn.toLowerCase() : null;
      if (nName) {
        newPersonTimes[nName] = {
          start: _timeToMin(nt.start),
          slut: _timeToMin(nt.slut)
        };
      }
    }

    const processedTurns = {};
    for (const p of oldDay) {
      if (!p.turnr || !p.namn) continue;
      const turnUpper = (p.turnr || '').toUpperCase().trim();
      if (!turnUpper || turnUpper === 'LEDIG' || turnUpper === '-') continue;

      // Exclusions
      const isReserve = turnUpper.startsWith('RESERV');
      const isGulvast = turnUpper.startsWith('GULVÄST') || turnUpper.startsWith('GULVAST');
      const isAdm = turnUpper === 'ADM';
      const rawClean = p.turnr.replace(/\s*-\s*TP$/i, '').trim();
      const isReserveFormat = /^\d{6}-\d{6}$/.test(rawClean);

      if (isReserve || isReserveFormat || isGulvast || isAdm) continue;

      const normKey = _normTurn(p.turnr);
      const dedupKey = dateStr + ':' + normKey;
      if (processedTurns[dedupKey]) continue;
      processedTurns[dedupKey] = true;

      if (!newTurnsNorm[normKey]) {
        // Check reassignment (same person, similar times ±1h)
        const pName = p.namn ? p.namn.toLowerCase() : null;
        let reassigned = false;

        if (pName && newPersonTimes[pName]) {
          const oldStartMin = _timeToMin(p.start);
          const oldSlutMin = _timeToMin(p.slut);
          const npt = newPersonTimes[pName];
          if (oldStartMin >= 0 && npt.start >= 0 && oldSlutMin >= 0 && npt.slut >= 0) {
            if (Math.abs(oldStartMin - npt.start) <= 60 && Math.abs(oldSlutMin - npt.slut) <= 60) {
              reassigned = true;
            }
          }
        }

        if (!reassigned) {
          const roll = (p.roll || '').toLowerCase();
          let rollLabel = '–';
          if (roll.includes('lokförare')) rollLabel = 'LF';
          else if (roll.includes('tågvärd')) rollLabel = 'TV';
          else if (roll.includes('trafik') || roll.includes('informationsledare')) rollLabel = 'TIL';

          disappearedShifts.push({
            date: dateStr, turnr: p.turnr,
            start: p.start || '', slut: p.slut || '',
            ort: p.ort || '', roll: rollLabel
          });
        }
      }
    }
  }

  disappearedShifts.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.start || '99:99').localeCompare(b.start || '99:99');
  });

  // Threshold check
  if (disappearedShifts.length > MAX_SHIFTS || disappearedPersons.length > MAX_PERSONS) {
    // Unreasonable — don't update baseline, save status
    await env.DOCS_KV.put('positions:_disappeared', JSON.stringify({
      ts: Date.now(), status: 'unreasonable',
      persons: [], shifts: [],
      detail: disappearedShifts.length + ' turer, ' + disappearedPersons.length + ' personer'
    }));
    return;
  }

  // Save results
  await env.DOCS_KV.put('positions:_disappeared', JSON.stringify({
    ts: Date.now(), status: 'ok',
    persons: disappearedPersons,
    shifts: disappearedShifts
  }));

  // Save merged baseline (new data + old entries still missing → dashboard mode)
  const mergedDagar = {};
  for (const dk in newDagar) {
    mergedDagar[dk] = newDagar[dk].slice ? newDagar[dk].slice() : [...newDagar[dk]];
  }
  for (const mDate of checkDates) {
    const mOld = oldDagar[mDate] || [];
    if (!mergedDagar[mDate]) mergedDagar[mDate] = [];

    const mExisting = {};
    for (const item of mergedDagar[mDate]) {
      const mName = item.namn ? item.namn.toLowerCase() : '';
      const mTurn = _normTurn(item.turnr);
      mExisting[mName + '|' + mTurn] = true;
    }

    for (const oldItem of mOld) {
      const oName = oldItem.namn ? oldItem.namn.toLowerCase() : '';
      const oTurn = _normTurn(oldItem.turnr);
      if (!mExisting[oName + '|' + oTurn]) {
        mergedDagar[mDate].push(oldItem);
        mExisting[oName + '|' + oTurn] = true;
      }
    }
  }

  await env.DOCS_KV.put('positions:_baseline', JSON.stringify({
    dagar: mergedDagar, ts: Date.now()
  }));
}

/** Normalize turn number for comparison — strips TP suffix */
function _normTurn(turnr) {
  return (turnr || '').replace(/\s*-?\s*TP$/i, '').trim().toUpperCase();
}

/** Convert "HH:MM" to minutes, -1 if invalid */
function _timeToMin(t) {
  if (!t || t === '-') return -1;
  const parts = (t + '').split(':');
  if (parts.length < 2) return -1;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// =============================================
// /docs — List, GET, PUT
// =============================================

/** GET /docs — list all uploaded documents metadata */
async function handleListDocs(env) {
  if (!env.DOCS_KV) {
    return jsonResp({ error: 'KV storage not configured' }, 500);
  }

  try {
    const meta = await env.DOCS_KV.get('docs:_meta', 'json');
    return jsonResp({ files: meta || [] });
  } catch (err) {
    return jsonResp({ error: 'Failed to list docs: ' + err.message }, 500);
  }
}

/** GET /docs/{category} — download ZIP file */
async function handleGetDoc(env, category) {
  if (!env.DOCS_KV) {
    return jsonResp({ error: 'KV storage not configured' }, 500);
  }

  try {
    const zipData = await env.DOCS_KV.get('docs:' + category + ':zip', 'arrayBuffer');
    if (!zipData) {
      return jsonResp({ error: 'Document not found: ' + category }, 404);
    }

    return new Response(zipData, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="' + category + '.zip"',
        ...corsHeaders()
      }
    });
  } catch (err) {
    return jsonResp({ error: 'Failed to read doc: ' + err.message }, 500);
  }
}

/** PUT /docs/{category} — upload ZIP file */
async function handlePutDoc(request, env, category) {
  if (!env.DOCS_KV) {
    return jsonResp({ error: 'KV storage not configured' }, 500);
  }

  try {
    const zipData = await request.arrayBuffer();
    await env.DOCS_KV.put('docs:' + category + ':zip', zipData);

    // Update metadata
    await updateDocMeta(env, category, {
      category: category,
      uploadedAt: new Date().toISOString(),
      size: zipData.byteLength
    });

    return jsonResp({ success: true, message: 'Document saved: ' + category, size: zipData.byteLength });
  } catch (err) {
    return jsonResp({ error: 'Failed to save doc: ' + err.message }, 500);
  }
}

/** GET /docs/{category}/parsed — get parsed JSON data */
async function handleGetDocParsed(env, category) {
  if (!env.DOCS_KV) {
    return jsonResp({ error: 'KV storage not configured' }, 500);
  }

  try {
    const data = await env.DOCS_KV.get('docs:' + category + ':parsed', 'json');
    if (!data) {
      return jsonResp({ error: 'Parsed data not found: ' + category }, 404);
    }

    // Return the parsed data directly (array of items)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    });
  } catch (err) {
    return jsonResp({ error: 'Failed to read parsed data: ' + err.message }, 500);
  }
}

/** PUT /docs/{category}/parsed — upload parsed JSON data */
async function handlePutDocParsed(request, env, category) {
  if (!env.DOCS_KV) {
    return jsonResp({ error: 'KV storage not configured' }, 500);
  }

  try {
    const body = await request.json();
    await env.DOCS_KV.put('docs:' + category + ':parsed', JSON.stringify(body));

    return jsonResp({ success: true, message: 'Parsed data saved: ' + category });
  } catch (err) {
    return jsonResp({ error: 'Failed to save parsed data: ' + err.message }, 500);
  }
}

// =============================================
// Docs metadata helper
// =============================================
async function updateDocMeta(env, category, entry) {
  const meta = (await env.DOCS_KV.get('docs:_meta', 'json')) || [];

  // Update or add entry
  const idx = meta.findIndex(m => m.category === category);
  if (idx >= 0) {
    meta[idx] = entry;
  } else {
    meta.push(entry);
  }

  await env.DOCS_KV.put('docs:_meta', JSON.stringify(meta));
}

// =============================================
// Helpers
// =============================================
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-PIN, X-API-Key',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResp(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}
