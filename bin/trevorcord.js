#!/usr/bin/env node

const {
  install,
  restore,
  status,
  setOption,
  printHelp,
} = require("../src/patcher");

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "install":
    case "patch":
      await install();
      break;
    case "restore":
    case "uninstall":
      await restore();
      break;
    case "status":
      await status();
      break;
    case "set":
      await setOption(args[0], args[1]);
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
