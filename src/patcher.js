const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PATCH_MARKER = "trevorcord-main-v0.1.0";
const BACKUP_SUFFIX = ".pre-trevorcord";
const injectedMain = fs.readFileSync(path.join(__dirname, "injectedMain.js"), "utf8");

function candidateDiscordDataDirs() {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return [
      path.join(home, "Library/Application Support/discord"),
      path.join(home, "Library/Application Support/Discord"),
      path.join(home, "Library/Application Support/discordcanary"),
      path.join(home, "Library/Application Support/discordptb"),
    ];
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData/Roaming");
    return [
      path.join(appData, "discord"),
      path.join(appData, "Discord"),
      path.join(appData, "discordcanary"),
      path.join(appData, "discordptb"),
    ];
  }
  return [
    path.join(home, ".config/discord"),
    path.join(home, ".config/Discord"),
    path.join(home, ".config/discordcanary"),
    path.join(home, ".config/discordptb"),
  ];
}

function findCoreAsars() {
  const found = new Map();
  for (const dataDir of candidateDiscordDataDirs()) {
    if (!fs.existsSync(dataDir)) continue;

    const appDirs = fs
      .readdirSync(dataDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^app-\d+\.\d+\.\d+/.test(entry.name))
      .map(entry => path.join(dataDir, entry.name));

    for (const appDir of appDirs) {
      const modulesDir = path.join(appDir, "modules");
      if (!fs.existsSync(modulesDir)) continue;
      for (const moduleDir of fs.readdirSync(modulesDir, { withFileTypes: true })) {
        if (!moduleDir.isDirectory() || !moduleDir.name.startsWith("discord_desktop_core-")) continue;
        const coreAsar = path.join(
          modulesDir,
          moduleDir.name,
          "discord_desktop_core",
          "core.asar"
        );
        if (fs.existsSync(coreAsar)) {
          const stat = fs.statSync(coreAsar);
          found.set(`${stat.dev}:${stat.ino}`, coreAsar);
        }
      }
    }
  }
  return [...found.values()];
}

function readAsar(asarPath) {
  const archive = fs.readFileSync(asarPath);
  const headerSize = archive.readUInt32LE(4);
  const jsonSize = archive.readUInt32LE(12);
  const header = JSON.parse(archive.slice(16, 16 + jsonSize).toString());
  const dataStart = 8 + headerSize;
  const files = {};

  function walk(entries, prefix) {
    for (const [name, entry] of Object.entries(entries)) {
      const relativePath = path.posix.join(prefix, name);
      if (entry.files) {
        walk(entry.files, relativePath);
        continue;
      }
      const offset = dataStart + Number(entry.offset || 0);
      files[relativePath] = archive.slice(offset, offset + entry.size);
    }
  }

  walk(header.files, "");
  return files;
}

function integrityFor(buffer) {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return {
    algorithm: "SHA256",
    hash,
    blockSize: 4194304,
    blocks: [hash],
  };
}

function buildHeader(files) {
  let offset = 0;
  const root = { files: {} };

  for (const [relativePath, buffer] of Object.entries(files)) {
    const parts = relativePath.split("/");
    let cursor = root.files;
    for (const part of parts.slice(0, -1)) {
      cursor[part] ||= { files: {} };
      cursor = cursor[part].files;
    }
    cursor[parts.at(-1)] = {
      size: buffer.length,
      offset: String(offset),
      integrity: integrityFor(buffer),
    };
    offset += buffer.length;
  }

  return root;
}

function packAsar(files) {
  const headerBuffer = Buffer.from(JSON.stringify(buildHeader(files)));
  const headerPayloadSize = 8 + headerBuffer.length;
  const headerSize = headerPayloadSize + ((4 - (headerPayloadSize % 4)) % 4);

  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(headerSize, 4);
  prefix.writeUInt32LE(headerSize - 4, 8);
  prefix.writeUInt32LE(headerBuffer.length, 12);

  return Buffer.concat([
    prefix,
    headerBuffer,
    Buffer.alloc(headerSize - 8 - headerBuffer.length),
    ...Object.values(files),
  ]);
}

function patchAsar(asarPath) {
  const backupPath = `${asarPath}${BACKUP_SUFFIX}`;
  if (!fs.existsSync(backupPath)) fs.copyFileSync(asarPath, backupPath);

  let files = readAsar(asarPath);
  const bundleBuffer = files["bundle.js"];
  if (!bundleBuffer) throw new Error(`No bundle.js found in ${asarPath}`);

  const bundle = bundleBuffer.toString();
  let result = "patched";
  if (bundle.includes(PATCH_MARKER)) {
    files = readAsar(backupPath);
    result = "updated";
  }
  const baseBundle = files["bundle.js"].toString();
  if (!baseBundle.startsWith("(()=>{")) {
    throw new Error(`Unexpected bundle shape in ${asarPath}`);
  }

  files["bundle.js"] = Buffer.from(baseBundle.replace("(()=>{", `(()=>{\n${injectedMain}\n`));
  fs.writeFileSync(asarPath, packAsar(files));
  return result;
}

function restoreAsar(asarPath) {
  const backupPath = `${asarPath}${BACKUP_SUFFIX}`;
  if (!fs.existsSync(backupPath)) return "no-backup";
  fs.copyFileSync(backupPath, asarPath);
  return "restored";
}

async function install() {
  const asars = findCoreAsars();
  if (!asars.length) throw new Error("Could not find a Discord desktop core.asar to patch.");

  for (const asarPath of asars) {
    console.log(`${patchAsar(asarPath)}: ${asarPath}`);
  }
  console.log("Restart Discord completely to load TrevorCord.");
}

async function restore() {
  const asars = findCoreAsars();
  if (!asars.length) throw new Error("Could not find a Discord desktop core.asar to restore.");

  for (const asarPath of asars) {
    console.log(`${restoreAsar(asarPath)}: ${asarPath}`);
  }
  console.log("Restart Discord completely to unload TrevorCord.");
}

async function status() {
  const asars = findCoreAsars();
  if (!asars.length) {
    console.log("No Discord desktop core.asar found.");
    return;
  }

  for (const asarPath of asars) {
    const files = readAsar(asarPath);
    const patched = files["bundle.js"]?.toString().includes(PATCH_MARKER) || false;
    const backup = fs.existsSync(`${asarPath}${BACKUP_SUFFIX}`);
    console.log(JSON.stringify({ asarPath, patched, backup }, null, 2));
  }
}

async function setOption(key, value) {
  if (!key) throw new Error("Usage: trevorcord set <key> <value>");

  const dataDir = candidateDiscordDataDirs().find(fs.existsSync);
  if (!dataDir) throw new Error("Could not find a Discord data directory.");
  const settingsPath = path.join(dataDir, "trevorcord", "settings.json");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {}

  if (value === "true") settings[key] = true;
  else if (value === "false") settings[key] = false;
  else settings[key] = value;

  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  console.log(`Updated ${settingsPath}`);
}

function printHelp() {
  console.log(`TrevorCord

Commands:
  install       Patch Discord desktop core
  restore       Restore from .pre-trevorcord backup
  status        Show patch status
  set k v       Edit a stored setting before/after install

Settings:
  gifProviderRewriteEnabled true|false
  gifProvider klipy|tenor|giphy
  showSettingsButton true|false`);
}

module.exports = {
  install,
  restore,
  status,
  setOption,
  printHelp,
};
