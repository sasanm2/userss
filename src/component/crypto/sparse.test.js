import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CryptoDetail from "./cryptodetail";

jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn() } }));
const axios = require("axios").default;

// a coin the way coingecko really answers for one with no max supply, no
// repository, no community accounts and only a short history: every one of
// these fields comes back null rather than missing
const sparse = {
  id: "sparsecoin", symbol: "spr", name: "Sparse Coin", market_cap_rank: 87,
  categories: [null, "Meme"],
  image: { large: null },
  genesis_date: null, hashing_algorithm: null,
  links: { homepage: [""] },
  description: { en: "" },
  community_data: { twitter_followers: null, reddit_subscribers: null },
  developer_data: { stars: null, forks: null },
  market_data: {
    current_price: { usd: 0.00031 },
    market_cap: { usd: 41000000 },
    fully_diluted_valuation: null,
    total_volume: { usd: 900000 },
    high_24h: { usd: 0.00033 }, low_24h: { usd: 0.0003 },
    ath: { usd: 0.004 }, ath_change_percentage: { usd: -92 },
    ath_date: { usd: "2021-05-09T00:00:00Z" },
    atl: { usd: 0.0001 }, atl_change_percentage: { usd: 210 },
    atl_date: { usd: "2020-03-13T00:00:00Z" },
    circulating_supply: 132000000000, total_supply: null, max_supply: null,
    price_change_percentage_24h_in_currency: { usd: 2.4 },
    price_change_percentage_7d_in_currency: { usd: -8 },
    price_change_percentage_14d_in_currency: {},
    price_change_percentage_30d_in_currency: { usd: 12 },
    // a young coin simply has no 200d or 1y block at all
    price_change_percentage_1y_in_currency: undefined,
  },
};

test("a coin with null fields still renders", async () => {
  axios.get.mockImplementation((url) =>
    Promise.resolve({ data: url.includes("market_chart") ? { prices: [[1, 2], [3, 4]] } : sparse }));
  render(
    <MemoryRouter initialEntries={["/crypto/sparsecoin"]}>
      <Routes><Route path="/crypto/:id" element={<CryptoDetail />} /></Routes>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getAllByText(/Sparse Coin/).length).toBeGreaterThan(0));
  expect(screen.getByText("$41.00M")).toBeInTheDocument();
  expect(screen.getByText("unlimited")).toBeInTheDocument();
});
