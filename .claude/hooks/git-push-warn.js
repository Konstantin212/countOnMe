#!/usr/bin/env node

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const command = event.tool_input?.command || "";

    if (!/git\s+push/.test(command)) {
      process.exit(0);
    }

    if (/--force|-f\b/.test(command)) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason:
            "Force push is blocked. Use regular push or ask user for explicit permission.",
        })
      );
      process.exit(2);
    }

    process.stdout.write(
      JSON.stringify({
        decision: "ask",
        reason: `About to run: ${command}`,
      })
    );
  } catch {
    // Skip on parse errors
  }
});
