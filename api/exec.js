// /api/exec.js
console.log('APPS_SCRIPT_WEBAPP_URL=', process.env.APPS_SCRIPT_WEBAPP_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const APPS_SCRIPT_WEBAPP_URL = process.env.APPS_SCRIPT_WEBAPP_URL ||
    'https://script.google.com/macros/s/AKfycbzuOED5RJUuiYTrKwNHco3QO2av7dEmkx0qNFi-5XvrCF9zJSuR5Mi6SNqiEPMopz56tw/exec';

  try {
    const incomingContentType = req.headers['content-type'] || 'application/json';
    const forwardedBody = (typeof req.body === 'string') ? req.body : JSON.stringify(req.body);

    const forward = await fetch(APPS_SCRIPT_WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': incomingContentType,
        'X-Proxy-Forwarded-By': 'vercel-exec-proxy'
      },
      body: forwardedBody
    });

    const text = await forward.text();

    try {
      const json = JSON.parse(text);
      const status = forward && forward.status ? forward.status : 200;
      return res.status(status).json(json);
    } catch (err) {
      const status = forward && forward.status ? forward.status : 502;
      console.warn('exec proxy: apps-script returned non-JSON', { status, preview: text.slice(0,200) });
      return res.status(status).json({
        ok: false,
        error: 'Non-JSON response from Apps Script',
        status,
        raw: String(text).slice(0,10000)
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
