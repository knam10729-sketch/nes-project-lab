import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import handler from "../src/worker.js";
import { ideaById, ideaProgress, ideas } from "../ideas/data.js";

test("the idea board has one planning item and the report numbers", () => {
  assert.equal(ideas.length, 5);
  assert.deepEqual(ideas.map((idea) => idea.slug), ["coffee-cup", "pet-mug", "nes-goods", "shop-design", "flex-case"]);
  assert.deepEqual(ideas.map((idea) => idea.no), [1, 2, 3, 4, 5]);
  assert.deepEqual(ideas.map((idea) => [idea.id, idea.no]), ideas.map((idea, index) => [index + 1, index + 1]));
  const coffee = ideaById(1);
  assert.equal(coffee.slug, "coffee-cup");
  assert.equal(ideaById("coffee-cup").id, 1);
  assert.equal(coffee.stage, "구상 중");
  assert.equal(coffee.layout, "coffee");
  assert.equal(coffee.title, "커피 코팅 종이컵 제품 구상서");
  assert.equal(coffee.legacyId, undefined);
  assert.equal(ideaProgress(coffee).percent, 13);
  assert.ok(ideaProgress(coffee).percent >= 10 && ideaProgress(coffee).percent <= 15);
  assert.deepEqual(coffee.checklist.filter((item) => item.done).map((item) => item.label), ["구상서 정리", "콘셉 시안"]);
  for (const label of ["코팅 가능성", "녹는 정도", "내수성·향", "운반 중 탈락", "방습 포장", "소비기한", "식품 접촉 안전성"]) {
    assert.equal(coffee.checklist.find((item) => item.label === label).done, false);
  }
  assert.deepEqual(coffee.flow, ["컵 꺼내기", "선까지 뜨거운 물", "저어 마시기"]);
  assert.deepEqual(coffee.scenes, ["사무실 탕비실", "캠핑", "여행"]);
  assert.equal(coffee.heroCaption, "콘셉 시안 · 실제 제작품·성능 검증 아님");
  assert.match(coffee.disclaimer, /습기 차단/);
  assert.match(coffee.disclaimer, /목표 콘셉트/);
  assert.match(coffee.pitch.join(" "), /컵 1개가 커피 1잔/);
  assert.equal(/\d[\d,]*원/.test(JSON.stringify(coffee)), false);
  assert.equal(JSON.stringify(coffee).includes("<form"), false);
  for (const image of [coffee.hero, coffee.interior.src, coffee.display.src]) {
    assert.equal(existsSync(new URL(`..${image}`, import.meta.url)), true);
  }
  const detail = readFileSync(new URL("../ideas/detail.js", import.meta.url), "utf8");
  assert.match(detail, /layout === "coffee"/);
  assert.match(detail, /layout === "flexcase"/);
  const flex = ideaById(5);
  assert.equal(flex.slug, "flex-case");
  assert.equal(flex.legacyId, undefined);
  assert.equal(flex.stage, "구상 중");
  assert.equal(flex.title, "유동형 휴대폰 케이스 구상서");
  assert.equal(ideaProgress(flex).percent, 13);
  assert.deepEqual(flex.checklist.filter((item) => item.done).map((item) => item.label), ["구상서 정리", "콘셉 시안"]);
  for (const label of ["조절 범위", "고정 방법", "반복 사용 헐거워짐", "렌즈 배열·돌출 대응", "버튼·단자·스피커 간섭", "낙하 보호", "패널 결합·무게·충전 영향"]) {
    assert.equal(flex.checklist.find((item) => item.label === label).done, false);
  }
  assert.deepEqual(flex.parts.map((part) => part.title), ["상하좌우 크기 조절", "가변 카메라 개구부", "늘어나지 않는 아트 패널", "탄성 소재·모서리 완충"]);
  assert.match(flex.waste.join(" "), /친환경 성능이 검증되었다는 의미로 사용하지 않는다/);
  assert.match(flex.scope.join(" "), /접이식/);
  assert.equal(flex.heroCaption, "콘셉 시안 · 실제 제작품·성능 검증 아님");
  assert.match(flex.disclaimer, /가격·판매 일정은 정하지 않았다/);
  assert.equal(/\d[\d,]*원/.test(JSON.stringify(flex)), false);
  for (const image of [flex.hero, flex.structure.src, flex.compare.src]) {
    assert.equal(existsSync(new URL(`..${image}`, import.meta.url)), true);
  }
  assert.match(detail, /layout === "shops"/);
  assert.match(detail, /mountComments/);
  const workerSource = readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
  assert.match(workerSource, /idea-\$\{idea\.slug\}/);
  assert.match(workerSource, /idea\.legacyId/);
  const shop = ideaById(4);
  assert.equal(shop.slug, "shop-design");
  assert.equal(shop.legacyId, 3);
  assert.equal(shop.stage, "구상 중");
  assert.equal(shop.layout, "shops");
  assert.equal(shop.title, "소상공인 맞춤 디자인 구상서");
  assert.equal(ideaProgress(shop).percent, 15);
  assert.deepEqual(shop.checklist.filter((item) => item.done).map((item) => item.label), ["구상서 정리", "콘셉 이미지"]);
  assert.equal(shop.shops.length, 3);
  assert.deepEqual(shop.flow, ["자료 받기", "분위기 제안", "시안", "사장님 확인", "최종 파일"]);
  assert.deepEqual(shop.palettes.map((palette) => palette.place), ["카페", "미용실", "숙소"]);
  assert.deepEqual(shop.materials, ["상호와 로고", "매장 사진", "넣을 문구·메뉴·가격", "원하는 분위기", "안내물을 놓을 위치"]);
  assert.match(shop.disclaimer, /가상 예시/);
  assert.match(shop.disclaimer, /판매 확정안이 아니/);
  assert.equal(shop.heroCaption, "AI 콘셉 이미지 · 가상 예시");
  assert.equal(JSON.stringify(shop).includes("<form"), false);
  assert.equal(/\d[\d,]*원/.test(JSON.stringify(shop)), false);
  for (const image of [shop.hero, ...shop.shops.map((item) => item.src)]) {
    assert.equal(existsSync(new URL(`..${image}`, import.meta.url)), true);
  }
  const nes = ideaById(3);
  assert.equal(nes.slug, "nes-goods");
  assert.equal(nes.legacyId, 2);
  assert.equal(nes.stage, "구상 중");
  assert.equal(nes.title, "네스 캐릭터 굿즈 구상서");
  assert.equal(ideaProgress(nes).percent, 15);
  assert.equal(nes.checklist.filter((item) => item.done).length, 2);
  assert.equal(JSON.stringify(nes).includes("19,900"), false);
  assert.equal(nes.heroCaption, "AI 콘셉 이미지 · 실제 제작품 아님");
  const idea = ideaById(2);
  assert.equal(idea.slug, "pet-mug");
  assert.equal(idea.legacyId, 1);
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

function ideaEnv() {
  const seen = [];
  return {
    seen,
    env: {
      ASSETS: {
        async fetch(request) {
          seen.push(new URL(request.url).pathname);
          return new Response("asset:" + new URL(request.url).pathname, { headers: { "content-type": "text/plain" } });
        },
      },
    },
  };
}

test("ideas stay locked until the password cookie is valid", async () => {
  const { seen, env } = ideaEnv();
  const board = await handler.fetch(new Request("https://jeonghan.kr/ideas"), env);
  const page = await board.text();
  assert.equal(board.status, 200);
  assert.match(board.headers.get("cache-control"), /private/);
  assert.match(board.headers.get("cache-control"), /no-store/);
  assert.match(page, /inputmode="numeric"/);
  assert.match(page, /autofocus/);
  assert.equal(page.includes("맞춤 머그컵"), false);
  const detail = await handler.fetch(new Request("https://jeonghan.kr/ideas/1"), env);
  assert.match(await detail.text(), /비밀번호/);
  const data = await handler.fetch(new Request("https://jeonghan.kr/ideas/data.js"), env);
  const image = await handler.fetch(new Request("https://jeonghan.kr/ideas/img/mug-hero.webp"), env);
  assert.equal(data.status, 401);
  assert.equal(image.status, 401);
  assert.equal((await data.text()).includes("판매가"), false);
  assert.equal(seen.length, 0);

  const wrong = await handler.fetch(new Request("https://jeonghan.kr/ideas/unlock", {
    method: "POST",
    headers: { origin: "https://jeonghan.kr", "content-type": "application/x-www-form-urlencoded" },
    body: "password=1999&next=/ideas/1",
  }), env);
  const wrongPage = await wrong.text();
  assert.equal(wrong.status, 401);
  assert.match(wrongPage, /비밀번호가 틀렸어요/);
  assert.match(wrongPage, /shake/);
  assert.equal(wrong.headers.get("set-cookie"), null);

  const opened = await handler.fetch(new Request("https://jeonghan.kr/ideas/unlock", {
    method: "POST",
    headers: { origin: "https://jeonghan.kr", "content-type": "application/x-www-form-urlencoded" },
    body: "password=2002&next=/ideas/1",
  }), env);
  assert.equal(opened.status, 302);
  assert.equal(opened.headers.get("location"), "/ideas/1");
  const cookie = opened.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=2592000/);
  const pair = cookie.split(";")[0];
  const unlocked = await handler.fetch(new Request("https://jeonghan.kr/ideas/1", { headers: { cookie: pair } }), env);
  const file = await handler.fetch(new Request("https://jeonghan.kr/ideas/data.js", { headers: { cookie: pair } }), env);
  assert.equal(await unlocked.text(), "asset:/ideas/detail.html");
  assert.equal(await file.text(), "asset:/ideas/data.js");
  assert.match(unlocked.headers.get("cache-control"), /no-store/);
  const locked = await handler.fetch(new Request("https://jeonghan.kr/ideas/lock", {
    method: "POST",
    headers: { origin: "https://jeonghan.kr", cookie: pair },
  }), env);
  assert.equal(locked.status, 302);
  assert.match(locked.headers.get("set-cookie"), /Max-Age=0/);
});
