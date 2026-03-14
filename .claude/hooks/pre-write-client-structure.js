#!/usr/bin/env node
const path = require("path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = (event.tool_input?.file_path || "").replace(/\\/g, "/");

    // Only enforce for client/src/ files
    if (!filePath.includes("client/src/")) {
      process.exit(0);
    }

    // Skip test files and config files
    if (
      /\.(test|spec)\.(ts|tsx)$/.test(filePath) ||
      /\.config\.(ts|js)$/.test(filePath)
    ) {
      process.exit(0);
    }

    // Extract the path relative to client/src/
    const match = filePath.match(/client\/src\/(.+)/);
    if (!match) {
      process.exit(0);
    }

    const relative = match[1];

    // Allowed top-level directories in client/src/
    const allowedDirs = [
      "app", // Navigation setup
      "components", // Shared UI components (molecules)
      "hooks", // Custom React hooks
      "models", // TypeScript types
      "particles", // Atomic UI primitives (atoms)
      "screens", // Screen components (organisms)
      "services", // API, utils, schemas, constants
      "storage", // AsyncStorage + device identity
      "theme", // Colors, theming
    ];

    const topDir = relative.split("/")[0];

    // Allow files directly in client/src/ (e.g., App.tsx)
    if (!relative.includes("/")) {
      process.exit(0);
    }

    if (!allowedDirs.includes(topDir)) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `File "${relative}" is outside allowed client/src/ directories. Allowed: ${allowedDirs.join(", ")}. Move to the appropriate directory per project structure.`,
        }),
      );
      process.exit(2);
    }

    // Enforce file placement rules
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);

    // Hooks must be in hooks/ and prefixed with "use"
    if (
      topDir === "hooks" &&
      ext === ".ts" &&
      !fileName.startsWith("use") &&
      fileName !== "index.ts"
    ) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `Hook file "${fileName}" must be prefixed with "use" (e.g., useProducts.ts).`,
        }),
      );
      process.exit(2);
    }

    // Screens must be .tsx
    if (topDir === "screens" && ext === ".ts" && !fileName.endsWith(".ts")) {
      // Allow .ts for non-component files like context.tsx
      // This is fine, just a naming hint
    }

    // Particles must be .tsx and PascalCase
    if (topDir === "particles" && (ext === ".tsx" || ext === ".ts")) {
      if (
        fileName !== "index.ts" &&
        fileName !== "index.tsx" &&
        /^[a-z]/.test(fileName)
      ) {
        process.stdout.write(
          JSON.stringify({
            decision: "block",
            reason: `Particle "${fileName}" must use PascalCase (e.g., FormField.tsx, not formField.tsx).`,
          }),
        );
        process.exit(2);
      }
    }

    // Types should go in models/types.ts, not scattered files
    if (
      topDir === "models" &&
      fileName !== "types.ts" &&
      fileName !== "index.ts"
    ) {
      process.stdout.write(
        `Warning: Consider adding types to models/types.ts instead of creating ${fileName}.\n`,
      );
    }
  } catch {
    // Skip on parse errors
  }
});
