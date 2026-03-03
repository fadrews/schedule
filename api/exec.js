// /api/exec.js (Node runtime) — improved version
console.log('APPS_SCRIPT_WEBAPP_URL=', process.env.APPS_SCRIPT_WEBAPP_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const APPS_SCRIPT_WEBAPP_URL = process.env.APPS_SCRIPT_WEBAPP_URL ||
    'https://script.google.com/macros/s/AKfycbzuOED5RJUuiYTrKwNHco3QO2av7dEmkx0qNFi-5XvrCF9zJSuR5Mi6SNqiEPMopz56tw/exec';

  try {
    // Preserve the incoming Content-Type (important if client uses text/plain)
    const forwardHeaders = {
      // If the incoming request has Content-Type, use it. Otherwise default to application/json
      'Content-Type': req.headers['content-type'] || 'application/json',
      // Optional: add a small custom header to tag requests from proxy
      'X-Proxy-Forwarded-By': 'vercel-exec-proxy'
    };

    const forward = await fetch(APPS_SCRIPT_WEBAPP_URL, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(req.body)
      // do not include credentials here; browser<->proxy is same-origin
    });

    const text = await forward.text();

    // If the apps-script returned JSON, forward as-is (preserve status)
    try {
      const json = JSON.parse(text);
      // Keep the original status code where possible
      const status = (forward && forward.status) || 200;
      return res.status(status).json(json);
    } catch (err) {
      // Non-JSON body from Apps Script: wrap into consistent JSON so client won't choke.
      const status = forward && forward.status ? forward.status : 502;
      console.warn('exec proxy: apps-script returned non-JSON:', { status, bodyPreview: text.slice(0, 200) });
      return res.status(status).json({
        ok: false,
        error: 'Non-JSON response from Apps Script',
        status,
        raw: String(text).slice(0, 10000) // trim large bodies
      });
    }
  } catch (err) {
    console.error('exec proxy: fetch to Apps Script failed', err && err.stack ? err.stack : String(err));
    return res.status(502).json({
      ok: false,
      error: 'proxy failed',
      message: String(err && err.message ? err.message : err)
    });
  }
}
