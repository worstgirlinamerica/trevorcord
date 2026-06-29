;(() => {
  const MARKER = "trevorcord-main-v0.1.0";
  if (globalThis.__TREVORCORD_INSTALLED__) return;
  globalThis.__TREVORCORD_INSTALLED__ = MARKER;

  const fs = require("fs");
  const path = require("path");
  const { app, BrowserWindow, session } = require("electron");

  const DEFAULT_SETTINGS = {
    gifProviderRewriteEnabled: true,
    gifProvider: "klipy",
    showSettingsButton: true,
  };

  function getSettingsPath() {
    return path.join(app.getPath("userData"), "trevorcord", "settings.json");
  }

  function readSettings() {
    const settingsPath = getSettingsPath();
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsPath, "utf8")) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function writeSettings(nextSettings) {
    const settingsPath = getSettingsPath();
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, `${JSON.stringify({ ...DEFAULT_SETTINGS, ...nextSettings }, null, 2)}\n`);
  }

  function rewriteGifProvider(urlString) {
    const settings = readSettings();
    if (!settings.gifProviderRewriteEnabled) return urlString;

    let url;
    try {
      url = new URL(urlString);
    } catch {
      return urlString;
    }

    if (!/\/(?:api\/)?v\d+\/gifs\//.test(url.pathname) && !/\/gifs\//.test(url.pathname)) {
      return urlString;
    }

    const provider = url.searchParams.get("provider");
    if (provider === "giphy" || provider === "tenor") {
      url.searchParams.set("provider", settings.gifProvider || "klipy");
      return url.toString();
    }

    return urlString;
  }

  function handleTrevorCordRequest(details, callback) {
    let url;
    try {
      url = new URL(details.url);
    } catch {
      callback({ cancel: true });
      return;
    }

    if (url.pathname === "/__trevorcord/set") {
      const settings = readSettings();
      for (const [key, value] of url.searchParams.entries()) {
        if (key === "gifProviderRewriteEnabled" || key === "showSettingsButton") {
          settings[key] = value === "true";
        } else if (key === "gifProvider") {
          settings[key] = value;
        }
      }
      writeSettings(settings);
    }

    callback({ cancel: true });
  }

  function rendererScript(settings) {
    return `
(() => {
  if (window.__TREVORCORD_RENDERER__) return;
  window.__TREVORCORD_RENDERER__ = true;

  const state = ${JSON.stringify(settings)};
  const providers = ["klipy", "tenor", "giphy"];

  const style = document.createElement("style");
  style.id = "trevorcord-style";
  style.textContent = \`
    .tc-button {
      position: fixed;
      left: 12px;
      bottom: 12px;
      z-index: 2147483647;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.12);
      background: #2b2d31;
      color: #f2f3f5;
      font: 700 13px/1 system-ui, sans-serif;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,.25);
    }
    .tc-panel {
      position: fixed;
      z-index: 2147483647;
      inset: auto auto 58px 12px;
      width: 340px;
      max-width: calc(100vw - 24px);
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.12);
      background: #313338;
      color: #f2f3f5;
      font: 14px system-ui, sans-serif;
      box-shadow: 0 18px 50px rgba(0,0,0,.42);
      padding: 16px;
    }
    .tc-panel[hidden] { display: none; }
    .tc-title { font-size: 18px; font-weight: 700; margin: 0 0 14px; }
    .tc-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 12px 0; }
    .tc-label { color: #dbdee1; font-weight: 600; }
    .tc-muted { color: #b5bac1; font-size: 12px; margin-top: 4px; }
    .tc-select {
      background: #1e1f22;
      color: #f2f3f5;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 6px;
      padding: 7px 9px;
    }
    .tc-toggle {
      width: 42px;
      height: 24px;
      border-radius: 999px;
      border: 0;
      background: #4e5058;
      padding: 3px;
      cursor: pointer;
    }
    .tc-toggle::before {
      content: "";
      display: block;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      transition: transform .12s ease;
    }
    .tc-toggle[data-on="true"] { background: #5865f2; }
    .tc-toggle[data-on="true"]::before { transform: translateX(18px); }
  \`;
  document.documentElement.appendChild(style);

  function save(key, value) {
    state[key] = value;
    const url = new URL("https://discord.com/__trevorcord/set");
    url.searchParams.set(key, String(value));
    fetch(url.toString()).catch(() => {});
  }

  function createToggle(key) {
    const button = document.createElement("button");
    button.className = "tc-toggle";
    button.dataset.on = String(Boolean(state[key]));
    button.addEventListener("click", () => {
      const next = button.dataset.on !== "true";
      button.dataset.on = String(next);
      save(key, next);
    });
    return button;
  }

  const openButton = document.createElement("button");
  openButton.className = "tc-button";
  openButton.type = "button";
  openButton.textContent = "TC";
  openButton.title = "TrevorCord";

  const panel = document.createElement("section");
  panel.className = "tc-panel";
  panel.hidden = true;
  panel.innerHTML = \`
    <h2 class="tc-title">TrevorCord</h2>
    <div class="tc-row">
      <div>
        <div class="tc-label">GIF provider rewrite</div>
        <div class="tc-muted">Routes Discord GIF search requests to your selected provider.</div>
      </div>
      <span data-slot="rewrite-toggle"></span>
    </div>
    <div class="tc-row">
      <div>
        <div class="tc-label">Search provider</div>
        <div class="tc-muted">Klipy is the default replacement.</div>
      </div>
      <select class="tc-select" data-slot="provider"></select>
    </div>
  \`;

  panel.querySelector('[data-slot="rewrite-toggle"]').appendChild(createToggle("gifProviderRewriteEnabled"));
  const providerSelect = panel.querySelector('[data-slot="provider"]');
  for (const provider of providers) {
    const option = document.createElement("option");
    option.value = provider;
    option.textContent = provider[0].toUpperCase() + provider.slice(1);
    option.selected = provider === state.gifProvider;
    providerSelect.appendChild(option);
  }
  providerSelect.addEventListener("change", () => save("gifProvider", providerSelect.value));

  openButton.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });

  if (state.showSettingsButton !== false) {
    document.body.appendChild(openButton);
    document.body.appendChild(panel);
  }
})();
`;
  }

  function injectRenderer(win) {
    if (!win || win.isDestroyed() || !win.webContents || win.__trevorcordInjected) return;
    win.__trevorcordInjected = true;

    const run = () => {
      if (win.isDestroyed()) return;
      win.webContents.executeJavaScript(rendererScript(readSettings()), true).catch(() => {});
    };

    win.webContents.on("dom-ready", run);
    win.webContents.on("did-navigate", run);
    win.webContents.on("did-navigate-in-page", run);
    run();
  }

  app.whenReady().then(() => {
    writeSettings(readSettings());

    session.defaultSession.webRequest.onBeforeRequest(
      {
        urls: [
          "https://discord.com/__trevorcord/*",
          "https://discord.com/api/*/gifs/*",
          "https://discordapp.com/api/*/gifs/*",
          "https://canary.discord.com/api/*/gifs/*",
          "https://ptb.discord.com/api/*/gifs/*",
        ],
      },
      (details, callback) => {
        if (details.url.includes("/__trevorcord/")) {
          handleTrevorCordRequest(details, callback);
          return;
        }

        const redirectURL = rewriteGifProvider(details.url);
        callback(redirectURL === details.url ? {} : { redirectURL });
      }
    );

    const originalBrowserWindow = BrowserWindow;
    setInterval(() => {
      for (const win of originalBrowserWindow.getAllWindows()) injectRenderer(win);
    }, 1500);
  });
})();
