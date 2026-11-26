import { allHints } from "../games/words.js";

export const HINTS = allHints();

export const VAGUE = {
  음식: ["먹을 수 있다", "배고플 때 생각난다", "식탁 위에 있다"],
  동물: ["살아 움직인다", "자연에서 볼 수 있다", "소리를 내기도 한다"],
  장소: ["사람이 찾아가는 곳", "밖에 나가면 있다", "주소를 가질 수 있다"],
  직업: ["누군가의 일이다", "일터에서 한다", "배우는 과정이 있다"],
  물건: ["손으로 다룰 수 있다", "집에 두기도 한다", "필요할 때 찾는다"],
  "영화·드라마": ["이야기 속에 나온다", "화면으로 본다", "극의 소재가 된다"],
  운동: ["몸을 움직이는 일이다", "규칙이 있다", "연습하면 는다"],
  학교: ["배움과 연결된다", "교실 근처에서 본다", "학기 중에 나온다"],
  자연: ["밖에 나가면 만날 수 있다", "날씨와 가깝다", "풍경의 일부다"],
  음악: ["소리와 관계있다", "귀로 듣는다", "박자나 음이 있다"],
  탈것: ["타고 이동한다", "바퀴나 날개가 있다", "목적지로 간다"],
  간식: ["출출할 때 떠오른다", "달거나 고소하다", "손에 들고 먹는다"],
  옷: ["몸에 걸친다", "계절에 따라 고른다", "옷장에 둔다"],
  식물: ["자라난다", "물과 빛이 필요하다", "잎이나 꽃이 있다"],
  날씨: ["하늘과 관계있다", "외출 준비에 영향을 준다", "예보로 듣는다"],
  취미: ["시간을 들여 한다", "좋아해서 반복한다", "쉬면서 즐긴다"],
};

export function coveredWords() {
  return Object.keys(HINTS);
}

export function hintChoices(word, categoryLabel, isLiar, used = []) {
  const pool = isLiar ? (VAGUE[categoryLabel] || VAGUE["물건"]) : (HINTS[word] || VAGUE[categoryLabel] || ["그냥 그렇다"]);
  return pool.filter((hint) => !used.includes(hint) && !String(hint).includes(word));
}
