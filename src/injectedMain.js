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

    const selectedProvider = settings.gifProvider || "klipy";
    const provider = url.searchParams.get("provider");
    if (["giphy", "tenor", "klipy", null].includes(provider) && provider !== selectedProvider) {
      url.searchParams.set("provider", selectedProvider);
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

    if (url.pathname === "/__trevorcord/restart") {
      app.relaunch();
      app.exit(0);
      callback({ cancel: true });
      return;
    }

    if (url.pathname === "/__trevorcord/set") {
      const settings = readSettings();
      for (const [key, value] of url.searchParams.entries()) {
        if (key === "gifProviderRewriteEnabled") {
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
  let restartRequired = false;
  let active = false;
  let previousContent = null;

  const style = document.createElement("style");
  style.id = "trevorcord-style";
  style.textContent = \`
    .tc-sidebar-header {
      color: var(--channels-default, #949ba4);
      font-size: 12px;
      font-weight: 700;
      line-height: 16px;
      padding: 6px 10px;
      text-transform: uppercase;
    }
    .tc-sidebar-item {
      align-items: center;
      border-radius: 4px;
      color: var(--interactive-normal, #b5bac1);
      cursor: pointer;
      display: flex;
      font-size: 16px;
      font-weight: 500;
      gap: 10px;
      line-height: 20px;
      margin: 2px 0;
      min-height: 32px;
      padding: 6px 10px;
      user-select: none;
    }
    .tc-sidebar-item:hover {
      background: var(--background-modifier-hover, rgba(78,80,88,.3));
      color: var(--interactive-hover, #dbdee1);
    }
    .tc-sidebar-item.tc-selected {
      background: var(--background-modifier-selected, rgba(78,80,88,.6));
      color: var(--interactive-active, #fff);
    }
    .tc-sidebar-icon {
      height: 20px;
      width: 20px;
      flex: 0 0 auto;
    }
    .tc-settings-root {
      box-sizing: border-box;
      color: var(--text-normal, #dbdee1);
      max-width: 740px;
      min-width: 460px;
      padding: 60px 40px 80px;
    }
    .tc-settings-root * {
      box-sizing: border-box;
    }
    .tc-restart-bar {
      align-items: center;
      background: var(--background-floating, #111214);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.32);
      display: none;
      gap: 16px;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 12px 14px;
    }
    .tc-restart-bar.tc-visible {
      display: flex;
    }
    .tc-restart-text {
      color: var(--text-normal, #dbdee1);
      font-size: 14px;
      font-weight: 600;
    }
    .tc-restart-button {
      background: var(--brand-500, #5865f2);
      border: 0;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      min-height: 32px;
      padding: 0 14px;
    }
    .tc-title {
      color: var(--header-primary, #f2f3f5);
      font-size: 20px;
      font-weight: 700;
      line-height: 24px;
      margin: 0 0 6px;
    }
    .tc-description {
      color: var(--text-muted, #949ba4);
      font-size: 14px;
      line-height: 20px;
      margin: 0 0 24px;
    }
    .tc-section {
      border-top: 1px solid var(--background-modifier-accent, rgba(78,80,88,.48));
      padding: 20px 0;
    }
    .tc-section-title {
      color: var(--header-secondary, #dbdee1);
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 4px;
    }
    .tc-section-description {
      color: var(--text-muted, #949ba4);
      font-size: 13px;
      line-height: 18px;
      margin: 0;
    }
    .tc-row {
      align-items: center;
      display: flex;
      gap: 20px;
      justify-content: space-between;
      margin-top: 16px;
    }
    .tc-select {
      background: var(--input-background, #1e1f22);
      border: 1px solid var(--background-modifier-accent, rgba(78,80,88,.48));
      border-radius: 4px;
      color: var(--text-normal, #dbdee1);
      min-height: 36px;
      min-width: 180px;
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
    restartRequired = true;
    updateRestartBar();
    const url = new URL("https://discord.com/__trevorcord/set");
    url.searchParams.set(key, String(value));
    fetch(url.toString()).catch(() => {});
  }

  function restartDiscord() {
    fetch("https://discord.com/__trevorcord/restart").catch(() => {});
  }

  function createToggle(key) {
    const button = document.createElement("button");
    button.className = "tc-toggle";
    button.type = "button";
    button.dataset.on = String(Boolean(state[key]));
    button.addEventListener("click", () => {
      const next = button.dataset.on !== "true";
      button.dataset.on = String(next);
      save(key, next);
    });
    return button;
  }

  function elementHasOwnText(element, expectedText) {
    return Array.from(element.childNodes).some(node => (
      node.nodeType === Node.TEXT_NODE && node.textContent.trim() === expectedText
    ));
  }

  function findElementByOwnText(expectedText) {
    return Array.from(document.querySelectorAll("div, span, h1, h2, h3")).find(element => (
      elementHasOwnText(element, expectedText)
    ));
  }

  function looksLikeSettingsSidebar(element) {
    const text = element.textContent || "";
    const rect = element.getBoundingClientRect();
    return rect.width >= 180 && rect.width <= 520 && (
      text.includes("My Account") ||
      text.includes("Vencord Settings") ||
      text.includes("Billing")
    );
  }

  function findSettingsSidebar() {
    const classCandidates = Array.from(document.querySelectorAll('[class*="sidebar"], [class*="Sidebar"]'));
    const classMatch = classCandidates.find(looksLikeSettingsSidebar);
    if (classMatch) return classMatch;

    const marker = findElementByOwnText("Vencord Settings") || findElementByOwnText("Billing");
    let cursor = marker;
    while (cursor && cursor !== document.body) {
      if (looksLikeSettingsSidebar(cursor)) return cursor;
      cursor = cursor.parentElement;
    }
    return null;
  }

  function findSettingsContent() {
    const selectors = [
      '[class*="contentColumn"]',
      '[class*="contentRegion"] [class*="contentColumn"]',
      '[class*="standardSidebarView"] main',
    ];

    for (const selector of selectors) {
      const candidates = Array.from(document.querySelectorAll(selector));
      const match = candidates.find(candidate => candidate.getBoundingClientRect().width > 300);
      if (match) return match;
    }
    return null;
  }

  function directChildUnder(parent, child) {
    let cursor = child;
    while (cursor?.parentElement && cursor.parentElement !== parent) {
      cursor = cursor.parentElement;
    }
    return cursor?.parentElement === parent ? cursor : null;
  }

  function clearSelectedSidebarItems(sidebar) {
    sidebar.querySelectorAll(".tc-sidebar-item.tc-selected").forEach(item => item.classList.remove("tc-selected"));
  }

  function updateRestartBar() {
    const bar = document.querySelector(".tc-restart-bar");
    if (!bar) return;
    bar.classList.toggle("tc-visible", restartRequired);
  }

  function renderTrevorCordPage(content) {
    if (!content) return;
    if (!previousContent) previousContent = Array.from(content.childNodes);
    content.replaceChildren();

    const root = document.createElement("section");
    root.className = "tc-settings-root";
    root.innerHTML =
      '<div class="tc-restart-bar">' +
        '<div class="tc-restart-text">Restart Discord to apply TrevorCord changes.</div>' +
        '<button class="tc-restart-button" type="button">Restart</button>' +
      '</div>' +
      '<h2 class="tc-title">TrevorCord</h2>' +
      '<p class="tc-description">Configure TrevorCord features. More modules can be added here as the mod grows.</p>' +
      '<section class="tc-section">' +
        '<h3 class="tc-section-title">GIF Search Engine</h3>' +
        '<p class="tc-section-description">Route Discord GIF search requests through the selected provider.</p>' +
        '<div class="tc-row">' +
          '<div>' +
            '<div class="tc-section-title">Enable provider rewrite</div>' +
            '<p class="tc-section-description">When enabled, Giphy or Tenor GIF searches are redirected to your selected engine.</p>' +
          '</div>' +
          '<span data-slot="rewrite-toggle"></span>' +
        '</div>' +
        '<div class="tc-row">' +
          '<div>' +
            '<div class="tc-section-title">Provider</div>' +
            '<p class="tc-section-description">Klipy is the default replacement.</p>' +
          '</div>' +
          '<select class="tc-select" data-slot="provider"></select>' +
        '</div>' +
      '</section>';

    root.querySelector(".tc-restart-button").addEventListener("click", restartDiscord);
    root.querySelector('[data-slot="rewrite-toggle"]').appendChild(createToggle("gifProviderRewriteEnabled"));
    const providerSelect = root.querySelector('[data-slot="provider"]');
    for (const provider of providers) {
      const option = document.createElement("option");
      option.value = provider;
      option.textContent = provider[0].toUpperCase() + provider.slice(1);
      option.selected = provider === state.gifProvider;
      providerSelect.appendChild(option);
    }
    providerSelect.addEventListener("change", () => save("gifProvider", providerSelect.value));

    content.appendChild(root);
    updateRestartBar();
  }

  function restoreDiscordSettingsPage(content) {
    if (!content || !previousContent) return;
    content.replaceChildren(...previousContent);
    previousContent = null;
    active = false;
  }

  function makeSidebarEntry(sidebar) {
    if (sidebar.querySelector('[data-trevorcord-sidebar="true"]')) return;

    const header = document.createElement("div");
    header.className = "tc-sidebar-header";
    header.dataset.trevorcordSidebar = "true";
    header.textContent = "TrevorCord";

    const item = document.createElement("div");
    item.className = "tc-sidebar-item";
    item.dataset.trevorcordSidebar = "true";
    item.setAttribute("role", "button");
    item.tabIndex = 0;
    item.innerHTML =
      '<svg class="tc-sidebar-icon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.61-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.56 9.56 0 0 1 12 6.84c.85 0 1.71.11 2.51.33 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>' +
      '</svg>' +
      '<span>TrevorCord</span>';

    const activate = () => {
      active = true;
      clearSelectedSidebarItems(sidebar);
      item.classList.add("tc-selected");
      renderTrevorCordPage(findSettingsContent());
    };
    item.addEventListener("click", activate);
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });

    const billingAnchor = directChildUnder(sidebar, findElementByOwnText("Billing"));
    const insertBefore = billingAnchor || Array.from(sidebar.children).find(child => /logout/i.test(child.textContent || ""));
    sidebar.insertBefore(header, insertBefore || null);
    sidebar.insertBefore(item, insertBefore || null);
  }

  function syncSettingsInjection() {
    const sidebar = findSettingsSidebar();
    if (sidebar) makeSidebarEntry(sidebar);

    const content = findSettingsContent();
    if (content && active && !document.body.contains(content.querySelector(".tc-settings-root"))) {
      renderTrevorCordPage(content);
    }
  }

  document.addEventListener("click", event => {
    if (active && !event.target.closest('[data-trevorcord-sidebar="true"]') && event.target.closest('[class*="sidebar"]')) {
      restoreDiscordSettingsPage(findSettingsContent());
    }
  }, true);

  new MutationObserver(syncSettingsInjection).observe(document.body, { childList: true, subtree: true });
  syncSettingsInjection();
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
