const { execSync } = require("child_process");

const PHONE_IP = process.env.PHONE_IP || "192.168.178.62";
const PHONE_PORT = "5555";
const PORTS = [8081, 8000];

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function getPhoneSerial() {
  // Try wireless first
  const wireless = `${PHONE_IP}:${PHONE_PORT}`;
  const devices = run("adb devices");

  if (devices.includes(`${wireless}\tdevice`)) {
    return wireless;
  }

  // Try connecting wirelessly
  const result = run(`adb connect ${wireless}`);
  if (result.includes("connected")) {
    return wireless;
  }

  // Fall back to USB-connected device (skip emulators)
  const lines = devices.split("\n").filter((l) => l.includes("\tdevice"));
  const usb = lines.find((l) => !l.startsWith("emulator-"));
  if (usb) {
    return usb.split("\t")[0];
  }

  return null;
}

const serial = getPhoneSerial();
if (!serial) {
  console.log("[adb-connect] No physical device found, skipping.");
  process.exit(0);
}

console.log(`[adb-connect] Device: ${serial}`);

for (const port of PORTS) {
  const result = run(`adb -s ${serial} reverse tcp:${port} tcp:${port}`);
  console.log(`[adb-connect] Reverse tcp:${port} → ${result || "ok"}`);
}
