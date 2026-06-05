/**
 * Cloudflare Worker: OneVR localStorage handler
 *
 * Handles two flows:
 * 1. POST /api/store-data - Bookmarklet POSTs localStorage data
 *    Returns ID for retrieval
 * 2. GET /api/get-data?id=XXX - Main app GETs stored data by ID
 *    Returns stored localStorage data
 */

// Simple in-memory storage (will be cleared when Worker restarts)
// For production, use Cloudflare KV Storage
const dataStore = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // POST /api/store-data - Store localStorage data
    if (url.pathname === '/api/store-data' && request.method === 'POST') {
      try {
        const data = await request.json();
        const id = generateId();

        // Store data temporarily (expires in 1 hour)
        dataStore.set(id, {
          data,
          timestamp: Date.now(),
          expires: Date.now() + 3600000 // 1 hour
        });

        console.log(`[WORKER] Stored data with ID: ${id}, size: ${JSON.stringify(data).length} bytes`);

        return new Response(JSON.stringify({ success: true, id }), {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('[WORKER] Error storing data:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/get-data?id=XXX - Retrieve localStorage data
    if (url.pathname === '/api/get-data' && request.method === 'GET') {
      const id = url.searchParams.get('id');

      if (!id) {
        return new Response(JSON.stringify({ success: false, error: 'Missing ID parameter' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      const stored = dataStore.get(id);

      if (!stored) {
        return new Response(JSON.stringify({ success: false, error: 'Data not found or expired' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      if (stored.expires < Date.now()) {
        dataStore.delete(id);
        return new Response(JSON.stringify({ success: false, error: 'Data expired' }), {
          status: 410,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[WORKER] Retrieved data with ID: ${id}`);

      return new Response(JSON.stringify({ success: true, data: stored.data }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Default response
    return new Response('OneVR localStorage Handler', {
      status: 200,
      headers: { ...headers, 'Content-Type': 'text/plain' }
    });
  }
};
