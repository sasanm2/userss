import axios from "axios";

// there are two ways to reach the market api.
//
// the safe one is the proxy in server/, which holds the key server side so it
// never reaches the browser. set REACT_APP_API_BASE=/api to use it.
//
// otherwise the browser calls coingecko directly, optionally with a key in
// REACT_APP_COINGECKO_KEY (and REACT_APP_COINGECKO_PLAN=pro for a pro key).
// note that create react app inlines that value into the bundle, so a key used
// this way is readable by anyone loading the site
const PROXY_BASE = process.env.REACT_APP_API_BASE;
const KEY = process.env.REACT_APP_COINGECKO_KEY;
const IS_PRO = (process.env.REACT_APP_COINGECKO_PLAN || "demo").toLowerCase() === "pro";

const DIRECT_URL = IS_PRO ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
const BASE_URL = PROXY_BASE || DIRECT_URL;

export const usesProxy = Boolean(PROXY_BASE);

// the proxy carries its own key, so the fast refresh settings are fine there
export const hasKey = Boolean(KEY) || Boolean(PROXY_BASE);

function headers() {
  // through the proxy the browser never holds a key to send
  if (PROXY_BASE || !KEY) return {};
  return IS_PRO ? { "x-cg-pro-api-key": KEY } : { "x-cg-demo-api-key": KEY };
}

// the api is rate limited, so we keep every response for a short while and
// hand the cached copy back instead of asking again. the window has to stay
// under the fastest refresh the list offers, otherwise a poll would only ever
// see the cached copy
const cache = new Map();
const CACHE_TIME = 900;
// a long session on the fast refresh would otherwise keep every answer it has
// ever seen; only a handful of urls are ever in play
const CACHE_MAX = 40;

async function get(url, params) {
  const key = url + JSON.stringify(params);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TIME) {
    return hit.data;
  }

  // stamped with when the call went out, not when it came back, so a slow
  // answer cannot pass itself off as fresher than a later one
  const started = Date.now();
  const response = await axios.get(`${BASE_URL}${url}`, { params, headers: headers() });

  const current = cache.get(key);
  if (current && current.time > started) {
    // a newer call for the same thing already answered, so this one is stale
    // and must not overwrite it in the cache
    return current.data;
  }

  if (cache.size >= CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { time: started, data: response.data });
  return response.data;
}

// coingecko answers 429 once we ask too often, which the ui reports as a
// throttle rather than as a general failure
export function isRateLimited(error) {
  return Boolean(error && error.response && error.response.status === 429);
}

// the whole top 100 list with 7d sparkline points and every change percentage
export function getTopCoins(currency = "usd", perPage = 100, page = 1) {
  return get("/coins/markets", {
    vs_currency: currency,
    order: "market_cap_desc",
    per_page: perPage,
    page: page,
    sparkline: true,
    price_change_percentage: "1h,24h,7d,14d,30d,200d,1y",
  });
}

// everything the api knows about a single coin
export function getCoin(id) {
  return get(`/coins/${id}`, {
    localization: false,
    tickers: false,
    market_data: true,
    community_data: true,
    developer_data: true,
    sparkline: false,
  });
}

// historical prices used by the big chart on the detail page
export function getCoinChart(id, currency = "usd", days = 30) {
  return get(`/coins/${id}/market_chart`, {
    vs_currency: currency,
    days: days,
  });
}

// candles, needed by the indicators that read a high and a low rather than
// just a close. coingecko picks the candle size from the range asked for
export function getCoinOhlc(id, currency = "usd", days = 30) {
  return get(`/coins/${id}/ohlc`, {
    vs_currency: currency,
    days: days,
  });
}

export function getGlobal() {
  return get("/global");
}
