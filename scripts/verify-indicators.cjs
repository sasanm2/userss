const fs = require("fs");

/* Compares every indicator against the independent python implementation in
 * verify-indicators.py. Run both with: npm run verify:indicators */
// the indicators are an es module, so they are loaded by stripping the export
// keywords into a temporary commonjs copy rather than duplicating the source
const path = require("path");
const os = require("os");
const src = fs.readFileSync(path.join(__dirname, "..", "src", "component", "crypto", "indicators.js"), "utf8")
  .replace(/^export function/gm, "function")
  .replace(/^export const/gm, "const");
const tmp = path.join(os.tmpdir(), "indicators.copy.cjs");
fs.writeFileSync(tmp, src + "\nmodule.exports = { sma, ema, rsi, macd, bollinger, stochastic, atr, obv, roc, williamsR, cci, last };\n");
const I = require(tmp);
const ref = JSON.parse(fs.readFileSync("/tmp/indicator-reference.json", "utf8"));
const { closes, candles, volumes, expected } = ref;

const m = I.macd(closes);
const bb = I.bollinger(closes);
const st = I.stochastic(candles);
const got = {
  sma20: I.sma(closes, 20), ema12: I.ema(closes, 12), rsi14: I.rsi(closes, 14),
  macdLine: m.line, macdSignal: m.signal, macdHist: m.histogram,
  bbMiddle: bb.middle, bbUpper: bb.upper, bbLower: bb.lower,
  stochK: st.k, stochD: st.d, atr14: I.atr(candles), obv: I.obv(closes, volumes),
  roc12: I.roc(closes), williams14: I.williamsR(candles), cci20: I.cci(candles),
};

let failures = 0;
for (const name of Object.keys(expected)) {
  const a = expected[name], b = got[name];
  let worst = 0, nulls = 0, compared = 0, firstBad = null;
  if (!b || a.length !== b.length) { console.log(`${name}: LENGTH MISMATCH`); failures++; continue; }
  for (let i = 0; i < a.length; i++) {
    if (a[i] === null || b[i] === null) {
      if ((a[i] === null) !== (b[i] === null)) { nulls++; if (firstBad === null) firstBad = i; }
      continue;
    }
    compared++;
    const scale = Math.max(1, Math.abs(a[i]));
    const diff = Math.abs(a[i] - b[i]) / scale;
    if (diff > worst) worst = diff;
    if (diff > 1e-12 && firstBad === null) firstBad = i;
  }
  const ok = nulls === 0 && worst <= 1e-12;
  if (!ok) failures++;
  console.log(`${ok ? "MATCH" : "DIFFER"}  ${name.padEnd(11)} compared=${String(compared).padStart(3)} ` +
    `warmup-mismatch=${nulls} worst-rel-diff=${worst.toExponential(2)}` +
    (ok ? "" : `  first bad index ${firstBad}: py=${a[firstBad]} js=${b[firstBad]}`));
}
console.log(failures ? `\n${failures} series DIFFER` : "\nall series match the independent reference");
process.exit(failures ? 1 : 0);
