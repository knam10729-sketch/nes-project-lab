import assert from "node:assert/strict";
import test from "node:test";
import handler from "../src/worker.js";
import { ideaById, ideaProgress, ideas } from "../ideas/data.js";

test("the idea board has one planning item and the report numbers", () => {
  assert.equal(ideas.length, 1);
  const idea = ideaById(1);
  assert.equal(idea.title, "맞춤 머그컵 — 반려동물 사진 이름 머그컵 주문 제작");
  assert.equal(idea.brand, "쇼");
  assert.equal(idea.stage, "기획 중");
  assert.equal(idea.updated, "2026-11-11");
  const progress = ideaProgress(idea);
  assert.equal(progress.done, 2);
  assert.equal(progress.percent, 25);
  assert.equal(idea.checklist.filter((item) => item.done).map((item) => item.label).join(","), "기획서 작성,디자인 틀 3종 시안");
  assert.equal(idea.offer.rows.find((row) => row[0] === "판매가 가정")[1], "기본 19,900원, 배송비 3,500원 별도");
  assert.equal(idea.pnl.rows.at(-1)[2], "4,296원");
  assert.equal(idea.budget.rows.at(-1)[1], "69,600원");
  assert.equal(idea.sources[0].id, 1);
  assert.match(idea.sources[1].href, /^https:\/\/marpple\.marpple\.shop\//);
  assert.equal(JSON.stringify(idea).includes("<form"), false);
});

test("idea pages are served by the site worker", async () => {
  const seen = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        seen.push(new URL(request.url).pathname);
        return new Response("asset:" + new URL(request.url).pathname);
      },
    },
  };
  const board = await handler.fetch(new Request("https://jeonghan.kr/ideas"), env);
  const detail = await handler.fetch(new Request("https://jeonghan.kr/ideas/1"), env);
  const data = await handler.fetch(new Request("https://jeonghan.kr/ideas/data.js"), env);
  const image = await handler.fetch(new Request("https://jeonghan.kr/ideas/img/mug-hero.webp"), env);
  assert.equal(await board.text(), "asset:/ideas/index.html");
  assert.equal(await detail.text(), "asset:/ideas/detail.html");
  assert.equal(await data.text(), "asset:/ideas/data.js");
  assert.equal(await image.text(), "asset:/ideas/img/mug-hero.webp");
  assert.equal((await handler.fetch(new Request("https://jeonghan.kr/ideas/missing"), env)).status, 404);
  assert.deepEqual(seen, ["/ideas/index.html", "/ideas/detail.html", "/ideas/data.js", "/ideas/img/mug-hero.webp"]);
});
