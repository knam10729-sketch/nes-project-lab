import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const BOOT = "localStorage.getItem('nes-theme')==='dark'?'dark':'light'";

test("first visit is light unless the visitor chose dark", () => {
  const theme = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
  assert.match(theme.split(":root[data-theme=\"dark\"]")[0], /color-scheme:light/);
  assert.match(theme, /:root\[data-theme="dark"\].*color-scheme:dark/);
  for (const file of ["index.html", "games/index.html", "games/play.html", "ideas/index.html", "ideas/detail.html", "src/worker.js"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, new RegExp(BOOT.replace(/[?*+^${}()|[\]\\]/g, "\\$&")));
    assert.equal(source.includes("dataset.theme='dark'"), false);
  }
});
