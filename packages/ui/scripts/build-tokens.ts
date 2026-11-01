// Writes src/styles/tokens.css from src/tokens/themes.ts. Run: pnpm --filter @gb/ui tokens
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderTokensCss } from "../src/tokens/css.ts";

const target = fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url));
writeFileSync(target, renderTokensCss());
console.log(`Wrote ${target}`);
