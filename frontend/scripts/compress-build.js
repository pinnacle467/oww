// Post-build compression. CRA ships uncompressed JS/CSS/HTML, and sirv
// (the static server we run on port 3000) only serves precompiled .gz /
// .br variants — it does not gzip on the fly. This script walks the
// build/ tree and writes a .gz next to every text asset > 1 KB so the
// browser receives 170 KB of bundle instead of 565 KB.
//
// Brotli is attempted via the system binary; it is optional. Gzip is
// required and will throw if missing.

const { execSync } = require("child_process");
const { existsSync, readdirSync, statSync } = require("fs");
const { join, extname } = require("path");

const ROOT = join(__dirname, "..", "build");
const EXTS = new Set([".js", ".css", ".html", ".svg", ".json", ".txt", ".xml", ".webmanifest"]);
const MIN_BYTES = 1024;

let hasBrotli = true;
try {
  execSync("which brotli", { stdio: "ignore" });
} catch {
  hasBrotli = false;
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (!st.isFile()) continue;
    if (!EXTS.has(extname(full).toLowerCase())) continue;
    if (st.size < MIN_BYTES) continue;
    if (name.endsWith(".gz") || name.endsWith(".br")) continue;
    execSync(`gzip -k -9 -f "${full}"`);
    if (hasBrotli) {
      try { execSync(`brotli -k -q 11 -f "${full}"`); } catch { /* tolerate */ }
    }
  }
}

if (!existsSync(ROOT)) {
  console.error("compress-build: build/ not found — did you run craco build first?");
  process.exit(1);
}
walk(ROOT);
console.log(`compress-build: done${hasBrotli ? "" : " (brotli unavailable, gzip only)"}`);
