/* The proxy logic, shared by the standalone server in server/index.js and the
 * vercel function in api/[...path].js, so the endpoint allowlist only exists
 * in one place.
 *
 * The key is read from the server environment and never leaves it.
 */

const KEY = process.env.COINGECKO_KEY || "";
const IS_PRO = (process.env.COINGECKO_PLAN || "demo").toLowerCase() === "pro";
// overridable so the proxy can be pointed at a stub while testing
const UPSTREAM =
  process.env.COINGECKO_UPSTREAM ||
  (IS_PRO ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3");

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
  {
    match: /^\/coins\/[a-z0-9-]+\/ohlc$/,
    ttl: 60000,
    params: ["vs_currency", "days"],
  },
  { match: /^\/global$/, ttl: 30000, params: [] },
];

/* One shared cache for every visitor. Ten people refreshing once a second
 * become one upstream call a second, which is what keeps the key's rate limit
 * intact no matter how many people have the page open.
 *
 * On vercel this only lives as long as a warm instance, so the responses also
 * carry an s-maxage for the cdn to do the same job in front of it. */
const cache = new Map();
const inflight = new Map();

function keyHeaders() {
  if (!KEY) return {};
  return IS_PRO ? { "x-cg-pro-api-key": KEY } : { "x-cg-demo-api-key": KEY };
}

function upstreamUrl(pathname, params, allowed) {
  const url = new URL(UPSTREAM + pathname);
  for (const [name, value] of params) {
    if (allowed.includes(name)) url.searchParams.append(name, value);
  }
  return url.toString();
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

/* Answers one api call. `pathname` is the part after /api, `params` is any
 * iterable of [name, value] pairs. Returns what to send back, never throws. */
async function serveApi(pathname, params) {
  const route = ROUTES.find((item) => item.match.test(pathname));
  if (!route) {
    return { status: 404, body: JSON.stringify({ error: "unknown endpoint" }), cache: "none", ttl: 0 };
  }

  const url = upstreamUrl(pathname, params, route.params);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < route.ttl) {
    return { status: 200, body: hit.body, cache: "hit", ttl: route.ttl };
  }

  try {
    const { status, body } = await fetchUpstream(url);
    if (status === 200) {
      cache.set(url, { time: Date.now(), body });
      return { status: 200, body, cache: "miss", ttl: route.ttl };
    }
    // a throttle upstream is passed through so the page can show its banner,
    // but the upstream body is not, in case it echoes anything about the key
    return {
      status,
      body: JSON.stringify({ error: status === 429 ? "rate limited upstream" : "upstream error" }),
      cache: "none",
      ttl: 0,
    };
  } catch (err) {
    return {
      status: 502,
      body: JSON.stringify({ error: "could not reach the market api" }),
      cache: "none",
      ttl: 0,
    };
  }
}

// what /healthz reports: whether a key is configured, never the key itself
function status() {
  return { ok: true, keyed: Boolean(KEY), plan: IS_PRO ? "pro" : "demo" };
}

module.exports = { serveApi, status };
