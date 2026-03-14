#!/usr/bin/env node
/**
 * PreToolUse hook: Enforces backend vertical slice folder structure.
 *
 * Blocks writes to banned directories (app/api/, app/db/, app/models/, app/schemas/, app/services/).
 * Ensures new backend files go in app/core/ or app/features/<domain>/.
 * Validates feature folder file naming (router.py, service.py, models.py, schemas.py, calculation.py).
 */

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = (event.tool_input?.file_path || "").replace(/\\/g, "/");

    // Only enforce for backend/app/ files
    if (!filePath.includes("backend/app/")) {
      process.exit(0);
    }

    // Skip __pycache__ and .pyc
    if (filePath.includes("__pycache__") || filePath.endsWith(".pyc")) {
      process.exit(0);
    }

    // Extract path relative to backend/app/
    const match = filePath.match(/backend\/app\/(.+)/);
    if (!match) {
      process.exit(0);
    }

    const relative = match[1];

    // Allow root files: main.py, settings.py, __init__.py
    const rootAllowed = ["main.py", "settings.py", "__init__.py"];
    if (!relative.includes("/") && rootAllowed.includes(relative)) {
      process.exit(0);
    }

    // BANNED directories — these must never be recreated
    const bannedPrefixes = [
      "api/",
      "db/",
      "models/",
      "schemas/",
      "services/",
    ];

    for (const banned of bannedPrefixes) {
      if (relative.startsWith(banned)) {
        process.stdout.write(
          JSON.stringify({
            decision: "block",
            reason: `BLOCKED: "backend/app/${relative}" is in banned directory "app/${banned.slice(0, -1)}/". ` +
              `The backend uses vertical slice architecture. ` +
              `Use app/core/ for shared infrastructure or app/features/<domain>/ for feature code. ` +
              `See the folder-structure skill for details.`,
          }),
        );
        process.exit(2);
      }
    }

    // Allowed top-level directories
    const allowedTopDirs = ["core", "features"];
    const topDir = relative.split("/")[0];

    if (relative.includes("/") && !allowedTopDirs.includes(topDir)) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `BLOCKED: "backend/app/${relative}" is outside allowed directories. ` +
            `Only app/core/ and app/features/<domain>/ are permitted. ` +
            `See the folder-structure skill for details.`,
        }),
      );
      process.exit(2);
    }

    // Validate core/ files — only specific files allowed
    if (topDir === "core") {
      const coreAllowed = [
        "core/__init__.py",
        "core/db.py",
        "core/deps.py",
        "core/enums.py",
        "core/mixins.py",
        "core/schemas.py",
        "core/rate_limit.py",
      ];
      if (!coreAllowed.includes(relative)) {
        // Warn but don't block — new core files may be needed
        process.stdout.write(
          `Warning: "app/${relative}" is a new file in core/. ` +
          `Ensure shared infrastructure belongs here, not in a feature folder.\n`,
        );
      }
    }

    // Validate features/ structure
    if (topDir === "features") {
      const parts = relative.split("/");
      // features/__init__.py is fine
      if (parts.length === 2 && parts[1] === "__init__.py") {
        process.exit(0);
      }

      // Must have at least features/<domain>/<file>
      if (parts.length < 3) {
        if (parts.length === 2 && parts[1] !== "__init__.py") {
          process.stdout.write(
            JSON.stringify({
              decision: "block",
              reason: `BLOCKED: Files must be inside a feature folder: app/features/<domain>/<file>.py, not directly in app/features/.`,
            }),
          );
          process.exit(2);
        }
        process.exit(0);
      }

      const domain = parts[1];
      const fileName = parts[parts.length - 1];

      // No deeper nesting than features/<domain>/<file>
      if (parts.length > 3) {
        process.stdout.write(
          JSON.stringify({
            decision: "block",
            reason: `BLOCKED: "app/${relative}" has too many levels. Feature folders are flat: app/features/${domain}/<file>.py. No subdirectories inside features.`,
          }),
        );
        process.exit(2);
      }

      // Allowed file names inside a feature folder
      const allowedFeatureFiles = [
        "__init__.py",
        "router.py",
        "service.py",
        "models.py",
        "schemas.py",
        "calculation.py",
      ];

      if (!allowedFeatureFiles.includes(fileName)) {
        process.stdout.write(
          JSON.stringify({
            decision: "block",
            reason: `BLOCKED: "app/features/${domain}/${fileName}" is not an allowed feature file. ` +
              `Allowed: ${allowedFeatureFiles.join(", ")}. ` +
              `If this is shared logic, it belongs in core/. If it's a utility, put it in service.py or calculation.py.`,
          }),
        );
        process.exit(2);
      }
    }
  } catch {
    // Don't block on parse errors
  }
});
