const { execSync, spawn } = require("child_process");

const PHONE_IP = process.env.PHONE_IP || "192.168.178.62";
const PHONE_PORT = "5555";
const PORTS = [8081, 8000];
const KEEPALIVE = process.argv.includes("--keepalive");
const CHECK_INTERVAL = 15_000;

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return "";
  }
}

function getPhoneSerial() {
  const wireless = `${PHONE_IP}:${PHONE_PORT}`;
  const devices = run("adb devices");

  if (devices.includes(`${wireless}\tdevice`)) {
    return wireless;
  }

  const result = run(`adb connect ${wireless}`);
  if (result.includes("connected")) {
    return wireless;
  }

  const lines = devices.split("\n").filter((l) => l.includes("\tdevice"));
  const usb = lines.find((l) => !l.startsWith("emulator-"));
  if (usb) {
    return usb.split("\t")[0];
  }

  return null;
}

function setupReverse(serial) {
  for (const port of PORTS) {
    const result = run(`adb -s ${serial} reverse tcp:${port} tcp:${port}`);
    console.log(`[adb-connect] Reverse tcp:${port} → ${result || "ok"}`);
  }
}

const serial = getPhoneSerial();
if (!serial) {
  console.log("[adb-connect] No physical device found, skipping.");
  process.exit(0);
}

console.log(`[adb-connect] Device: ${serial}`);
setupReverse(serial);

if (KEEPALIVE) {
  console.log(`[adb-keepalive] Watching every ${CHECK_INTERVAL / 1000}s`);
  setInterval(() => {
    const devices = run("adb devices");
    if (!devices.includes(`${PHONE_IP}:${PHONE_PORT}\tdevice`)) {
      console.log(`[adb-keepalive] Connection lost, reconnecting...`);
      run(`adb connect ${PHONE_IP}:${PHONE_PORT}`);
      setupReverse(`${PHONE_IP}:${PHONE_PORT}`);
    }
  }, CHECK_INTERVAL);
}
