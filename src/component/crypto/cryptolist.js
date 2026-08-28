import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Sparkline from "./sparkline";
import LoadingCrypto from "../loading/loadingcrypto";
import { getTopCoins, getGlobal } from "./cryptoapi";
import {
  CURRENCIES,
  formatPrice,
  formatBig,
  formatNumber,
  formatPercent,
  percentClass,
} from "./format";

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

  useEffect(() => {
    let cancelled = false;

    async function fetchdata() {
      setIsLoading(true);
      setError(null);
      try {
        const [markets, stats] = await Promise.all([getTopCoins(currency, 100, 1), getGlobal()]);
        if (cancelled) return;
        setCoins(markets);
        setGlobal(stats.data);
      } catch (err) {
        if (!cancelled) setError("could not load the market data, the api is probably rate limiting us");
      }
      if (!cancelled) setIsLoading(false);
    }

    fetchdata();
    // keep the prices moving without a manual reload
    const timer = setInterval(fetchdata, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currency]);

  const handlesort = (key) => {
    if (sort.key === key) {
      setSort({ key: key, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      setSort({ key: key, direction: key === "market_cap_rank" || key === "name" ? "asc" : "desc" });
    }
  };

  const term = search.trim().toLowerCase();
  const visible = coins
    .filter((coin) => coin.name.toLowerCase().includes(term) || coin.symbol.toLowerCase().includes(term))
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
    <div className="container-fluid p-4">
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
            <strong>{formatBig(global.total_market_cap[currency], currency)}</strong>
          </div>
          <div className="col-6 col-md-3">
            <small className="text-muted d-block">24h volume</small>
            <strong>{formatBig(global.total_volume[currency], currency)}</strong>
          </div>
          <div className="col-6 col-md-3">
            <small className="text-muted d-block">btc dominance</small>
            <strong>{global.market_cap_percentage.btc.toFixed(1)}%</strong>
          </div>
          <div className="col-6 col-md-3">
            <small className="text-muted d-block">market cap 24h</small>
            <strong className={percentClass(global.market_cap_change_percentage_24h_usd)}>
              {formatPercent(global.market_cap_change_percentage_24h_usd)}
            </strong>
          </div>
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
                    <Link className="text-decoration-none text-dark" to={`/crypto/${coin.id}`}>
                      <img src={coin.image} alt={coin.name} width="24" height="24" className="me-2" />
                      {coin.name} <span className="text-muted">{coin.symbol.toUpperCase()}</span>
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
                    {formatNumber(coin.circulating_supply)} {coin.symbol.toUpperCase()}
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
        data from coingecko, refreshed every minute
      </p>
    </div>
  );
};

export default CryptoList;
