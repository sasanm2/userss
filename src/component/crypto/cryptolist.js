import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Sparkline from "./sparkline";
import CoinLogo from "./coinlogo";
import LoadingCrypto from "../loading/loadingcrypto";
import { getTopCoins, getGlobal, isRateLimited, hasKey } from "./cryptoapi";
import {
  CURRENCIES,
  formatPrice,
  formatBig,
  formatNumber,
  formatPercent,
  percentClass,
} from "./format";
import "./crypto.css";

// how often the list re-asks the api. the fast options are there for watching
// a move, but the free api only allows a handful of calls a minute, so they
// will start coming back throttled
const INTERVALS = [
  { ms: 1000, label: "1s" },
  { ms: 5000, label: "5s" },
  { ms: 10000, label: "10s" },
  { ms: 30000, label: "30s" },
  { ms: 60000, label: "60s" },
];

const STORED_INTERVAL = "crypto-refresh";

const SORTS = [
  { key: "market_cap_rank", label: "#" },
  { key: "name", label: "coin" },
  { key: "current_price", label: "price" },
  { key: "price_change_percentage_1h_in_currency", label: "1h" },
  { key: "price_change_percentage_24h_in_currency", label: "24h" },
  { key: "price_change_percentage_7d_in_currency", label: "7d" },
  { key: "price_change_percentage_30d_in_currency", label: "30d" },
  { key: "total_volume", label: "volume 24h" },
  { key: "market_cap", label: "market cap" },
  { key: "circulating_supply", label: "circulating" },
];

const CryptoList = () => {
  const [coins, setCoins] = useState([]);
  const [global, setGlobal] = useState(null);
  const [isloading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currency, setCurrency] = useState("usd");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "market_cap_rank", direction: "asc" });
  const [throttled, setThrottled] = useState(false);
  const [updated, setUpdated] = useState(null);
  const [interval, setRefresh] = useState(() => {
    // reading storage throws in a private window or with site data blocked
    try {
      const saved = Number(localStorage.getItem(STORED_INTERVAL));
      return INTERVALS.some((item) => item.ms === saved) ? saved : 10000;
    } catch (err) {
      return 10000;
    }
  });

  // the numbers on screen belong to the previous currency until the next poll
  // answers, so they are cleared rather than relabelled
  useEffect(() => {
    setIsLoading(true);
  }, [currency]);

  // the prices poll at whatever rate is selected
  useEffect(() => {
    let cancelled = false;
    // at a one second refresh a slow answer can land after a newer one, and
    // without this the older prices would overwrite the newer ones
    let latest = 0;

    async function fetchdata() {
      const ticket = ++latest;
      try {
        const markets = await getTopCoins(currency, 100, 1);
        if (cancelled || ticket !== latest) return;
        setCoins(markets);
        setUpdated(new Date());
        setError(null);
        setThrottled(false);
      } catch (err) {
        if (cancelled) return;
        // a throttle keeps whatever prices we already have on screen, only a
        // failure with nothing to show becomes an error
        if (isRateLimited(err)) {
          setThrottled(true);
        } else {
          setError("could not load the market data, the api is probably rate limiting us");
        }
      }
      if (!cancelled) setIsLoading(false);
    }

    fetchdata();
    // keep the prices moving without a manual reload
    const timer = setInterval(fetchdata, interval);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currency, interval]);

  // the global totals barely move, so they keep their own slow timer instead
  // of doubling the number of calls the fast refresh settings make
  useEffect(() => {
    let cancelled = false;

    async function fetchglobal() {
      try {
        const stats = await getGlobal();
        if (!cancelled) setGlobal(stats.data);
      } catch (err) {
        // the prices are the point of the page, a missing header is not worth
        // reporting
      }
    }

    fetchglobal();
    const timer = setInterval(fetchglobal, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currency]);

  const handlerefresh = (ms) => {
    setRefresh(ms);
    try {
      localStorage.setItem(STORED_INTERVAL, String(ms));
    } catch (err) {
      // not remembering the choice is better than breaking the click
    }
  };

  const handlesort = (key) => {
    if (sort.key === key) {
      setSort({ key: key, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      setSort({ key: key, direction: key === "market_cap_rank" || key === "name" ? "asc" : "desc" });
    }
  };

  const term = search.trim().toLowerCase();
  const visible = coins
    .filter((coin) => {
      const name = (coin.name || "").toLowerCase();
      const symbol = (coin.symbol || "").toLowerCase();
      return name.includes(term) || symbol.includes(term);
    })
    .sort((a, b) => {
      const first = a[sort.key];
      const second = b[sort.key];
      if (first === second) return 0;
      if (first === null || first === undefined) return 1;
      if (second === null || second === undefined) return -1;
      const compare = typeof first === "string" ? first.localeCompare(second) : first - second;
      return sort.direction === "asc" ? compare : -compare;
    });

  return (
    <div className="container-fluid p-4 crypto-dark">
      <div className="row align-items-center mb-3">
        <div className="col-md-4">
          <h2 className="mb-0">top 100 coins</h2>
        </div>
        <div className="col-md-5">
          <input
            className="form-control"
            placeholder="search a coin by name or symbol"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {CURRENCIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.value.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {global && (
        <div className="row text-center mb-4">
          <div className="col-6 col-md-3">
            <small className="text-muted d-block">total market cap</small>
            <strong>{formatBig(global.total_market_cap?.[currency], currency)}</strong>
          </div>
          <div className="col-6 col-md-3">
            <small className="text-muted d-block">24h volume</small>
            <strong>{formatBig(global.total_volume?.[currency], currency)}</strong>
          </div>
          <div className="col-6 col-md-3">
            <small className="text-muted d-block">btc dominance</small>
            <strong>
              {global.market_cap_percentage?.btc === undefined
                ? "-"
                : `${global.market_cap_percentage.btc.toFixed(1)}%`}
            </strong>
          </div>
          <div className="col-6 col-md-3">
            <small className="text-muted d-block">market cap 24h</small>
            <strong className={percentClass(global.market_cap_change_percentage_24h_usd)}>
              {formatPercent(global.market_cap_change_percentage_24h_usd)}
            </strong>
          </div>
        </div>
      )}

      <div className="row align-items-center mb-3">
        <div className="col-auto d-flex align-items-center">
          <small className="text-muted me-2">refresh</small>
          <div className="btn-group btn-group-sm">
            {INTERVALS.map((item) => (
              <button
                key={item.ms}
                onClick={() => handlerefresh(item.ms)}
                className={`btn btn-sm ${interval === item.ms ? "btn-info" : "btn-outline-info"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="col">
          <small className="text-muted">
            {updated ? `updated ${updated.toLocaleTimeString()}` : "waiting for the first prices"}
          </small>
        </div>
      </div>

      {!hasKey && (interval <= 5000) && (
        <div className="alert alert-secondary">
          this fast a refresh needs a coingecko api key, otherwise the free allowance runs out
          within a minute. set REACT_APP_COINGECKO_KEY to use one
        </div>
      )}

      {throttled && (
        <div className="alert alert-warning">
          the api is throttling us at this refresh rate, the prices below are the last ones it
          returned. pick a slower refresh to keep them moving
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {isloading ? (
        <LoadingCrypto />
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                {SORTS.map((column) => (
                  <th
                    key={column.key}
                    role="button"
                    className={column.key === "name" ? "" : "text-end"}
                    onClick={() => handlesort(column.key)}
                  >
                    {column.label}
                    {sort.key === column.key ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
                <th className="text-end">last 7 days</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((coin) => (
                <tr key={coin.id}>
                  <td>{coin.market_cap_rank}</td>
                  <td>
                    <Link className="text-decoration-none" to={`/crypto/${coin.id}`}>
                      <span className="me-2">
                        <CoinLogo src={coin.image} symbol={coin.symbol} name={coin.name} size={24} />
                      </span>
                      {coin.name} <span className="text-muted">{(coin.symbol || "").toUpperCase()}</span>
                    </Link>
                  </td>
                  <td className="text-end">{formatPrice(coin.current_price, currency)}</td>
                  <td className={`text-end ${percentClass(coin.price_change_percentage_1h_in_currency)}`}>
                    {formatPercent(coin.price_change_percentage_1h_in_currency)}
                  </td>
                  <td className={`text-end ${percentClass(coin.price_change_percentage_24h_in_currency)}`}>
                    {formatPercent(coin.price_change_percentage_24h_in_currency)}
                  </td>
                  <td className={`text-end ${percentClass(coin.price_change_percentage_7d_in_currency)}`}>
                    {formatPercent(coin.price_change_percentage_7d_in_currency)}
                  </td>
                  <td className={`text-end ${percentClass(coin.price_change_percentage_30d_in_currency)}`}>
                    {formatPercent(coin.price_change_percentage_30d_in_currency)}
                  </td>
                  <td className="text-end">{formatBig(coin.total_volume, currency)}</td>
                  <td className="text-end">{formatBig(coin.market_cap, currency)}</td>
                  <td className="text-end">
                    {formatNumber(coin.circulating_supply)} {(coin.symbol || "").toUpperCase()}
                  </td>
                  <td className="text-end">
                    <Sparkline points={coin.sparkline_in_7d ? coin.sparkline_in_7d.price : []} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && <p className="text-center text-muted">no coin matches that search</p>}
        </div>
      )}

      <p className="text-muted text-center mt-3">
        data from coingecko
      </p>
    </div>
  );
};

export default CryptoList;
