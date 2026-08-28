import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PriceChart from "./pricechart";
import LoadingCrypto from "../loading/loadingcrypto";
import { getCoin, getCoinChart } from "./cryptoapi";
import {
  CURRENCIES,
  formatPrice,
  formatBig,
  formatNumber,
  formatPercent,
  percentClass,
  formatDate,
} from "./format";

const RANGES = [
  { days: 1, label: "24h" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
  { days: "max", label: "max" },
];

const CHANGES = [
  { key: "price_change_percentage_24h_in_currency", label: "24h" },
  { key: "price_change_percentage_7d_in_currency", label: "7d" },
  { key: "price_change_percentage_14d_in_currency", label: "14d" },
  { key: "price_change_percentage_30d_in_currency", label: "30d" },
  { key: "price_change_percentage_200d_in_currency", label: "200d" },
  { key: "price_change_percentage_1y_in_currency", label: "1y" },
];

const CryptoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [coin, setCoin] = useState(null);
  const [series, setSeries] = useState([]);
  const [isloading, setIsLoading] = useState(true);
  const [chartloading, setChartLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currency, setCurrency] = useState("usd");
  const [days, setDays] = useState(30);

  useEffect(() => {
    async function fetchdata() {
      setIsLoading(true);
      setError(null);
      try {
        setCoin(await getCoin(id));
      } catch (err) {
        setError("could not load this coin");
      }
      setIsLoading(false);
    }
    fetchdata();
  }, [id]);

  useEffect(() => {
    async function fetchchart() {
      setChartLoading(true);
      try {
        const data = await getCoinChart(id, currency, days);
        setSeries(data.prices);
      } catch (err) {
        setSeries([]);
      }
      setChartLoading(false);
    }
    fetchchart();
  }, [id, currency, days]);

  if (isloading) {
    return (
      <div className="container p-4">
        <LoadingCrypto rows={8} />
      </div>
    );
  }

  if (error || !coin) {
    return (
      <div className="container p-4">
        <div className="alert alert-danger">{error || "coin not found"}</div>
        <button onClick={() => navigate("/crypto")} className="btn btn-info btn-sm">
          back to the list
        </button>
      </div>
    );
  }

  const market = coin.market_data;
  const price = market.current_price[currency];
  const change24 = market.price_change_percentage_24h_in_currency[currency];

  return (
    <div className="container p-4">
      <div className="row align-items-center mb-4">
        <div className="col-md-7 d-flex align-items-center">
          <img src={coin.image.large} alt={coin.name} width="56" height="56" className="me-3" />
          <div>
            <h2 className="mb-0">
              {coin.name} <span className="text-muted">{coin.symbol.toUpperCase()}</span>
            </h2>
            <span className="badge bg-secondary me-2">rank #{coin.market_cap_rank}</span>
            {coin.categories.slice(0, 2).map((category) => (
              <span key={category} className="badge bg-light text-dark me-2">
                {category}
              </span>
            ))}
          </div>
        </div>
        <div className="col-md-3 text-md-end">
          <h3 className="mb-0">{formatPrice(price, currency)}</h3>
          <span className={percentClass(change24)}>{formatPercent(change24)} (24h)</span>
        </div>
        <div className="col-md-2">
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

      <div className="btn-group mb-3">
        {RANGES.map((range) => (
          <button
            key={range.label}
            onClick={() => setDays(range.days)}
            className={`btn btn-sm ${days === range.days ? "btn-info" : "btn-outline-info"}`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {chartloading ? <LoadingCrypto rows={4} /> : <PriceChart series={series} currency={currency} />}

      <h4 className="mt-4">market data</h4>
      <div className="row">
        <div className="col-md-6">
          <table className="table table-sm">
            <tbody>
              <tr>
                <td>market cap</td>
                <td className="text-end">{formatBig(market.market_cap[currency], currency)}</td>
              </tr>
              <tr>
                <td>fully diluted valuation</td>
                <td className="text-end">
                  {formatBig(market.fully_diluted_valuation[currency], currency)}
                </td>
              </tr>
              <tr>
                <td>24h volume</td>
                <td className="text-end">{formatBig(market.total_volume[currency], currency)}</td>
              </tr>
              <tr>
                <td>24h high / low</td>
                <td className="text-end">
                  {formatPrice(market.high_24h[currency], currency)} /{" "}
                  {formatPrice(market.low_24h[currency], currency)}
                </td>
              </tr>
              <tr>
                <td>all time high</td>
                <td className="text-end">
                  {formatPrice(market.ath[currency], currency)}{" "}
                  <span className={percentClass(market.ath_change_percentage[currency])}>
                    ({formatPercent(market.ath_change_percentage[currency])})
                  </span>
                  <br />
                  <small className="text-muted">{formatDate(market.ath_date[currency])}</small>
                </td>
              </tr>
              <tr>
                <td>all time low</td>
                <td className="text-end">
                  {formatPrice(market.atl[currency], currency)}{" "}
                  <span className={percentClass(market.atl_change_percentage[currency])}>
                    ({formatPercent(market.atl_change_percentage[currency])})
                  </span>
                  <br />
                  <small className="text-muted">{formatDate(market.atl_date[currency])}</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="col-md-6">
          <table className="table table-sm">
            <tbody>
              <tr>
                <td>circulating supply</td>
                <td className="text-end">
                  {formatNumber(market.circulating_supply)} {coin.symbol.toUpperCase()}
                </td>
              </tr>
              <tr>
                <td>total supply</td>
                <td className="text-end">{formatNumber(market.total_supply)}</td>
              </tr>
              <tr>
                <td>max supply</td>
                <td className="text-end">
                  {market.max_supply ? formatNumber(market.max_supply) : "unlimited"}
                </td>
              </tr>
              <tr>
                <td>genesis date</td>
                <td className="text-end">{coin.genesis_date || "-"}</td>
              </tr>
              <tr>
                <td>hashing algorithm</td>
                <td className="text-end">{coin.hashing_algorithm || "-"}</td>
              </tr>
              <tr>
                <td>website</td>
                <td className="text-end">
                  {coin.links.homepage[0] ? (
                    <a href={coin.links.homepage[0]} target="_blank" rel="noreferrer">
                      {coin.links.homepage[0]}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <h4>price change</h4>
      <div className="row text-center mb-4">
        {CHANGES.map((change) => (
          <div key={change.key} className="col-4 col-md-2 p-2">
            <small className="text-muted d-block">{change.label}</small>
            <strong className={percentClass(market[change.key][currency])}>
              {formatPercent(market[change.key][currency])}
            </strong>
          </div>
        ))}
      </div>

      <h4>community and development</h4>
      <div className="row text-center mb-4">
        <div className="col-6 col-md-3">
          <small className="text-muted d-block">twitter followers</small>
          <strong>{formatNumber(coin.community_data.twitter_followers)}</strong>
        </div>
        <div className="col-6 col-md-3">
          <small className="text-muted d-block">reddit subscribers</small>
          <strong>{formatNumber(coin.community_data.reddit_subscribers)}</strong>
        </div>
        <div className="col-6 col-md-3">
          <small className="text-muted d-block">github stars</small>
          <strong>{formatNumber(coin.developer_data.stars)}</strong>
        </div>
        <div className="col-6 col-md-3">
          <small className="text-muted d-block">github forks</small>
          <strong>{formatNumber(coin.developer_data.forks)}</strong>
        </div>
      </div>

      {coin.description.en && (
        <>
          <h4>about {coin.name}</h4>
          {/* the api ships html in the description so the tags are stripped before rendering */}
          <p>{coin.description.en.replace(/<[^>]*>/g, "").split(". ").slice(0, 5).join(". ")}</p>
        </>
      )}

      <button onClick={() => navigate("/crypto")} className="btn btn-info btn-sm">
        back to the list
      </button>
    </div>
  );
};

export default CryptoDetail;
