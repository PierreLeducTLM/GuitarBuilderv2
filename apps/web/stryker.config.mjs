import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const vitestBin = join(
  realpathSync(join(dirname(fileURLToPath(import.meta.url)), "node_modules", "vitest")),
  "vitest.mjs",
);

/** The whole suite by default; STRYKER_TESTS narrows it to the tests that cover `--mutate`. */
const tests = process.env.STRYKER_TESTS ?? "";

export default {
  testRunner: "command",
  commandRunner: { command: `node ${vitestBin} run --reporter=dot ${tests}`.trim() },
  coverageAnalysis: "off",
  concurrency: 4,
  timeoutMS: 30000,
  timeoutFactor: 3,
  reporters: ["clear-text", "progress", "html"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  incrementalFile: "reports/stryker-incremental.json",
  tempDirName: ".stryker-tmp",
  mutate: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/test/**",
    "!src/app/**",
    "!src/global.d.ts",
  ],
};
