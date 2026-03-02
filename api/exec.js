// api/exec.js 
const UPSTREAM_URL = process.env.UPSTREAM_URL; // set in Vercel

export default async function handler(req, res) {
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

  try {
    const forwardHeaders = {};
    if (req.headers["content-type"]) forwardHeaders["Content-Type"] = req.headers["content-type"];
    if (req.headers["authorization"]) forwardHeaders["Authorization"] = req.headers["authorization"];

    let forwardBody;
    if (req.method === "GET" || req.method === "HEAD") forwardBody = undefined;
    else forwardBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});

    const upstreamResp = await fetch(UPSTREAM_URL, {
      method: req.method,
      headers: forwardHeaders,
      body: forwardBody,
    });

    const upstreamText = await upstreamResp.text();
    const upstreamContentType = upstreamResp.headers.get("content-type") || "application/json; charset=utf-8";

    res.status(upstreamResp.status);
    res.setHeader("Content-Type", upstreamContentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Proxy-Key");
    return res.send(upstreamText);
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(502).json({ ok: false, error: String(err) });
  }
}
