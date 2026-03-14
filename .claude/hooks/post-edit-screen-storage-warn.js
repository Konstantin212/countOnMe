#!/usr/bin/env node

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = (event.tool_input?.file_path || "").replace(/\\/g, "/");

    if (!/\.(ts|tsx)$/.test(filePath)) {
      process.exit(0);
    }

    // Only check screen files
    if (!filePath.includes("/screens/")) {
      process.exit(0);
    }

    const newContent =
      event.tool_input?.new_string || event.tool_input?.content || "";

    if (
      /import.*AsyncStorage/.test(newContent) ||
      /from\s+['"]@storage\/storage['"]/.test(newContent) ||
      /from\s+['"].*storage['"]/.test(newContent)
    ) {
      process.stdout.write(
        `Direct storage import in screen ${filePath}. Screens should use hooks, not AsyncStorage directly.\n`
      );
    }
  } catch {
    // Skip on parse errors
  }
});
