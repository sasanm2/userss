import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CryptoList from "./cryptolist";
import CryptoDetail from "./cryptodetail";

jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn() } }));
const axios = require("axios").default;

const coin = {
  id: "bitcoin", symbol: "btc", name: "Bitcoin", image: "x.png", current_price: 64000,
  market_cap: 1.2e12, market_cap_rank: 1, total_volume: 3.4e10, circulating_supply: 19700000,
  price_change_percentage_1h_in_currency: 0.4, price_change_percentage_24h_in_currency: -1.2,
  price_change_percentage_7d_in_currency: 3.5, price_change_percentage_30d_in_currency: 8.1,
  sparkline_in_7d: { price: [1, 2, 3, 2.5, 4] },
};
const detail = {
  id: "bitcoin", symbol: "btc", name: "Bitcoin", market_cap_rank: 1, categories: ["Layer 1"],
  image: { large: "x.png" }, genesis_date: "2009-01-03", hashing_algorithm: "SHA-256",
  links: { homepage: ["https://bitcoin.org"] },
  description: { en: "Bitcoin is <b>a</b> currency. Second. Third." },
  community_data: { twitter_followers: 100, reddit_subscribers: 200 },
  developer_data: { stars: 300, forks: 400 },
  market_data: {
    current_price: { usd: 64000 }, market_cap: { usd: 1.2e12 }, fully_diluted_valuation: { usd: 1.3e12 },
    total_volume: { usd: 3.4e10 }, high_24h: { usd: 65000 }, low_24h: { usd: 63000 },
    ath: { usd: 73000 }, ath_change_percentage: { usd: -12 }, ath_date: { usd: "2024-03-14T00:00:00Z" },
    atl: { usd: 67 }, atl_change_percentage: { usd: 9000 }, atl_date: { usd: "2013-07-06T00:00:00Z" },
    circulating_supply: 19700000, total_supply: 21000000, max_supply: 21000000,
    price_change_percentage_24h_in_currency: { usd: -1.2 },
    price_change_percentage_7d_in_currency: { usd: 3.5 },
    price_change_percentage_14d_in_currency: { usd: 4 },
    price_change_percentage_30d_in_currency: { usd: 8.1 },
    price_change_percentage_200d_in_currency: { usd: 20 },
    price_change_percentage_1y_in_currency: { usd: 100 },
  },
};
const globals = { data: { total_market_cap: { usd: 2.4e12 }, total_volume: { usd: 9e10 },
  market_cap_percentage: { btc: 54.3 }, market_cap_change_percentage_24h_usd: 1.1 } };

test("list renders the coins", async () => {
  axios.get.mockImplementation((url) =>
    Promise.resolve({ data: url.includes("/global") ? globals : Array(100).fill(coin).map((c, i) => ({ ...c, id: "c" + i, market_cap_rank: i + 1 })) }));
  render(<MemoryRouter><CryptoList /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByText(/Bitcoin/).length).toBe(100));
  expect(screen.getAllByText("$1.20T").length).toBeGreaterThan(0);
  expect(screen.getByText("54.3%")).toBeInTheDocument();
  expect(screen.getAllByText("$64,000.00").length).toBe(100);
});

test("detail renders coin data and chart", async () => {
  const prices = Array(50).fill(0).map((v, i) => [1700000000000 + i * 8.64e7, 60000 + i * 100]);
  axios.get.mockImplementation((url) =>
    Promise.resolve({ data: url.includes("market_chart") ? { prices } : detail }));
  render(<MemoryRouter initialEntries={["/crypto/bitcoin"]}>
    <Routes><Route path="/crypto/:id" element={<CryptoDetail />} /></Routes>
  </MemoryRouter>);
  await waitFor(() => expect(screen.getAllByText(/Bitcoin/).length).toBeGreaterThan(0));
  // the chart tab is the landing tab
  await waitFor(() => expect(document.querySelector("svg path")).toBeTruthy());
  // the figures live behind the market data tab
  fireEvent.click(screen.getByRole("tab", { name: "market data" }));
  expect(screen.getByText("$73,000.00")).toBeInTheDocument();
  expect(screen.getByText(/Bitcoin is a currency/)).toBeInTheDocument();
});
