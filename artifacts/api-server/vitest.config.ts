import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The canonical test command runs this node:test suite with its own runner.
    exclude: [...configDefaults.exclude, "build.provenance.test.mjs"],
  },
});
