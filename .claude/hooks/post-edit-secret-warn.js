#!/usr/bin/env node
const path = require("path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = (event.tool_input?.file_path || "").replace(/\\/g, "/");
    const fileName = path.basename(filePath);

    // Skip .env.example — expected to have placeholder values
    if (fileName === ".env.example") {
      process.exit(0);
    }

    const newContent =
      event.tool_input?.new_string || event.tool_input?.content || "";

    const warnings = [];

    // API key prefixes (AWS, Stripe, OpenAI, etc.)
    if (/(sk-|pk_live_|pk_test_|AKIA)[a-zA-Z0-9]{20,}/.test(newContent)) {
      warnings.push("Possible API key detected (sk-/pk_/AKIA prefix)");
    }

    // JWT tokens
    if (/eyJ[a-zA-Z0-9_-]{30,}\.eyJ[a-zA-Z0-9_-]{10,}/.test(newContent)) {
      warnings.push("Possible JWT token detected");
    }

    // Password/secret assignments (not env var references)
    const lines = newContent.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (/^\s*(#|\/\/)/.test(line)) continue;
      // Skip env var lookups
      if (/os\.environ|os\.getenv|settings\.|process\.env/.test(line)) continue;

      if (
        /(password|secret|api_key|apikey|token|auth_token|private_key)\s*[:=]\s*["'][^"']{8,}["']/i.test(
          line
        )
      ) {
        warnings.push(
          `  line ${i + 1}: Possible hardcoded secret — ${line.trim().substring(0, 80)}`
        );
      }
    }

    // Connection strings with embedded passwords
    if (
      /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@\s]{4,}@/.test(
        newContent
      ) &&
      !/os\.environ|os\.getenv|settings\.|process\.env/.test(newContent)
    ) {
      warnings.push(
        "Possible connection string with embedded password detected"
      );
    }

    if (warnings.length > 0) {
      process.stdout.write(
        `Potential hardcoded secrets in ${filePath}:\n${warnings.join("\n")}\nUse environment variables or secret manager instead.\n`
      );
    }
  } catch {
    // Skip on parse errors
  }
});
