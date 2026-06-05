/**
 * Cloudflare Worker: OneVR localStorage handler
 *
 * Flow:
 * 1. Popup kommer här efter OneVR login
 * 2. Worker läser localStorage från popup-fönstret
 * 3. Worker skickar data tillbaka via postMessage
 * 4. Main window fyller textarea och laddar upp
 */

export default {
  async fetch(request) {
    // Only handle GET requests from callback
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Return HTML that reads localStorage and sends via postMessage
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OneVR Token Handler</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 400px;
    }
    .spinner {
      display: inline-block;
      width: 40px;
      height: 40px;
      border: 4px solid #f0f0f0;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 10px;
    }
    p {
      color: #666;
      font-size: 16px;
      line-height: 1.5;
    }
    .status {
      margin-top: 20px;
      padding: 12px;
      background: #f0f0f0;
      border-radius: 6px;
      color: #555;
      font-size: 14px;
    }
    .success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>OneVR Token Handler</h1>
    <p>Läser localStorage från OneVR...</p>
    <div class="status" id="status"></div>
  </div>

  <script>
    (async function() {
      const statusEl = document.getElementById('status');

      try {
        // Read localStorage from current window (we're on OneVR domain now)
        const storageData = {};
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            storageData[key] = localStorage[key];
          }
        }

        const keyCount = Object.keys(storageData).length;
        console.log('[ONEVR-CALLBACK] Found', keyCount, 'keys in localStorage');

        if (keyCount === 0) {
          throw new Error('Ingen data hittades i localStorage. Kontrollera att du är inloggad på OneVR.');
        }

        // Send data back to opener (main window)
        if (window.opener) {
          window.opener.postMessage({
            type: 'ONEVR_LOCALSTORAGE',
            success: true,
            data: storageData,
            timestamp: new Date().toISOString()
          }, '*');

          statusEl.textContent = '✓ Tokens hämtade! Popup stängs...';
          statusEl.className = 'status success';

          // Close popup after 1 second
          setTimeout(() => {
            window.close();
          }, 1000);
        } else {
          throw new Error('Kan inte kommunicera med huvudfönstret. Popup kan inte ha öppnats korrekt.');
        }

      } catch (error) {
        console.error('[ONEVR-CALLBACK] Error:', error.message);
        statusEl.textContent = '✗ Fel: ' + error.message;
        statusEl.className = 'status error';

        // Send error back to opener
        if (window.opener) {
          window.opener.postMessage({
            type: 'ONEVR_LOCALSTORAGE',
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          }, '*');
        }
      }
    })();
  </script>
</body>
</html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};
