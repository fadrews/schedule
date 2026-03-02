// api/exec.js
// Vercel Serverless Proxy -> forwards requests to Apps Script exec URL
// Minimal, permissive CORS for same-origin use. Use PROXY_KEY to lock down if desired.

const UPSTREAM_URL = process.env.UPSTREAM_URL; // required
const PROXY_KEY = process.env.PROXY_KEY || null; // optional simple guard

export default async function handler(req, res) {
  // OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Proxy-Key");
    return res.status(204).end();
  }

  if (!UPSTREAM_URL) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({ ok: false, error: "UPSTREAM_URL not configured" });
  }

  // Optional simple auth: require X-Proxy-Key if PROXY_KEY set
  if (PROXY_KEY && req.headers["x-proxy-key"] !== PROXY_KEY) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(403).json({ ok: false, error: "proxy key required" });
  }

  try {
    // Build forward options
    const forwardHeaders = { };
    // Forward content-type if present; otherwise default to JSON
    if (req.headers["content-type"]) forwardHeaders["Content-Type"] = req.headers["content-type"];
    // Add any authorization header through if needed (or omit)
    if (req.headers["authorization"]) forwardHeaders["Authorization"] = req.headers["authorization"];

    // Body: if object, stringify; if raw string, send as-is
    let forwardBody;
    if (req.method === "GET" || req.method === "HEAD") {
      forwardBody = undefined;
    } else {
      // Vercel may already parsed JSON into req.body; stringify to send upstream as raw
      forwardBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    }

    const upstreamResp = await fetch(UPSTREAM_URL, {
      method: req.method,
      headers: forwardHeaders,
      body: forwardBody,
    });

    const upstreamText = await upstreamResp.text();
    const upstreamContentType = upstreamResp.headers.get("content-type") || "application/json; charset=utf-8";

    // Mirror status + content-type, but always send permissive CORS for same-origin deployment.
    res.status(upstreamResp.status);
    res.setHeader("Content-Type", upstreamContentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Proxy-Key");

    // Send raw upstream body through
    // If upstream returned JSON text, res.send will handle it.
    return res.send(upstreamText);
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(502).json({ ok: false, error: String(err) });
  }
}
