"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const root = path.resolve(__dirname, "..");
const packageRoot = process.env.SIMLAB_PACKAGE_ROOT ? path.resolve(process.env.SIMLAB_PACKAGE_ROOT) : null;
const port = Number(process.env.SIMLAB_PORT || 0);
const serverId = String(process.env.SIMLAB_SERVER_ID || "simlab-force-orthogonal");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  if (requestUrl.pathname === "/__simlab_health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-simlab-server-id": serverId });
    response.end(JSON.stringify({ serverId, root, packageRoot, source: "/sim/force-orthogonal-decomposition/index.html", packaged: "/packaged/force-orthogonal-decomposition/index.html" }));
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(requestUrl.pathname); }
  catch { response.writeHead(400).end("Bad request"); return; }
  const packagePath = packageRoot && pathname.startsWith("/packaged/") ? pathname.slice("/packaged/".length) : null;
  const base = packagePath === null ? root : packageRoot;
  const relative = packagePath === null ? pathname : `/${packagePath}`;
  const target = path.resolve(base, `.${relative}`);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) { response.writeHead(403).end("Forbidden"); return; }
  fs.stat(target, (statError, stat) => {
    if (statError || !stat.isFile()) { response.writeHead(404).end("Not found"); return; }
    fs.readFile(target, (readError, content) => {
      if (readError) { response.writeHead(500).end("Read failed"); return; }
      let body = content;
      if (packagePath === null && pathname === "/sim/force-orthogonal-decomposition/index.html") {
        const missingRuntime = requestUrl.searchParams.get("missing-runtime");
        const missingScript = missingRuntime === "scorm"
          ? '<script src="../shared/scorm.js" defer></script>'
          : missingRuntime === "activity-flow"
            ? '<script src="../shared/activity-flow.js" defer></script>'
            : null;
        if (missingScript) body = content.toString("utf8").replace(missingScript, "");
      }
      response.writeHead(200, { "content-type": types[path.extname(target).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
      response.end(body);
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  process.stdout.write(`SIMLAB_SERVER_PORT=${address.port} SIMLAB_SERVER_ID=${serverId}\n`);
});
