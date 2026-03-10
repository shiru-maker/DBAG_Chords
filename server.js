const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "0.0.0.0";
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ROOT_DIR = __dirname;
const DB_PATH = path.join(ROOT_DIR, "PaWSongs.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

ensureDbFile();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/chords") {
    if (req.method === "GET") {
      return sendJson(res, 200, readDb());
    }

    if (req.method === "PUT") {
      try {
        const body = await readRequestBody(req);
        const payload = JSON.parse(body || "{}");

        const normalized = {
          chords: Array.isArray(payload.chords) ? payload.chords : [],
          updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
        };

        fs.writeFileSync(DB_PATH, JSON.stringify(normalized, null, 2), "utf8");
        return sendJson(res, 200, { ok: true });
      } catch {
        return sendJson(res, 400, { error: "Invalid JSON payload" });
      }
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requestedPath).replace(/^([.][.][/\\])+/, "");
  const fullPath = path.join(ROOT_DIR, safePath);

  if (!fullPath.startsWith(ROOT_DIR)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Chord server running on http://localhost:${PORT}`);
});

function ensureDbFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ chords: [], updatedAt: "" }, null, 2), "utf8");
  }
}

function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      chords: Array.isArray(parsed.chords) ? parsed.chords : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return { chords: [], updatedAt: "" };
  }
}


function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const json = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(json);
}
