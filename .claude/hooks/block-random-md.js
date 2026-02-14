#!/usr/bin/env node
const path = require("path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = event.tool_input?.file_path || "";

    if (!filePath.endsWith(".md")) {
      process.exit(0);
    }

    const normalized = filePath.replace(/\\/g, "/");
    const fileName = path.basename(normalized);

    const allowed =
      normalized.includes("/docs/") ||
      normalized.includes("/.claude/") ||
      fileName === "README.md" ||
      fileName === "CLAUDE.md";

    if (!allowed) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `Markdown files must be created in docs/, .claude/, or as README.md/CLAUDE.md. Got: ${fileName}`,
        })
      );
      process.exit(2);
    }
  } catch {
    // Skip on parse errors
  }
});
