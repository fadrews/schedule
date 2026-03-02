// /api/exec.js (Node runtime)
console.log('APPS_SCRIPT_WEBAPP_URL=', process.env.APPS_SCRIPT_WEBAPP_URL);
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const APPS_SCRIPT_WEBAPP_URL = process.env.APPS_SCRIPT_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbzuOED5RJUuiYTrKwNHco3QO2av7dEmkx0qNFi-5XvrCF9zJSuR5Mi6SNqiEPMopz56tw/exec';

  try {
    const forward = await fetch(APPS_SCRIPT_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const text = await forward.text();
    try {
      const json = JSON.parse(text);
      return res.status(200).json(json);
    } catch (err) {
      // Apps Script sometimes returns non-JSON on errors. Surface raw text
      return res.status(200).send(text);
    }
  } catch (err) {
    console.error('proxy error', err);
    return res.status(500).json({ ok: false, error: 'proxy failed', message: String(err && err.message ? err.message : err) });
  }
}
