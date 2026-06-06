/**
 * onevr-auth.js — Cloudflare Worker
 * Combined worker: scrape triggers, scrape status polling, and Firebase auth token endpoint.
 *
 * Environment variables needed:
 *   FIREBASE_API_KEY       — Firebase Web API key (from Firebase Console → Project Settings)
 *   FIREBASE_EMAIL         — Service account email for Firebase Auth
 *   FIREBASE_PASSWORD      — Service account password for Firebase Auth
 *   GITHUB_PAT            — GitHub Personal Access Token for triggering Actions
 *   SCRAPE_PIN            — PIN code for scrape trigger/status access
 *
 * Deploy:
 *   wrangler deploy --name onevr-auth worker/onevr-auth.js
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ============================
    // GET /auth-token
    // Returns a Firebase ID token for Firestore writes
    // ============================
    if (path === '/auth-token' && request.method === 'GET') {
      return handleAuthToken(env);
    }

    // ============================
    // POST /trigger-scrape
    // Triggers a GitHub Actions workflow
    // ============================
    if (path === '/trigger-scrape' && request.method === 'POST') {
      return handleTriggerScrape(request, env);
    }

    // ============================
    // GET /scrape-status
    // Returns latest workflow run status
    // ============================
    if (path === '/scrape-status' && request.method === 'GET') {
      return handleScrapeStatus(request, env);
    }

    return jsonResp({ error: 'Not found' }, 404);
  }
};

// ----------------------------------------
// /auth-token — Firebase sign-in
// ----------------------------------------
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
        body: JSON.stringify({
          email,
          password: pass,
          returnSecureToken: true
        })
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

// ----------------------------------------
// /trigger-scrape — kick off GitHub Action
// ----------------------------------------
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
      'https://api.github.com/repos/ke86/snok/actions/workflows/scrape.yml/dispatches',
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

// ----------------------------------------
// /scrape-status — poll GitHub Actions runs
// ----------------------------------------
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
      'https://api.github.com/repos/ke86/snok/actions/workflows/scrape.yml/runs?per_page=5',
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

// ----------------------------------------
// Helpers
// ----------------------------------------
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-PIN',
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
