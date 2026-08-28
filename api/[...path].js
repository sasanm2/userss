/* The vercel serverless function behind /api/*.
 *
 * Set COINGECKO_KEY (and COINGECKO_PLAN=pro for a paid key) in the vercel
 * project's environment variables. They are server side only, so unlike a
 * REACT_APP_ value they never reach the browser.
 */

const { serveApi, status } = require("./_coingecko");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "only GET is supported" });
    return;
  }

  // vercel hands the catch-all segments over in req.query.path
  const segments = [].concat(req.query.path || []);
  const pathname = "/" + segments.join("/");

  if (pathname === "/healthz") {
    res.status(200).json(status());
    return;
  }

  // everything except the catch-all itself is a query param for coingecko
  const params = Object.entries(req.query)
    .filter(([name]) => name !== "path")
    .flatMap(([name, value]) => [].concat(value).map((one) => [name, one]));

  const answer = await serveApi(pathname, params);

  res.setHeader("content-type", "application/json");
  res.setHeader("x-proxy-cache", answer.cache);
  if (answer.status === 200 && answer.ttl > 0) {
    // the cdn keeps answering from its copy for the same window the proxy
    // would have, so a cold function is not hit on every poll
    const seconds = Math.max(1, Math.round(answer.ttl / 1000));
    res.setHeader("cache-control", `public, s-maxage=${seconds}, stale-while-revalidate=59`);
  } else {
    res.setHeader("cache-control", "no-store");
  }
  res.status(answer.status).send(answer.body);
};
