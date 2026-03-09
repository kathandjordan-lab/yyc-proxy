// ============================================================
// YYC Flight Monitor — SerpAPI Proxy Server
// Hosted on Railway — works from any device, anywhere
// ============================================================

const http  = require('http');
const https = require('https');
const url   = require('url');

// API key is stored as an environment variable in Railway (never hard-coded)
const SERP_API_KEY = process.env.SERP_API_KEY || '';
const PORT         = process.env.PORT || 3001;

// ============================================================

const server = http.createServer((req, res) => {

  // Allow any browser to call this proxy (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check — Railway uses this to confirm the server is alive
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status  : 'running',
      message : 'YYC Flight Monitor proxy is live ✈',
      key_set : !!SERP_API_KEY,
    }));
    return;
  }

  // Guard — refuse requests if no API key is configured
  if (!SERP_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'SERP_API_KEY environment variable not set on server.' }));
    return;
  }

  // Parse query params from the flight app
  const parsed = url.parse(req.url, true);
  const params = parsed.query;

  if (!params.engine || !params.departure_id || !params.arrival_id || !params.outbound_date) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing required params: engine, departure_id, arrival_id, outbound_date' }));
    return;
  }

  // Build SerpAPI request — key is injected server-side, never exposed to browser
  const serpParams = new URLSearchParams({
    engine        : params.engine,
    departure_id  : params.departure_id,
    arrival_id    : params.arrival_id,
    outbound_date : params.outbound_date,
    currency      : params.currency  || 'CAD',
    hl            : params.hl        || 'en',
    type          : params.type      || '1',
    ...(params.return_date && { return_date: params.return_date }),
    ...(params.adults      && { adults: params.adults }),
    api_key       : SERP_API_KEY,
  });

  const serpUrl = `https://serpapi.com/search.json?${serpParams.toString()}`;

  console.log(`[${new Date().toISOString()}] → YYC to ${params.arrival_id} on ${params.outbound_date}`);

  https.get(serpUrl, (serpRes) => {
    let data = '';
    serpRes.on('data', chunk => data += chunk);
    serpRes.on('end', () => {
      res.writeHead(serpRes.statusCode, { 'Content-Type': 'application/json' });
      res.end(data);
      console.log(`[${new Date().toISOString()}] ✓ ${serpRes.statusCode} (${data.length} bytes)`);
    });
  }).on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ✈  YYC Flight Monitor — Proxy Server');
  console.log('  ─────────────────────────────────────');
  console.log(`  Port:    ${PORT}`);
  console.log(`  API Key: ${SERP_API_KEY ? '✅ Set' : '❌ NOT SET — add SERP_API_KEY in Railway variables'}`);
  console.log('');
});
