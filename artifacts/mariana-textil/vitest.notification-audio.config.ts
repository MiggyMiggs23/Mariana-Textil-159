import path from "node:path";
import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const requireFromApp = createRequire(path.resolve(import.meta.dirname, "package.json"));
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      ...(process.env.NOTIFICATION_AUDIO_HEAD ? [{
        find: "./notification-audio-controller",
        replacement: process.env.NOTIFICATION_AUDIO_HEAD,
      }, ...["@workspace/api-client-react", "lucide-react", "react", "react-dom"].map(name => ({
        find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
        replacement: requireFromApp.resolve(name),
      }))] : []),
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
    ],
    dedupe: ["react", "react-dom"],
  },
  test: {
    include: ["src/components/notification-audio-controller.mounted.test.tsx"],
    environment: "jsdom",
    testTimeout: 5000,
    maxWorkers: 1,
  },
});