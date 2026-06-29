const statusDot = document.getElementById("statusDot");
const statusTitle = document.getElementById("statusTitle");
const statusSubtitle = document.getElementById("statusSubtitle");
const logOutput = document.getElementById("logOutput");
const installButton = document.getElementById("installButton");
const restoreButton = document.getElementById("restoreButton");
const refreshButton = document.getElementById("refreshButton");
const repoButton = document.getElementById("repoButton");

function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  logOutput.textContent += `[${timestamp}] ${message}\n`;
  logOutput.scrollTop = logOutput.scrollHeight;
}

function setStatus(kind, title, subtitle) {
  statusDot.className = `status-dot ${kind}`;
  statusTitle.textContent = title;
  statusSubtitle.textContent = subtitle;
}

async function refreshStatus() {
  try {
    const entries = await window.TrevorCordInstaller.status();
    if (!entries.length) {
      setStatus("bad", "Discord not found", "Open Discord once, then run the installer again.");
      log("No Discord core.asar targets were found.");
      return;
    }

    const patched = entries.some(entry => entry.patched);
    const backups = entries.some(entry => entry.backup);
    setStatus(
      patched ? "ok" : "warn",
      patched ? "TrevorCord is installed" : "Ready to patch",
      `${entries.length} Discord install target${entries.length === 1 ? "" : "s"} found${backups ? ", backup available" : ""}.`
    );
    log(JSON.stringify(entries, null, 2));
  } catch (error) {
    setStatus("bad", "Status check failed", error.message || String(error));
    log(error.stack || error.message || String(error));
  }
}

async function runAction(label, action) {
  for (const button of [installButton, restoreButton, refreshButton]) button.disabled = true;
  try {
    log(`${label} started.`);
    const result = await action();
    log(JSON.stringify(result, null, 2));
    log(`${label} finished. Fully quit and reopen Discord.`);
    await refreshStatus();
  } catch (error) {
    setStatus("bad", `${label} failed`, error.message || String(error));
    log(error.stack || error.message || String(error));
  } finally {
    for (const button of [installButton, restoreButton, refreshButton]) button.disabled = false;
  }
}

installButton.addEventListener("click", () => runAction("Patch", () => window.TrevorCordInstaller.install()));
restoreButton.addEventListener("click", () => runAction("Restore", () => window.TrevorCordInstaller.restore()));
refreshButton.addEventListener("click", refreshStatus);
repoButton.addEventListener("click", () => {
  window.TrevorCordInstaller.openExternal("https://github.com/worstgirlinamerica/trevorcord");
});

refreshStatus();
