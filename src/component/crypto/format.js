export const CURRENCIES = [
  { value: "usd", symbol: "$" },
  { value: "eur", symbol: "€" },
  { value: "gbp", symbol: "£" },
  { value: "jpy", symbol: "¥" },
  { value: "btc", symbol: "₿" },
];

export function currencySymbol(currency) {
  const found = CURRENCIES.find((c) => c.value === currency);
  return found ? found.symbol : currency.toUpperCase() + " ";
}

// cheap coins need more decimals than expensive ones
export function formatPrice(value, currency = "usd") {
  if (value === null || value === undefined) return "-";
  const abs = Math.abs(value);
  let digits = 2;
  if (abs < 1) digits = 4;
  if (abs < 0.01) digits = 6;
  if (abs < 0.0001) digits = 8;
  return (
    currencySymbol(currency) +
    value.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

export function formatBig(value, currency = "usd") {
  if (value === null || value === undefined) return "-";
  const symbol = currencySymbol(currency);
  const abs = Math.abs(value);
  if (abs >= 1e12) return symbol + (value / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return symbol + (value / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return symbol + (value / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return symbol + (value / 1e3).toFixed(2) + "K";
  return symbol + value.toFixed(2);
}

export function formatNumber(value) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPercent(value) {
  if (value === null || value === undefined) return "-";
  return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
}

export function percentClass(value) {
  if (value === null || value === undefined) return "text-muted";
  return value >= 0 ? "text-success" : "text-danger";
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
