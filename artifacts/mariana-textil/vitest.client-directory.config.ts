import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") }, dedupe: ["react", "react-dom"] },
  test: { include: ["src/components/client-directory.test.tsx"], environment: "jsdom", maxWorkers: 1 },
});