/* A small proxy that keeps the coingecko key on the server, for running the
 * app anywhere that is not vercel.
 *
 * The browser talks to this server instead of coingecko, and the key is added
 * here, so it never reaches the bundle. Run it with:
 *
 *   COINGECKO_KEY=your_key node server/index.js
 *
 * It also serves the production build when one exists, so the app and the api
 * share an origin and no cors setup is needed.
 *
 * The endpoint allowlist and the caching live in api/_coingecko.js, shared
 * with the vercel function so the two cannot drift apart.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const { serveApi, status } = require("../api/_coingecko");

const PORT = Number(process.env.PORT) || 4000;
const BUILD_DIR = path.join(__dirname, "..", "build");

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(BUILD_DIR)) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("no build yet, run npm run build");
    return;
  }

  const wanted = path.join(BUILD_DIR, pathname);
  // never serve outside the build directory
  const safe = wanted.startsWith(BUILD_DIR) && fs.existsSync(wanted) && fs.statSync(wanted).isFile();
  const file = safe ? wanted : path.join(BUILD_DIR, "index.html");

  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname.startsWith("/api/")) {
    const answer = await serveApi(pathname.slice(4), searchParams);
    res.writeHead(answer.status, { "content-type": "application/json", "x-proxy-cache": answer.cache });
    res.end(answer.body);
    return;
  }
  if (pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(status()));
    return;
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`proxy on http://localhost:${PORT} (key ${status().keyed ? "configured" : "missing"})`);
});
