addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // ── Preflight (OPTIONS) ──────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  if (request.method !== 'GET') {
    return new Response('Only GET allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const nr = url.searchParams.get('nr');
  const date = url.searchParams.get('date');

  // Validate parameters
  if (!nr || !date) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameters: nr, date' }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  if (nr !== '10' && nr !== '11') {
    return new Response(
      JSON.stringify({ error: 'Invalid route number. Allowed: 10, 11' }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(
      JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  // Build bane.dk URL: La-{NR}-{DATE}-{DATE}.pdf
  const pdfUrl = 'https://www.bane.dk/temp/FileFetch/RouteInformationFolder/La/La-' + nr + '-' + date + '-' + date + '.pdf';

  try {
    const pdfResponse = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VemJobbar/1.0)',
        'Accept': 'application/pdf',
      },
    });

    if (!pdfResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'PDF not found', status: pdfResponse.status }),
        { status: pdfResponse.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }
      );
    }

    return new Response(pdfResponse.body, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="La-' + nr + '-' + date + '.pdf"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch PDF', message: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
