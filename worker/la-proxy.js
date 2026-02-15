export default {
  async fetch(request) {
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

    if (!nr || !date) {
      return new Response(JSON.stringify({ error: 'Missing: nr, date' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    if (nr !== '10' && nr !== '11') {
      return new Response(JSON.stringify({ error: 'nr must be 10 or 11' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(JSON.stringify({ error: 'date must be YYYY-MM-DD' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    var pdfUrl = 'https://www.bane.dk/temp/FileFetch/RouteInformationFolder/La/La-' + nr + '-' + date + '-' + date + '.pdf';
    var bustUrl = pdfUrl + '?_=' + Date.now();

    try {
      var pdfResponse = await fetch(bustUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VemJobbar/1.0)', 'Accept': 'application/pdf' },
        cf: { cacheTtl: 0 }
      });
      if (!pdfResponse.ok) {
        return new Response(JSON.stringify({ error: 'PDF not found', status: pdfResponse.status }),
          { status: pdfResponse.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
      }
      return new Response(pdfResponse.body, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="La-' + nr + '-' + date + '.pdf"',
          'Cache-Control': 'public, max-age=3600',
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
    }
  }
};
