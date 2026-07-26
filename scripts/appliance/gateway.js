/* The Shiloh appliance gateway — Church OS Phase 1, "the brain and the pipe."
 *
 * Runs ON the church's local Mac mini (or whatever box ends up in the
 * building). Wraps a local Ollama install with:
 *   - one shared-secret token, checked on every request (fails CLOSED if
 *     no token is configured — this refuses to serve rather than accidentally
 *     running open on a machine reachable from the internet via a tunnel)
 *   - CORS, so the admin panel (served from GitHub Pages, a different
 *     origin) can call it from a browser
 *   - a single /ask endpoint — nothing member-facing, nothing that touches
 *     money or sends a message on its own, per the Church OS non-negotiables
 *     in docs/DESIGN.md. It answers a question; nothing more.
 *
 * Plain Node, zero dependencies — see docs/APPLIANCE-SETUP.md for how to
 * install and run this as a background service.
 *
 * Configuration is environment variables, set in the launchd plist
 * (see docs/APPLIANCE-SETUP.md), not in this file:
 *   PORT             default 11535
 *   OLLAMA_URL       default http://127.0.0.1:11434
 *   OLLAMA_MODEL     required — no default, so nobody accidentally ships
 *                    an outdated model name; set it to whatever you pulled
 *   APPLIANCE_TOKEN  required — the shared secret data/config.json's
 *                    applianceToken must match
 *   ALLOWED_ORIGIN   default "*" — tighten to the app's real deployed
 *                    origin once it has a domain
 */
"use strict";
var http = require("http");

var PORT = parseInt(process.env.PORT || "11535", 10);
var OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
var OLLAMA_MODEL = process.env.OLLAMA_MODEL || "";
var APPLIANCE_TOKEN = process.env.APPLIANCE_TOKEN || "";
var ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
var MAX_PROMPT_CHARS = 4000;

if (!APPLIANCE_TOKEN) {
  console.error("APPLIANCE_TOKEN is not set — refusing to start. Every request would otherwise be unauthenticated on a machine reachable from the internet. See docs/APPLIANCE-SETUP.md.");
  process.exit(1);
}
if (!OLLAMA_MODEL) {
  console.error("OLLAMA_MODEL is not set — pull a model with `ollama pull <name>` and set OLLAMA_MODEL to match. See docs/APPLIANCE-SETUP.md.");
  process.exit(1);
}

function log(msg) { console.log("[" + new Date().toISOString() + "] " + msg); }

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}
function json(res, status, body) {
  var s = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(s) });
  res.end(s);
}
function authorized(req) {
  var h = req.headers["authorization"] || "";
  return h === "Bearer " + APPLIANCE_TOKEN;
}
function readBody(req, cb) {
  var chunks = [];
  var total = 0;
  req.on("data", function (c) {
    total += c.length;
    if (total > 20000) { req.destroy(); return; } // crude cap, this is a single short prompt endpoint
    chunks.push(c);
  });
  req.on("end", function () {
    try { cb(null, JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
    catch (e) { cb(e); }
  });
}

/* Talks to Ollama's own local HTTP API — see https://github.com/ollama/ollama/blob/main/docs/api.md */
function askOllama(prompt, cb) {
  var url = new URL("/api/generate", OLLAMA_URL);
  var body = JSON.stringify({ model: OLLAMA_MODEL, prompt: prompt, stream: false });
  var mod = url.protocol === "https:" ? require("https") : require("http");
  var req = mod.request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
  }, function (ollamaRes) {
    var chunks = [];
    ollamaRes.on("data", function (c) { chunks.push(c); });
    ollamaRes.on("end", function () {
      try {
        var parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        cb(null, parsed.response || "");
      } catch (e) { cb(e); }
    });
  });
  req.on("error", cb);
  req.write(body);
  req.end();
}

var server = http.createServer(function (req, res) {
  withCors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, { ok: true, model: OLLAMA_MODEL });
  }

  if (req.method === "POST" && req.url === "/ask") {
    if (!authorized(req)) { log("rejected: bad or missing token"); return json(res, 401, { error: "Unauthorized" }); }
    return readBody(req, function (err, body) {
      if (err || !body || typeof body.prompt !== "string" || !body.prompt.trim()) {
        return json(res, 400, { error: "Expected JSON body: { \"prompt\": \"...\" }" });
      }
      var prompt = body.prompt.trim().slice(0, MAX_PROMPT_CHARS);
      log("asked (" + prompt.length + " chars)"); // never logs prompt content — see file header
      askOllama(prompt, function (err2, answer) {
        if (err2) { log("ollama error: " + err2.message); return json(res, 502, { error: "The local model didn't respond. Is Ollama running?" }); }
        json(res, 200, { response: answer });
      });
    });
  }

  json(res, 404, { error: "Not found. This gateway only serves GET /health and POST /ask." });
});

server.listen(PORT, "0.0.0.0", function () {
  log("Shiloh appliance gateway listening on :" + PORT + " → Ollama model \"" + OLLAMA_MODEL + "\" at " + OLLAMA_URL);
});
