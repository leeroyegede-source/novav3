import "dotenv/config";

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import os from "os";
import { exec, spawn } from "child_process";

const app = express();

app.use(cors());
app.use(express.json({ limit: "100mb" }));

const RUNNER_SECRET = process.env.RUNNER_SECRET;
const PREVIEW_PUBLIC_URL = process.env.PREVIEW_PUBLIC_URL;

const npmCmd = os.platform() === "win32" ? "npm.cmd" : "npm";
const npxCmd = os.platform() === "win32" ? "npx.cmd" : "npx";

let currentProcess = null;

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Docker Runner API is working",
  });
});

app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

function killCurrentProcess() {
  if (!currentProcess) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      if (os.platform() === "win32") {
        exec(`taskkill /pid ${currentProcess.pid} /t /f`, () => resolve());
      } else {
        process.kill(-currentProcess.pid);
        resolve();
      }
    } catch (error) {
      console.error("Failed to kill existing process:", error);
      resolve();
    }
  }).then(() => {
    currentProcess = null;
    return new Promise(res => setTimeout(res, 1000));
  });
}

function normalizeFiles(files) {
  const result = {};

  const cleanPath = (filePath) => {
    return String(filePath)
      .replace(/^\/+/, "")
      .replace(/^\\+/, "")
      .replace(/\.\./g, "");
  };

  if (Array.isArray(files)) {
    for (const file of files) {
      result[cleanPath(file.path)] = file.content;
    }
  } else {
    for (const [filePath, content] of Object.entries(files)) {
      result[cleanPath(filePath)] = content;
    }
  }

  return result;
}

function detectFramework(files) {
  let framework = "static";
  let port = 4173;
  let startCommand = null;

  if (files["package.json"]) {
    try {
      const pkg = JSON.parse(files["package.json"]);

      if (pkg.dependencies?.next || pkg.devDependencies?.next) {
        framework = "next";
        port = 3000;
        startCommand = [
          npmCmd,
          ["run", "dev", "--", "--hostname", "0.0.0.0", "-p", String(port)],
        ];
      } else if (
        pkg.dependencies?.vite ||
        pkg.devDependencies?.vite
      ) {
        framework = "vite";
        port = 5173;
        startCommand = [
          npmCmd,
          ["run", "dev", "--", "--host", "0.0.0.0", "--port", String(port)],
        ];
      } else {
        framework = "node";
        port = 3001;
        startCommand = [npmCmd, ["start"]];
      }
    } catch (error) {
      console.error("Failed to parse package.json:", error);
    }
  } else if (files["artisan"] || files["composer.json"]) {
    framework = "laravel";
    port = 8001;
    startCommand = [
      "php",
      ["artisan", "serve", "--host", "0.0.0.0", "--port", String(port)],
    ];
  } else if (files["index.php"]) {
    framework = "php";
    port = 8000;
    startCommand = ["php", ["-S", "0.0.0.0:" + port]];
  } else if (files["index.html"]) {
    framework = "static";
    port = 4173;
    startCommand = [
      npxCmd,
      ["serve", ".", "-p", String(port)],
    ];
  }

  return { framework, port, startCommand };
}

function saveFiles(workspacePath, files) {
  const rootWorkspace = path.dirname(workspacePath);
  
  try {
    fs.rmSync(rootWorkspace, {
      recursive: true,
      force: true,
    });
  } catch (err) {
    console.error("Failed to clear root workspace:", err);
  }

  fs.mkdirSync(workspacePath, {
    recursive: true,
  });

  for (const [filePath, content] of Object.entries(files)) {
    const safePath = path
      .normalize(filePath)
      .replace(/^[/\\]+/, "")
      .replace(/^(\.\.[/\\])+/, "");

    const fullPath = path.join(workspacePath, safePath);

    fs.mkdirSync(path.dirname(fullPath), {
      recursive: true,
    });

    fs.writeFileSync(fullPath, content ?? "");
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: true,
    });

    let logs = "";

    child.stdout.on("data", (data) => {
      logs += data.toString();
      process.stdout.write(`[CMD] ${data.toString()}`);
    });

    child.stderr.on("data", (data) => {
      logs += data.toString();
      process.stderr.write(`[CMD ERR] ${data.toString()}`);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(logs);
      } else {
        const error = new Error(`${command} ${args.join(" ")} failed with code ${code}`);
        error.logs = logs;
        reject(error);
      }
    });
  });
}

function startApp(command, args, cwd) {
  currentProcess = spawn(command, args, {
    cwd,
    shell: true,
    detached: os.platform() !== "win32",
  });

  currentProcess.stdout.on("data", (data) => {
    process.stdout.write(`[APP] ${data.toString()}`);
  });

  currentProcess.stderr.on("data", (data) => {
    process.stderr.write(`[APP ERR] ${data.toString()}`);
  });

  currentProcess.on("close", (code) => {
    console.log(`App process exited with code ${code}`);
  });
}

app.post("/run", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (auth !== `Bearer ${RUNNER_SECRET}`) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const { projectId, files } = req.body;

    if (!projectId || !files) {
      return res.status(400).json({
        success: false,
        error: "Missing projectId or files",
      });
    }

    const normalizedFiles = normalizeFiles(files);

    console.log("PROJECT ID:", projectId);

    console.log(
      "FILES COUNT:",
      Object.keys(normalizedFiles).length
    );

    console.log(
      "FILES SAMPLE:",
      Object.keys(normalizedFiles).slice(0, 10)
    );

    const workspacePath = path.join(
      os.tmpdir(),
      "nova-runner",
      projectId
    );

    saveFiles(workspacePath, normalizedFiles);

    const { framework, port, startCommand } =
      detectFramework(normalizedFiles);

    console.log("FRAMEWORK:", framework);

    if (!startCommand) {
      return res.status(400).json({
        success: false,
        error:
          "Could not detect how to start this project",
      });
    }

    await killCurrentProcess();

    try {
      await runCommand(npxCmd, ["kill-port", String(port)], os.tmpdir());
    } catch (e) {
      console.log(`Port ${port} might already be free or kill-port failed`);
    }

    if (framework !== "static" && framework !== "php" && framework !== "laravel") {
      console.log(
        `Installing dependencies for ${framework}...`
      );

      await runCommand(
        npmCmd,
        ["install"],
        workspacePath
      );
    }

    console.log(
      `Starting ${framework} app on port ${port}...`
    );

    startApp(
      startCommand[0],
      startCommand[1],
      workspacePath
    );

    return res.json({
      success: true,
      framework,
      port,
      previewUrl:
        PREVIEW_PUBLIC_URL ||
        `http://localhost:${port}`,
      message:
        "Project started successfully",
    });
  } catch (error) {
    console.error("Runner error:", error);

    return res.status(500).json({
      success: false,
      error: String(error.message || error),
      logs: error.logs || "No additional logs available.",
    });
  }
});

app.listen(3000, () => {
  console.log(
    "Runner API running on http://localhost:3000"
  );
});