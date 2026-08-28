/* A small proxy that keeps the coingecko key on the server.
 *
 * The browser talks to this server instead of coingecko, and the key is added
 * here, so it never reaches the bundle. Run it with:
 *
 *   COINGECKO_KEY=your_key node server/index.js
 *
 * It also serves the production build when one exists, so the app and the api
 * share an origin and no cors setup is needed.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 4000;
const KEY = process.env.COINGECKO_KEY || "";
const IS_PRO = (process.env.COINGECKO_PLAN || "demo").toLowerCase() === "pro";
// overridable so the proxy can be pointed at a stub while testing
const UPSTREAM =
  process.env.COINGECKO_UPSTREAM ||
  (IS_PRO ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3");

const BUILD_DIR = path.join(__dirname, "..", "build");

/* Only these endpoints are reachable, so this cannot be used as an open proxy
 * to anywhere else. Each one says how long its answer may be reused and which
 * query params are allowed through; anything else is dropped. */
const ROUTES = [
  {
    match: /^\/coins\/markets$/,
    ttl: 800,
    params: ["vs_currency", "order", "per_page", "page", "sparkline", "price_change_percentage"],
  },
  {
    match: /^\/coins\/[a-z0-9-]+$/,
    ttl: 60000,
    params: ["localization", "tickers", "market_data", "community_data", "developer_data", "sparkline"],
  },
  {
    match: /^\/coins\/[a-z0-9-]+\/market_chart$/,
    ttl: 60000,
    params: ["vs_currency", "days", "interval"],
  },
  { match: /^\/global$/, ttl: 30000, params: [] },
];

/* One shared cache for every visitor. Ten people refreshing once a second
 * become one upstream call a second, which is what keeps the key's rate limit
 * intact no matter how many people have the page open. */
const cache = new Map();
const inflight = new Map();

function findRoute(pathname) {
  return ROUTES.find((route) => route.match.test(pathname));
}

function upstreamUrl(pathname, search, allowed) {
  const url = new URL(UPSTREAM + pathname);
  for (const [name, value] of new URLSearchParams(search)) {
    if (allowed.includes(name)) url.searchParams.append(name, value);
  }
  return url.toString();
}

function keyHeaders() {
  if (!KEY) return {};
  return IS_PRO ? { "x-cg-pro-api-key": KEY } : { "x-cg-demo-api-key": KEY };
}

async function fetchUpstream(url) {
  // collapse identical calls that arrive while one is already in the air
  if (inflight.has(url)) return inflight.get(url);

  const pending = (async () => {
    const response = await fetch(url, { headers: { accept: "application/json", ...keyHeaders() } });
    const text = await response.text();
    return { status: response.status, body: text };
  })().finally(() => inflight.delete(url));

  inflight.set(url, pending);
  return pending;
}

async function handleApi(req, res, pathname, search) {
  const route = findRoute(pathname);
  if (!route) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "unknown endpoint" }));
    return;
  }

  const url = upstreamUrl(pathname, search, route.params);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < route.ttl) {
    res.writeHead(200, { "content-type": "application/json", "x-proxy-cache": "hit" });
    res.end(hit.body);
    return;
  }

  try {
    const { status, body } = await fetchUpstream(url);
    if (status === 200) {
      cache.set(url, { time: Date.now(), body });
      res.writeHead(200, { "content-type": "application/json", "x-proxy-cache": "miss" });
      res.end(body);
      return;
    }
    // a throttle upstream is passed through so the page can show its banner,
    // but the upstream body is not, in case it echoes anything about the key
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: status === 429 ? "rate limited upstream" : "upstream error" }));
  } catch (err) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "could not reach the market api" }));
  }
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(BUILD_DIR)) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("no build yet, run npm run build");
    return;
  }

  const wanted = path.join(BUILD_DIR, pathname);
  // never serve outside the build directory
  const safe = wanted.startsWith(BUILD_DIR) && fs.existsSync(wanted) && fs.statSync(wanted).isFile();
  const file = safe ? wanted : path.join(BUILD_DIR, "index.html");

  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const { pathname, search } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname.slice(4), search);
    return;
  }
  if (pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    // whether a key is configured, never the key itself
    res.end(JSON.stringify({ ok: true, keyed: Boolean(KEY), plan: IS_PRO ? "pro" : "demo" }));
    return;
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`proxy on http://localhost:${PORT} (key ${KEY ? "configured" : "missing"})`);
});
