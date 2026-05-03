const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { execFile } = require("child_process");

const rootDir = __dirname;
const frontendDir = path.join(rootDir, "frontend");
const tmpDir = path.join(rootDir, ".tmp");
const pluginPath = path.join(rootDir, "build", "ConstFoldStrengthReducePass.so");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function safeJoin(base, requestedPath) {
  const cleanPath = requestedPath === "/" ? "/index.html" : requestedPath;
  const fullPath = path.normalize(path.join(base, cleanPath));
  const relativePath = path.relative(base, fullPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return fullPath;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function toWslPath(windowsPath) {
  const match = windowsPath.match(/^([A-Za-z]):\\(.*)$/);
  if (!match) {
    return windowsPath.replace(/\\/g, "/");
  }

  return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, "/")}`;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 20000 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function runOpt(inputPath, outputPath) {
  if (!fs.existsSync(pluginPath)) {
    throw new Error(
      "Pass plugin not found. Build it first with: cmake -S . -B build -G Ninja -DLLVM_DIR=/usr/lib/llvm-18/lib/cmake/llvm && cmake --build build"
    );
  }

  if (process.platform === "win32") {
    const command = [
      "opt",
      "-load-pass-plugin",
      shellQuote(toWslPath(pluginPath)),
      "-passes=const-fold-strength-reduce",
      "-S",
      shellQuote(toWslPath(inputPath)),
      "-o",
      shellQuote(toWslPath(outputPath)),
    ].join(" ");

    return runCommand("wsl", ["bash", "-lc", command]);
  }

  return runCommand("opt", [
    "-load-pass-plugin",
    pluginPath,
    "-passes=const-fold-strength-reduce",
    "-S",
    inputPath,
    "-o",
    outputPath,
  ]);
}

async function handleOptimize(req, res) {
  try {
    const body = await readRequestBody(req);
    const payload = JSON.parse(body || "{}");
    const ir = String(payload.ir || "");

    if (!ir.trim()) {
      sendJson(res, 400, { error: "Input IR is empty." });
      return;
    }

    fs.mkdirSync(tmpDir, { recursive: true });

    const id = crypto.randomUUID();
    const inputPath = path.join(tmpDir, `${id}.ll`);
    const outputPath = path.join(tmpDir, `${id}.out.ll`);

    fs.writeFileSync(inputPath, ir, "utf8");

    try {
      await runOpt(inputPath, outputPath);
      const optimizedIr = fs.readFileSync(outputPath, "utf8");
      sendJson(res, 200, { optimizedIr });
    } catch (error) {
      sendJson(res, 422, {
        error: error.stderr || error.message || "opt failed to optimize the input IR.",
      });
    } finally {
      fs.rmSync(inputPath, { force: true });
      fs.rmSync(outputPath, { force: true });
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const filePath = safeJoin(frontendDir, decodeURIComponent(requestUrl.pathname));

  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    send(res, 200, data, mimeTypes[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/optimize") {
    handleOptimize(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  send(res, 405, "Method not allowed");
});

server.listen(port, () => {
  console.log(`LLVM pass UI running at http://localhost:${port}`);
});
