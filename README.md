# Top 100 Coins

A create react app project with a crypto section at `/crypto`: the top 100
coins with prices, changes, sparklines and charts, and a detail page per coin.
It installs on android as a PWA, so it can live on the home screen.

## The look of it

The interface follows a small set of tokens in `src/component/crypto/crypto.css`
and the matching constants in `theme.js`, which the svg charts read, so the
colours cannot drift between the css and the charts.

The palette is the validated data visualisation default, checked against this
app's own dark surface rather than assumed:

- the categorical slots the chart lines use pass the lightness band, the chroma
  floor, the colour vision separation gates and 3:1 contrast
- the reserved status pair for up and down measures 5.30:1 and 3.70:1 on the
  surface, and always appears beside a signed number, so the colour never
  carries the direction on its own

Two things came out of running the validator rather than eyeballing it. The
chart carries the price line plus two moving averages and no more: a third
average would have put the palette's yellow beside its orange, a pair that
measures a normal vision difference of 10.6 against a floor of 15, which is
genuinely hard to tell apart. And the bollinger pair is drawn as one filled
band rather than two loose dashed lines, because it is a range rather than two
identities.

On a phone the market table keeps rank, coin, price and the 24h move, and drops
the rest rather than scrolling sideways.

## Technical analysis

The coin page has a technical analysis panel behind a toggle. It computes,
over whatever range is selected:

- moving averages: SMA and EMA over 10, 20, 50, 100 and 200 periods
- RSI (14), with Wilder's smoothing
- MACD (12, 26, 9), line, signal and histogram
- Bollinger bands (20, 2), on a population standard deviation
- rate of change (12)
- stochastic %K and %D (14, 3), Williams %R (14), CCI (20) and ATR (14),
  which need a high and a low and so read the ohlc candles
- on balance volume

Each reading is shown with its conventional interpretation and counted into an
overall summary. They describe what the indicators say over the range on
screen; they are not advice and not a forecast.

Two things worth knowing about what the numbers mean:

- A period is one point of whichever series the indicator reads, and the two
  series are not on the same clock. The price based indicators run over the
  market chart points, the candle based ones over the ohlc candles, and the api
  chooses a different granularity for each depending on the range.
- The longer averages need enough history to exist at all. Over a 24h range an
  SMA 200 has nothing to work with, and the panel says so rather than showing a
  number computed from too little data.

### What followed these signals before

Under the analysis panel is a replay of the same indicators over the history on
screen. For each signal that is firing now, it counts how often price was
higher a chosen number of bars later, by how much on average, and how that
compares with the base rate over every bar in the range.

It is not a forecast, and the code is built to avoid the ways a backtest
usually flatters itself:

- **No lookahead.** Every indicator value at a bar depends only on the bars up
  to it, and the outcome measured is strictly after it. There is a test that
  truncates the series and asserts each indicator reads the same at that bar
  with and without the later data.
- **A base rate beside every row.** A signal followed by a rise 60% of the time
  in a range that rose 60% of the time anyway has said nothing. The edge column
  is the difference, and only that difference is counted.
- **Outcome over label.** A reading conventionally called bearish that was
  followed by rises more often than the base rate counts as evidence for a
  rise. Scoring it by its name instead would invert the whole table whenever an
  indicator has been contrarian on that coin.
- **Sample sizes on show.** Rows with fewer than a dozen past occurrences are
  marked and excluded from the overall reading, and a range too short for the
  horizon reports nothing at all rather than a thin number.
- **One grid.** The replay runs entirely on the candles when there are enough
  of them, or entirely on the price points otherwise, never a mix of the two.

What it still cannot account for: the samples overlap, so they are not
independent; it is one coin over one range, chosen after the fact; and there
are no fees, spread or slippage in the numbers.

### Walking it forward

The replay above is in sample: every signal is scored on the same bars it was
spotted on, which is the number that always looks good. Under it is a walk
forward test, which asks whether any of that survives when the rule is only
allowed to see the past.

The history is cut into blocks. For each block the rule comes from the bars
before it and is scored only on the block itself, so no decision is taken with
data from its own test window. An embargo drops any training bar whose outcome
would reach across the boundary, since otherwise part of the answer would
already be inside the training window.

What it reports: how many rules were testable forward, how often the direction
of the edge held, the average edge in sample, and what the same rules delivered
out of sample. A rule picked at random holds its direction about half the time,
so 50% is the number to beat, and the gap between the two edge figures is how
much of an apparent edge was really just the fit.

The engine is checked against both kinds of series in
`src/component/crypto/walkforward.test.js`:

- a rigid repeating cycle, where the pattern genuinely does recur, holds its
  direction 96% of the time and keeps 83% of its edge
- a seeded random walk, where nothing is there to find, shows a +10.8 point
  edge in sample that becomes +1.4 out of sample, with the direction holding
  exactly 50% of the time

That second case is the one worth remembering when reading any of these
numbers on a real coin.

### Testing across the whole market

`/crypto/scan` runs the walk forward test over the top coins at once and pools
the answers. One chart proves nothing: with four blocks and a dozen indicators,
some combination always holds by luck. An indicator that is real should hold
across a market, not only on the chart you happened to open.

Three things keep the pooled number meaningful:

- **One vote per coin.** The blocks inside a coin share a price history and
  overlap through the indicator's warmup, so counting each as a separate trial
  would inflate the confidence badly. Each coin contributes a single vote:
  whether its blocks held more often than not.
- **An exact binomial test** of those votes against the 50% a coin flip gives,
  rather than an eyeballed hit rate.
- **A correction for how many indicators were tried.** The luckiest of a dozen
  always looks good on its own, so every p value is multiplied by the number
  tested.

Direction is reported separately from significance, because they are not the
same thing. An indicator can be reliably unlike a coin flip by holding its
direction far *less* than half the time. That is not an edge to trade the other
way; it means the rule fitted noise. Those rows show red, not green.

Run it against a hundred generated random walks, where by construction there is
nothing to find, and the page says so: nothing beats chance, and several
indicators reverse reliably enough to be worth naming. That is the result to
expect, and the yardstick for reading any run against real coins.

Each coin costs one api call for its candles, so the run is on demand, paced
for the free allowance, and can be stopped part way.

### The shuffled history null

The binomial test above treats each coin as an independent trial. Coins move
together, so they are not, and that test is generous by an amount nobody can
state from theory. The scan page can measure it instead.

`permutation.js` runs the whole pipeline again against histories shuffled in
time. The shuffle is built to destroy exactly one thing:

- the order of the returns goes, so nothing in the past can predict the future
- the returns themselves stay, so volatility and fat tails are unchanged
- each bar keeps its own high and low as ratios to its close, so the candle
  based indicators still see realistic ranges
- and the same permutation is applied to every coin in a replicate, so coins
  that moved together still do. Shuffling each coin separately would quietly
  destroy the market wide correlation that is the entire reason the binomial
  test was too generous, and would answer a much easier question. There is a
  test asserting the correlation between two coins survives a shared
  permutation and collapses under separate ones.

Whatever the indicators score on shuffled data is the bar a real result has to
clear. The last column compares each indicator against the best score any
indicator managed on the shuffled runs, which allows for having tried them all
without assuming, as multiplying p values does, that they are unrelated.

On fifty coins built from a shared market factor plus per coin noise, where
nothing predictive exists by construction, the shuffled runs put the bar at
about 56% of coins typically and 80% at their luckiest, against the 50% the
binomial test assumes. That gap is the correction, measured rather than
guessed, and nothing in the real data cleared it.

A p value from this can never be zero: with n shuffled runs the smallest
possible is 1/(n+1).

### Running it without the app

`scripts/scan-real.cjs` runs the whole thing from the command line: it fetches
the coins, walks each one forward, pools the results and runs them against
shuffled histories, then prints a report and writes `scan-result.json`.

```
npm install
npm run scan:real
```

or with options:

```
node scripts/scan-real.cjs --coins=100 --days=365 --horizon=7 --replicates=50
node scripts/scan-real.cjs --key=CG-your-key      # no pacing, much faster
```

Without a key the run is paced for the free allowance, so a hundred coins takes
a few minutes. `COINGECKO_BASE` points it somewhere else, which is how it is
tested without touching the live api.

It needs nothing but node and network access to coingecko: no build, no
browser, no dev server. The output is plain text, so it can be pasted anywhere
for someone else to read.

### Checking the maths

The indicators in `src/component/crypto/indicators.js` are covered two ways.
`src/component/crypto/indicators.test.js` asserts hand computable values and
the edge cases: the exact Wilder RSI from a worked example, a set whose
population standard deviation is exactly 2, a gap up that only true range
catches, and so on.

On top of that, `npm run verify:indicators` computes every series a second
time in python, from the textbook formulas, and compares the two
implementations point by point over a 240 point series:

```
npm run verify:indicators
```

Every series must agree to within floating point noise. The python is
deliberately written in a different style from the javascript so that a typo
is unlikely to be mirrored in both.

## The CoinGecko api key

The app works with no key, on the free allowance. That allowance is only a
handful of calls a minute, so the 1s and 5s refresh settings need a key.

There are two ways to use one.

### With the proxy (keeps the key secret)

`server/index.js` is a small node server that holds the key and forwards the
calls, so the key never reaches the browser. It also serves the production
build, so the app and the api share an origin.

```
npm run build
COINGECKO_KEY=your_key_here npm run server
```

Then open http://localhost:4000. Set `COINGECKO_PLAN=pro` for a paid key, and
`PORT` to serve somewhere other than 4000.

For development, `npm run dev` starts the proxy and the react dev server
together; the dev server forwards `/api` to the proxy. Either way the app needs
`REACT_APP_API_BASE=/api` in `.env.local` to send its calls to the proxy rather
than straight to coingecko.

The proxy only forwards the four endpoints this app uses, drops query params it
does not recognise, and caches every answer briefly. That cache is shared by
everyone using the server, so a hundred phones refreshing once a second still
only cost about one upstream call a second.

### On vercel

`api/[...path].js` is the same proxy as a serverless function, so the app can
be deployed to vercel with the key still server side.

1. Import the repo in vercel. The build settings come from `vercel.json`.
2. Add the environment variables in the project settings:
   - `COINGECKO_KEY` = your key. Server side only, it is not exposed to the
     browser, so do not give it a `REACT_APP_` name.
   - `COINGECKO_PLAN` = `pro` if the key is a paid one, otherwise leave it out.
   - `REACT_APP_API_BASE` = `/api`, so the app calls the function.
3. Deploy. The function answers `/api/*` and `/api/healthz` reports whether a
   key is configured.

A serverless instance only keeps its cache while it stays warm, so the
function also sets `s-maxage` on each answer and lets vercel's cdn hold the
shared copy. The effect is the same: many visitors polling fast still cost
about one upstream call per cache window.

The endpoint allowlist and caching live in `api/_coingecko.js`, which both the
function and `server/index.js` use, so the two deployments behave the same.

### Without the proxy (the key is public)

Set `REACT_APP_COINGECKO_KEY` in `.env.local` and the browser calls coingecko
directly. Simpler to deploy, but create react app inlines the value into the
bundle, so anyone loading the site can read the key. Only use a demo key you
are willing to rotate.

Either way, a free demo key comes from
https://www.coingecko.com/en/developers/dashboard. The demo tier allows about
30 calls a minute, which covers the 10s default comfortably but not a sustained
1s refresh; that needs a paid tier.

## Building the android apk

The repo carries a capacitor android project in `android/`, so the app can be
built into a real apk. The build itself needs the android sdk, which means it
has to run on a machine that has it, not in this repo's ci.

What you need once: [Android Studio](https://developer.android.com/studio),
which brings the sdk and a jdk with it.

Then, from the repo root:

```
npm install
npm run android:apk
```

The apk lands at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Copy it to the phone and open it. Android will ask you to allow installing
from that source, since a debug apk is not from the play store.

`npm run android:open` does the same build steps and then opens the project in
Android Studio instead, which is the easier route if you want to run it on an
emulator, or produce a signed release apk (Build > Generate Signed Bundle or
APK).

Both scripts run `npm run build` and `npx cap sync android` first, so the apk
always carries the current web build. Run them again after any change to the
app.

Notes on the native build:

- The app id is `com.topcoins.app` and the name is "Top 100 Coins", both in
  `capacitor.config.json`.
- Inside the shell the app opens straight on the coin list, since a native
  webview always loads at `/`.
- The apk talks to coingecko directly, on the free allowance. To use a key
  without shipping it in the apk, deploy the proxy and point
  `REACT_APP_API_BASE` at its url before building.

## Installing on android

Build and serve the app over https, then open it in chrome on the phone and
use "Install app" from the menu. It opens on the coin list in its own window.
https is required, chrome does not offer the install prompt over plain http.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
