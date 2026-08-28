"""Independent reference implementation, written from the textbook formulas,
to cross check the javascript. Deliberately written in a different style
(explicit loops over slices, no shared helpers) so a typo in one is unlikely
to be mirrored in the other."""
import json, math, random

def sma(v, n):
    return [None if i < n-1 else sum(v[i-n+1:i+1])/n for i in range(len(v))]

def ema(v, n):
    out = [None]*len(v)
    if len(v) < n: return out
    k = 2/(n+1)
    prev = sum(v[:n])/n
    out[n-1] = prev
    for i in range(n, len(v)):
        prev = v[i]*k + prev*(1-k)
        out[i] = prev
    return out

def rsi(v, n=14):
    out = [None]*len(v)
    if len(v) <= n: return out
    gains = [max(v[i]-v[i-1], 0) for i in range(1, len(v))]
    losses = [max(v[i-1]-v[i], 0) for i in range(1, len(v))]
    ag = sum(gains[:n])/n
    al = sum(losses[:n])/n
    def val(g, l):
        if l == 0: return 100.0
        if g == 0: return 0.0
        return 100 - 100/(1 + g/l)
    out[n] = val(ag, al)
    for i in range(n+1, len(v)):
        ag = (ag*(n-1) + gains[i-1])/n
        al = (al*(n-1) + losses[i-1])/n
        out[i] = val(ag, al)
    return out

def macd(v, fast=12, slow=26, sig=9):
    f, s = ema(v, fast), ema(v, slow)
    line = [None if f[i] is None or s[i] is None else f[i]-s[i] for i in range(len(v))]
    start = next((i for i, x in enumerate(line) if x is not None), None)
    signal = [None]*len(v); hist = [None]*len(v)
    if start is not None:
        comp = [x for x in line[start:] if x is not None]
        se = ema(comp, sig)
        for i, x in enumerate(se):
            if x is not None:
                signal[start+i] = x
                hist[start+i] = line[start+i] - x
    return line, signal, hist

def bollinger(v, n=20, mult=2):
    mid = sma(v, n)
    up, lo = [None]*len(v), [None]*len(v)
    for i in range(n-1, len(v)):
        w = v[i-n+1:i+1]
        m = sum(w)/n
        sd = math.sqrt(sum((x-m)**2 for x in w)/n)   # population
        up[i] = m + mult*sd; lo[i] = m - mult*sd
    return mid, up, lo

def stochastic(c, n=14, smooth=3):
    k = [None]*len(c)
    for i in range(n-1, len(c)):
        w = c[i-n+1:i+1]
        hi = max(x['high'] for x in w); lo = min(x['low'] for x in w)
        k[i] = 50.0 if hi == lo else (c[i]['close']-lo)/(hi-lo)*100
    start = next((i for i, x in enumerate(k) if x is not None), None)
    d = [None]*len(c)
    if start is not None:
        ks = sma(k[start:], smooth)
        for i, x in enumerate(ks):
            if x is not None: d[start+i] = x
    return k, d

def atr(c, n=14):
    out = [None]*len(c)
    if len(c) <= n: return out
    tr = []
    for i, x in enumerate(c):
        if i == 0: tr.append(x['high']-x['low'])
        else:
            p = c[i-1]['close']
            tr.append(max(x['high']-x['low'], abs(x['high']-p), abs(x['low']-p)))
    prev = sum(tr[1:n+1])/n
    out[n] = prev
    for i in range(n+1, len(c)):
        prev = (prev*(n-1) + tr[i])/n
        out[i] = prev
    return out

def obv(closes, vols):
    out = [None]*len(closes)
    if not closes: return out
    t = 0.0; out[0] = 0.0
    for i in range(1, len(closes)):
        if closes[i] > closes[i-1]: t += vols[i]
        elif closes[i] < closes[i-1]: t -= vols[i]
        out[i] = t
    return out

def roc(v, n=12):
    out = [None]*len(v)
    for i in range(n, len(v)):
        if v[i-n] != 0: out[i] = (v[i]-v[i-n])/v[i-n]*100
    return out

def williams(c, n=14):
    out = [None]*len(c)
    for i in range(n-1, len(c)):
        w = c[i-n+1:i+1]
        hi = max(x['high'] for x in w); lo = min(x['low'] for x in w)
        out[i] = -50.0 if hi == lo else (hi-c[i]['close'])/(hi-lo)*-100
    return out

def cci(c, n=20):
    tp = [(x['high']+x['low']+x['close'])/3 for x in c]
    av = sma(tp, n)
    out = [None]*len(c)
    for i in range(n-1, len(c)):
        w = tp[i-n+1:i+1]
        md = sum(abs(x-av[i]) for x in w)/n
        out[i] = 0.0 if md == 0 else (tp[i]-av[i])/(0.015*md)
    return out

random.seed(20260828)
closes, candles, vols = [], [], []
price = 100.0
for i in range(240):
    price = max(0.5, price * (1 + random.uniform(-0.04, 0.042)))
    high = price * (1 + random.uniform(0, 0.03))
    low = price * (1 - random.uniform(0, 0.03))
    opn = low + (high-low)*random.random()
    closes.append(price)
    candles.append({"open": opn, "high": high, "low": low, "close": price})
    vols.append(random.uniform(1e6, 9e6))

line, signal, hist = macd(closes)
mid, up, lo = bollinger(closes)
k, d = stochastic(candles)
out = {
  "closes": closes, "candles": candles, "volumes": vols,
  "expected": {
    "sma20": sma(closes, 20), "ema12": ema(closes, 12), "rsi14": rsi(closes, 14),
    "macdLine": line, "macdSignal": signal, "macdHist": hist,
    "bbMiddle": mid, "bbUpper": up, "bbLower": lo,
    "stochK": k, "stochD": d, "atr14": atr(candles), "obv": obv(closes, vols),
    "roc12": roc(closes), "williams14": williams(candles), "cci20": cci(candles),
  },
}
json.dump(out, open("/tmp/indicator-reference.json", "w"))
print("reference series written:", len(closes), "points")
