import axios from "axios";

const BASE_URL = "https://api.coingecko.com/api/v3";

// the free coingecko api is rate limited, so we keep every response for a
// short while and hand the cached copy back instead of asking again. the
// window has to stay under the fastest refresh the list offers, otherwise a
// poll would only ever see the cached copy
const cache = new Map();
const CACHE_TIME = 900;

async function get(url, params) {
  const key = url + JSON.stringify(params);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TIME) {
    return hit.data;
  }
  const response = await axios.get(`${BASE_URL}${url}`, { params });
  cache.set(key, { time: Date.now(), data: response.data });
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

export function getGlobal() {
  return get("/global");
}
