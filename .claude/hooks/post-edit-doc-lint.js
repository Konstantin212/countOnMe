#!/usr/bin/env node
const fs = require("fs");
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

    // Only check docs/ files (not .claude/, README.md, CLAUDE.md)
    if (!normalized.includes("/docs/")) {
      process.exit(0);
    }

    // Skip plans/ (simpler frontmatter, not enforced by this hook)
    if (normalized.includes("/docs/plans/")) {
      process.exit(0);
    }

    // Skip docs/README.md (index file, no frontmatter needed)
    const fileName = path.basename(normalized);
    if (fileName === "README.md") {
      process.exit(0);
    }

    // Read the file content
    let content;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      // File might not exist yet during Write
      process.exit(0);
    }

    const errors = [];

    // Check frontmatter exists
    if (!content.startsWith("---")) {
      errors.push("Missing YAML frontmatter (file must start with ---)");
    } else {
      // Extract frontmatter
      const endIndex = content.indexOf("---", 3);
      if (endIndex === -1) {
        errors.push("Malformed frontmatter (no closing ---)");
      } else {
        const frontmatter = content.substring(3, endIndex);

        // Check required fields
        const typeMatch = frontmatter.match(/^type:\s*(.+)$/m);
        if (!typeMatch) {
          errors.push("Missing required frontmatter field: type");
        } else {
          const validTypes = [
            "feature",
            "api",
            "architecture",
            "adr",
            "plan",
          ];
          const typeValue = typeMatch[1].trim();
          if (!validTypes.includes(typeValue)) {
            errors.push(
              `Invalid type: "${typeValue}" (must be one of: ${validTypes.join(", ")})`
            );
          }
        }

        const statusMatch = frontmatter.match(/^status:\s*(.+)$/m);
        if (!statusMatch) {
          errors.push("Missing required frontmatter field: status");
        } else {
          const validStatuses = [
            "current",
            "draft",
            "deprecated",
            "proposed",
            "accepted",
            "rejected",
            "superseded",
          ];
          const statusValue = statusMatch[1].trim();
          if (!validStatuses.includes(statusValue)) {
            errors.push(
              `Invalid status: "${statusValue}" (must be one of: ${validStatuses.join(", ")})`
            );
          }
        }

        const dateMatch = frontmatter.match(/^last-updated:\s*(.+)$/m);
        if (!dateMatch) {
          errors.push("Missing required frontmatter field: last-updated");
        } else {
          const dateValue = dateMatch[1].trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            errors.push(
              `Invalid last-updated format: "${dateValue}" (must be YYYY-MM-DD)`
            );
          }
        }
      }
    }

    if (errors.length > 0) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `Doc lint failed for ${fileName}:\n${errors.map((e) => `  - ${e}`).join("\n")}\n\nAll docs in docs/ (except plans/ and README.md) require YAML frontmatter with: type, status, last-updated.\nSee .claude/skills/doc-templates/SKILL.md for templates.`,
        })
      );
      process.exit(2);
    }
  } catch {
    // Skip on parse errors
  }
});
