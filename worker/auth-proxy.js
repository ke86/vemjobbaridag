export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (request.method !== 'POST') {
      return jsonResp({ error: 'Only POST allowed' }, 405);
    }

    var url = new URL(request.url);

    if (url.pathname === '/verify' || url.pathname === '/verify/') {
      var body;
      try {
        body = await request.json();
      } catch (e) {
        return jsonResp({ error: 'Invalid JSON body' }, 400);
      }

      var password = (body.password || '').trim();
      if (!password) {
        return jsonResp({ error: 'Missing password' }, 400);
      }

      if (password !== env.APP_PASSWORD) {
        return jsonResp({ error: 'Wrong password' }, 401);
      }

      return jsonResp({
        ok: true,
        firebaseEmail: env.FIREBASE_AUTH_EMAIL,
        firebasePassword: env.FIREBASE_AUTH_PASS
      });
    }

    return jsonResp({ error: 'Not found' }, 404);
  }
};

function jsonResp(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
