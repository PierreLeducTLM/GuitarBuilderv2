import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const vitestBin = join(
  realpathSync(join(dirname(fileURLToPath(import.meta.url)), "node_modules", "vitest")),
  "vitest.mjs",
);

export default {
  testRunner: "command",
  commandRunner: { command: `node ${vitestBin} run --reporter=dot` },
  coverageAnalysis: "off",
  concurrency: 4,
  timeoutMS: 30000,
  timeoutFactor: 3,
  reporters: ["clear-text", "progress", "html"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  incrementalFile: "reports/stryker-incremental.json",
  tempDirName: ".stryker-tmp",
  mutate: ["src/**/*.ts", "!src/**/*.test.ts", "!src/test-support/**", "!src/index.ts"],
};
