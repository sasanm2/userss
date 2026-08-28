import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CryptoList from "./cryptolist";
import Sparkline from "./sparkline";
import PriceChart from "./pricechart";

jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn() } }));
const axios = require("axios").default;

const coin = (price) => ({
  id: "bitcoin", symbol: "btc", name: "Bitcoin", image: "", current_price: price,
  market_cap: 1.2e12, market_cap_rank: 1, total_volume: 3.4e10, circulating_supply: 19700000,
  price_change_percentage_1h_in_currency: 0.4, price_change_percentage_24h_in_currency: -1.2,
  price_change_percentage_7d_in_currency: 3.5, price_change_percentage_30d_in_currency: 8.1,
  sparkline_in_7d: { price: [1, 2, 3] },
});
const globals = { data: { total_market_cap: { usd: 2.4e12 }, total_volume: { usd: 9e10 },
  market_cap_percentage: { btc: 54.3 }, market_cap_change_percentage_24h_usd: 1.1 } };

test("the list still renders when localStorage is unavailable", async () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() { throw new Error("access denied"); },
  });
  axios.get.mockImplementation((url) =>
    Promise.resolve({ data: url.includes("/global") ? globals : [coin(64000)] }));
  try {
    render(<MemoryRouter><CryptoList /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("$64,000.00")).toBeInTheDocument());
  } finally {
    if (original) Object.defineProperty(window, "localStorage", original);
  }
});

test("a slow answer landing after a newer one does not overwrite it", async () => {
  // poll every second so two requests are in flight inside the same effect
  localStorage.setItem("crypto-refresh", "1000");
  let call = 0;
  axios.get.mockImplementation((url) => {
    if (url.includes("/global")) return Promise.resolve({ data: globals });
    call++;
    // the first poll is slow and carries the older price, so it answers last
    const price = call === 1 ? 1000 : 2000;
    const delay = call === 1 ? 1500 : 0;
    return new Promise((resolve) => setTimeout(() => resolve({ data: [coin(price)] }), delay));
  });

  render(<MemoryRouter><CryptoList /></MemoryRouter>);

  // the second poll lands first
  await waitFor(() => expect(screen.getByText("$2,000.00")).toBeInTheDocument(), { timeout: 4000 });
  // and the stale first answer, arriving later, must be ignored
  await new Promise((r) => setTimeout(r, 1200));
  expect(screen.getByText("$2,000.00")).toBeInTheDocument();
  expect(screen.queryByText("$1,000.00")).not.toBeInTheDocument();
  localStorage.removeItem("crypto-refresh");
}, 15000);

test("charts survive null points instead of drawing nothing", () => {
  const { container: spark } = render(<Sparkline points={[1, null, 3, undefined, 5]} />);
  const sparkPath = spark.querySelector("path").getAttribute("d");
  expect(sparkPath).not.toContain("NaN");

  const { container: chart } = render(
    <PriceChart series={[[1, 10], [2, null], [3, 30], null, [4, 40]]} currency="usd" />
  );
  const chartPaths = [...chart.querySelectorAll("path")].map((p) => p.getAttribute("d")).join(" ");
  expect(chartPaths).not.toContain("NaN");
  expect(chartPaths.length).toBeGreaterThan(0);
});
