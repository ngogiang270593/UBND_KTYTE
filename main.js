const { app, BrowserWindow, session, dialog } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

let backendProcess;

function getBackendPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, "publish", "backend", "backend.exe");
  }

  return path.join(process.resourcesPath, "backend", "backend.exe");
}

function waitForBackend(timeoutMs = 60000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (backendProcess?.exitCode !== null) {
        reject(new Error(`Backend đã dừng với mã ${backendProcess.exitCode}`));
        return;
      }

      const request = http.get("http://127.0.0.1:5022/swagger/index.html", (response) => {
        response.resume();
        resolve();
      });

      request.setTimeout(2000, () => request.destroy());
      request.on("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("Backend không phản hồi tại cổng 5022 sau 60 giây"));
          return;
        }

        setTimeout(check, 500);
      });
    };

    check();
  });
}

function getIndexPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, "frontend", "dist", "index.html");
  }

  return path.join(app.getAppPath(), "frontend", "dist", "index.html");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.ico"),
  });

  win.loadFile(getIndexPath());

  // win.webContents.openDevTools();
}

app.whenReady().then(async () => {
  await session.defaultSession.clearStorageData({
    storages: ["localstorage", "sessionstorage"],
  });

  const backendPath = getBackendPath();

  console.log("Backend path:", backendPath);
  console.log("Backend exists:", fs.existsSync(backendPath));

  if (!fs.existsSync(backendPath)) {
    console.error("Không tìm thấy backend.exe");
    createWindow();
    return;
  }

  backendProcess = spawn(backendPath, [], {
    windowsHide: true,
    cwd: path.dirname(backendPath),
    env: {
      ...process.env,
      ASPNETCORE_URLS: "http://127.0.0.1:5022",
      UBND_KTYTE_DATA_PROFILE: "desktop",
      UBND_KTYTE_DATA_DIR: app.getPath("userData"),
    },
  });

  backendProcess.stdout.on("data", (data) => {
    console.log("[backend]", data.toString());
  });

  backendProcess.stderr.on("data", (data) => {
    console.error("[backend error]", data.toString());
  });

  backendProcess.on("error", (err) => {
    console.error("Spawn backend lỗi:", err);
  });

  backendProcess.on("exit", (code) => {
    console.log("Backend đã tắt, code:", code);
  });

  try {
    await waitForBackend();
    createWindow();
  } catch (error) {
    console.error("Backend không khởi động được:", error);
    dialog.showErrorBox(
      "Không thể khởi động backend",
      `${error.message}\n\nĐường dẫn: ${backendPath}`
    );
    app.quit();
  }
});

app.on("window-all-closed", async () => {
  await session.defaultSession.clearStorageData({
    storages: ["localstorage", "sessionstorage"],
  });

  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }

  app.quit();
});
