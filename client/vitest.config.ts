import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "src/app"),
      "@components": path.resolve(__dirname, "src/components"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@models": path.resolve(__dirname, "src/models"),
      "@particles": path.resolve(__dirname, "src/particles"),
      "@screens": path.resolve(__dirname, "src/screens"),
      "@services": path.resolve(__dirname, "src/services"),
      "@storage": path.resolve(__dirname, "src/storage"),
      "@theme": path.resolve(__dirname, "src/theme"),
    },
  },
});
