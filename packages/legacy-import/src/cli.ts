import { mkdir, writeFile } from "node:fs/promises";
import { endsFor, main } from "./main.ts";

process.exitCode = await main({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
  now: () => new Date(),
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
  mkdir: async (path) => {
    await mkdir(path, { recursive: true });
  },
  writeFile: (path, content) => writeFile(path, content, "utf8"),
  makeEnds: (config) => endsFor(config, {}),
});
