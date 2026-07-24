const { app, BrowserWindow, shell, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

const DEV_SERVER_URL =
  process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173";

function resolveApiConfigPaths() {
  const exeDir = path.dirname(app.getPath("exe"));
  const programData = process.env.PROGRAMDATA || process.env.ProgramData || "";
  return [
    path.join(exeDir, "api-config.json"),
    path.join(exeDir, "..", "api-config.json"),
    path.join(exeDir, "..", "..", "api-config.json"),
    programData ? path.join(programData, "PPMP System", "api-config.json") : null,
  ].filter(Boolean);
}

function readApiBaseFromConfig() {
  for (const candidate of resolveApiConfigPaths()) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw);
      const base = (parsed.apiBaseUrl || parsed.api_base_url || "").trim();
      if (base) return base.replace(/\/$/, "");
    } catch (_) {
      // try next candidate
    }
  }
  return "";
}

function getApiBaseUrl() {
  const fromEnv = (process.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");
  const fromFile = readApiBaseFromConfig();
  return fromFile || fromEnv || "http://127.0.0.1:8000";
}

ipcMain.handle("ppmp:get-app-version", () => app.getVersion());
ipcMain.handle("ppmp:get-api-base-url", () => getApiBaseUrl());

function resolveAppIcon() {
  // Packaged: Vite copies public/ into dist/
  const packaged = path.join(__dirname, "..", "dist", "Ormoc_City.png");
  const fromPublic = path.join(__dirname, "..", "public", "Ormoc_City.png");
  if (fs.existsSync(packaged)) return packaged;
  if (fs.existsSync(fromPublic)) return fromPublic;
  return undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "PPMP System",
    icon: resolveAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Open http(s) links in the system browser instead of inside Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (!app.isPackaged) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
