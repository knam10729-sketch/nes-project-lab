import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("the youtube channel is promoted only on public pages", () => {
  const home = read("index.html");
  assert.match(home, /네스의 실화극장/);
  assert.match(home, /회사 IT 업무에서 AI·자동화·앱 개발까지/);
  assert.match(home, /href="https:\/\/www\.youtube\.com\/@neszal"/);
  assert.match(home, /href="https:\/\/www\.youtube\.com\/@neszal\?sub_confirmation=1"/);
  assert.match(home, /target="_blank" rel="noopener"/);
  assert.equal(home.includes("?si="), false);
  assert.equal(/<iframe[^>]*youtube/i.test(home), false);
  assert.match(home, /\/img\/neszal-avatar\.jpg/);
  assert.equal(existsSync(new URL("../img/neszal-avatar.jpg", import.meta.url)), true);
  assert.match(home, /유튜브 @neszal/);

  const lobby = read("games/index.html");
  assert.match(lobby, /게임 재밌게 하셨나요\? 만든 사람의 유튜브도 놀러 오세요 →/);
  assert.match(lobby, /유튜브 @neszal/);
  assert.equal(lobby.includes("<iframe"), false);

  for (const file of ["games/play.html", "games/meet.html", "games/fortune.html"]) {
    const source = read(file);
    assert.match(source, /유튜브 @neszal/);
    assert.equal(source.includes("게임 재밌게 하셨나요"), false);
    assert.equal(source.includes("네스의 실화극장"), false);
  }

  for (const file of ["ideas/index.html", "ideas/detail.html", "src/worker.js"]) {
    const source = read(file);
    assert.equal(source.includes("youtube.com"), false);
    assert.equal(source.includes("네스의 실화극장"), false);
  }
});
