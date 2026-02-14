#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

const THRESHOLD = 50;

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const sessionId = event.session_id || "default";
    const counterFile = path.join(
      os.tmpdir(),
      `claude-compact-${sessionId}.json`
    );

    let data = { count: 0, suggested: false };
    try {
      data = JSON.parse(fs.readFileSync(counterFile, "utf8"));
    } catch {
      // File doesn't exist yet
    }

    data.count += 1;

    if (data.count >= THRESHOLD && !data.suggested) {
      data.suggested = true;
      fs.writeFileSync(counterFile, JSON.stringify(data));
      process.stderr.write(
        "Hint: 50+ tool calls this session. Consider /compact to free context.\n"
      );
      process.exit(0);
    }

    fs.writeFileSync(counterFile, JSON.stringify(data));
  } catch {
    // Skip on errors
  }
});
