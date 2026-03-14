#!/usr/bin/env node
const path = require("path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = event.tool_input?.file_path || "";
    const normalized = filePath.replace(/\\/g, "/");
    const fileName = path.basename(normalized);

    // Allow .env.example
    if (fileName === ".env.example") {
      process.exit(0);
    }

    // Block .env files
    if (/^\.env($|\..*)/.test(fileName)) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `Blocked creation of ${fileName}. Use environment variables or .env.example instead.`,
        })
      );
      process.exit(2);
    }

    // Block secret/credential files
    if (
      /^credentials.*\.json$/.test(fileName) ||
      /\.(pem|key)$/.test(fileName) ||
      /^service[-_]?account.*\.json$/.test(fileName)
    ) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `Blocked creation of sensitive file: ${fileName}. Never commit secrets to the repository.`,
        })
      );
      process.exit(2);
    }
  } catch {
    // Skip on parse errors
  }
});
