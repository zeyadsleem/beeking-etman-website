import { defineConfig } from "@playwright/test";

export default defineConfig({
  testMatch: "**/verify.e2e.ts",
  use: { baseURL: "http://localhost:5199" },
});
