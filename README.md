# Top 100 Coins

A create react app project with a crypto section at `/crypto`: the top 100
coins with prices, changes, sparklines and charts, and a detail page per coin.
It installs on android as a PWA, so it can live on the home screen.

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
