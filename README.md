# Top 100 Coins

A create react app project with a crypto section at `/crypto`: the top 100
coins with prices, changes, sparklines and charts, and a detail page per coin.
It installs on android as a PWA, so it can live on the home screen.

## The CoinGecko api key

The app works with no key, on the free allowance. That allowance is only a
handful of calls a minute, so the 1s and 5s refresh settings will be throttled
without one.

To use a key, copy `.env.example` to `.env.local` and set:

```
REACT_APP_COINGECKO_KEY=your_key_here
REACT_APP_COINGECKO_PLAN=demo
```

A free demo key comes from https://www.coingecko.com/en/developers/dashboard.
Set the plan to `pro` for a paid key, which switches the host and the header.
Restart `npm start` after changing it, the value is read at build time.

Rate limits, at the two calls a second this page can make: the demo tier
allows about 30 calls a minute, which comfortably covers the 10s default but
not 1s. Sustained 1s polling needs a paid tier.

**The key is public.** Create react app inlines env values into the bundle, so
anyone loading the site can read it out. Use a rotatable demo key, and put a
backend in front of the api if it has to stay secret.

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
