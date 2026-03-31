const { spawn } = require("child_process");

// Run adb-connect with keepalive in background
const keepalive = spawn("node", ["scripts/adb-connect.js", "--keepalive"], {
  stdio: "inherit",
  detached: false,
});

// Start expo
const expo = spawn("npx", ["expo", "start", "--dev-client"], {
  stdio: "inherit",
  shell: true,
});

expo.on("exit", (code) => {
  keepalive.kill();
  process.exit(code);
});

process.on("SIGINT", () => {
  keepalive.kill();
  expo.kill();
});
