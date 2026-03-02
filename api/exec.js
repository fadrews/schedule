// api/exec.js (Serverless function)
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const upstream = process.env.UPSTREAM_URL;
  console.log("UPSTREAM_URL:", upstream ?? "(undefined)");
  if (!upstream) return res.status(500).json({ ok: false, error: "UPSTREAM_URL not configured" });

  // Read raw request body
  let bodyText = "";
  try {
    bodyText = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  } catch (e) {
    bodyText = JSON.stringify(req.body || {});
  }
  console.log("Forwarding raw body:", bodyText.slice(0,1000));

  try {
    const upstreamRes = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText || "{}"
    });

    const text = await upstreamRes.text();
    console.log("Upstream status:", upstreamRes.status);
    console.log("Upstream body (first 2000 chars):", text.slice(0,2000));

    // Return upstream text verbatim
    res.status(upstreamRes.status).setHeader("Content-Type", "text/plain").send(text);
  } catch (err) {
    console.error("proxy fetch error:", err);
    res.status(502).json({ ok: false, error: "Proxy error", detail: String(err) });
  }
}
