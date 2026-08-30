#!/usr/bin/env node
/* Runs the whole analysis against live coingecko data and prints a report.
 *
 * The app does this in the browser; this is the same code with no browser and
 * no build step, so it can be run anywhere node can reach the api.
 *
 *   node scripts/scan-real.cjs
 *   node scripts/scan-real.cjs --coins=100 --days=365 --replicates=50
 *   node scripts/scan-real.cjs --key=CG-xxxx          (faster, no pacing)
 *
 * It writes scan-result.json beside the report so the numbers can be kept or
 * handed to someone else to read.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

// the analysis modules are es modules for the app's sake, so they are loaded
// here by stripping the module keywords into one commonjs file
function load() {
  const dir = path.join(__dirname, "..", "src", "component", "crypto");
  let src = "";
  for (const name of ["indicators", "signals", "backtest", "walkforward", "aggregate", "permutation"]) {
    src +=
      fs
        .readFileSync(path.join(dir, name + ".js"), "utf8")
        .replace(/^export /gm, "")
        .replace(/^import .*$/gm, "") + "\n";
  }
  src += "module.exports = { walkForward, aggregate, scanVerdict, permutationTest };";
  const tmp = path.join(os.tmpdir(), "crypto-analysis.cjs");
  fs.writeFileSync(tmp, src);
  return require(tmp);
}

const arg = (name, fallback) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=").slice(1).join("=") : fallback;
};

const COINS = Number(arg("coins", 100));
const DAYS = arg("days", "365");
const HORIZON = Number(arg("horizon", 7));
const REPLICATES = Number(arg("replicates", 50));
const CURRENCY = arg("currency", "usd");
const KEY = arg("key", process.env.COINGECKO_KEY || "");
const BASE = process.env.COINGECKO_BASE || "https://api.coingecko.com/api/v3";
const PACE = KEY ? 150 : 2500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (v, d = 0) => (v === null || v === undefined ? "-" : `${v.toFixed(d)}%`);
const pad = (s, n) => String(s).padEnd(n);
const padLeft = (s, n) => String(s).padStart(n);

async function get(url) {
  const headers = { accept: "application/json" };
  if (KEY) headers["x-cg-demo-api-key"] = KEY;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const error = new Error(`http ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

(async () => {
  const { walkForward, aggregate, scanVerdict, permutationTest } = load();

  console.log(`\ncoins ${COINS} · ${DAYS} days · horizon +${HORIZON} · ${REPLICATES} shuffled runs`);
  console.log(KEY ? "using an api key" : `no api key, pacing ${PACE}ms between coins`);

  let markets;
  try {
    markets = await get(
      `${BASE}/coins/markets?vs_currency=${CURRENCY}&order=market_cap_desc&per_page=${COINS}&page=1`
    );
  } catch (err) {
    console.error(`\ncould not reach the api: ${err.message}`);
    console.error("if this is a 429 the free allowance is exhausted, try again in a minute");
    process.exit(1);
  }

  const collected = [];
  let throttled = 0;

  for (let i = 0; i < markets.length; i++) {
    const coin = markets[i];
    process.stdout.write(`\r  fetching ${i + 1}/${markets.length}  ${pad(coin.name.slice(0, 22), 22)}`);
    try {
      const raw = await get(`${BASE}/coins/${coin.id}/ohlc?vs_currency=${CURRENCY}&days=${DAYS}`);
      const candles = (raw || [])
        .filter((row) => Array.isArray(row) && row.length >= 5)
        .map((row) => ({ time: row[0], open: row[1], high: row[2], low: row[3], close: row[4] }))
        .filter((c) => [c.high, c.low, c.close].every(Number.isFinite));
      if (candles.length >= 120) {
        collected.push({
          id: coin.id,
          name: coin.name,
          candles,
          walk: walkForward(
            { closes: candles.map((c) => c.close), candles },
            { horizon: HORIZON, count: 4 }
          ),
        });
      }
    } catch (err) {
      if (err.status === 429) throttled++;
    }
    if (i < markets.length - 1) await sleep(PACE);
  }
  process.stdout.write("\r" + " ".repeat(60) + "\r");

  const measured = collected.filter((c) => c.walk && c.walk.rows.length);
  console.log(`\n${measured.length} of ${markets.length} coins had enough history to test`);
  if (throttled) console.log(`${throttled} requests were throttled and are missing`);
  if (!measured.length) {
    console.log("nothing to report. try more days, or a key if the api was throttling.");
    process.exit(0);
  }

  const summary = aggregate(collected);
  const read = scanVerdict(summary);

  console.log("\n=== assuming each coin is an independent coin flip ===");
  console.log(`${read.text}\n${read.detail}\n`);
  console.log(pad("indicator", 20) + padLeft("coins held", 12) + padLeft("rate", 7) + padLeft("corrected p", 14));
  summary.rows.forEach((row) => {
    console.log(
      pad(row.label, 20) +
        padLeft(`${row.wins}/${row.votes}`, 12) +
        padLeft(pct(row.winRate), 7) +
        padLeft(row.adjustedP < 0.001 ? "< 0.001" : row.adjustedP.toFixed(3), 14) +
        (row.beatsChance ? "  beats chance" : row.reverses ? "  reverses" : "")
    );
  });

  console.log(`\n=== against ${REPLICATES} shuffled histories ===`);
  console.log("(this takes a moment, it reruns everything on shuffled data)");
  const permutation = await permutationTest(collected, {
    horizon: HORIZON,
    count: 4,
    replicates: REPLICATES,
    onProgress: (done, total) => process.stdout.write(`\r  shuffled run ${done}/${total}`),
  });
  process.stdout.write("\r" + " ".repeat(40) + "\r");

  if (permutation.tooFew) {
    console.log("too few coins with enough history to shuffle against");
  } else {
    if (permutation.nullBest) {
      console.log(
        `the bar: on shuffled data the best indicator managed ${pct(permutation.nullBest.median)} ` +
          `of coins typically, ${pct(permutation.nullBest.max)} at its luckiest ` +
          `(the coin flip test above assumes 50%)\n`
      );
    }
    console.log(pad("indicator", 20) + padLeft("coins held", 12) + padLeft("rate", 7) + padLeft("p", 8) + padLeft("p all", 8));
    permutation.rows.forEach((row) => {
      console.log(
        pad(row.label, 20) +
          padLeft(`${row.wins}/${row.votes}`, 12) +
          padLeft(pct(row.rate), 7) +
          padLeft(row.p.toFixed(3), 8) +
          padLeft(row.pFamilywise.toFixed(3), 8) +
          (row.pFamilywise < 0.05 ? "  BEATS SHUFFLED" : "")
      );
    });

    const winners = permutation.rows.filter((row) => row.pFamilywise < 0.05);
    console.log(
      winners.length
        ? `\n${winners.length} indicator(s) cleared the shuffled bar. before believing it: the top ` +
            `${COINS} today are the coins that survived, which flatters any long history, and none ` +
            `of this includes fees or slippage.`
        : "\nnothing cleared the shuffled bar, which is the usual and expected result."
    );
  }

  const out = path.join(process.cwd(), "scan-result.json");
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        settings: { coins: COINS, days: DAYS, horizon: HORIZON, replicates: REPLICATES, currency: CURRENCY },
        coinsMeasured: measured.length,
        throttled,
        binomial: summary.rows,
        shuffled: permutation.rows,
        shuffledBar: permutation.nullBest,
      },
      null,
      2
    )
  );
  console.log(`\nwritten to ${out}`);
})();
