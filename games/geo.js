const EARTH_M = 6_371_000;
const LAT_M = 111_320;

export const DIRECTIONS = [
  { id: "n", label: "북", bearing: 0 },
  { id: "ne", label: "북동", bearing: 45 },
  { id: "e", label: "동", bearing: 90 },
  { id: "se", label: "남동", bearing: 135 },
  { id: "s", label: "남", bearing: 180 },
  { id: "sw", label: "남서", bearing: 225 },
  { id: "w", label: "서", bearing: 270 },
  { id: "nw", label: "북서", bearing: 315 },
];

const SUMMARIES = [
  "오늘은 발걸음이 가볍습니다.",
  "가까운 곳이 의외로 반갑습니다.",
  "서두르지 않으면 더 잘 풀립니다.",
  "작은 선택이 기분을 바꿉니다.",
  "익숙한 길이 오늘은 새롭습니다.",
  "잠깐 멈춰 서면 답이 보입니다.",
  "사람 목소리가 힘이 됩니다.",
  "혼자만의 시간이 충전입니다.",
  "계획보다 여유가 이깁니다.",
  "밝은 쪽이 오늘의 힌트입니다.",
  "작은 친절이 크게 돌아옵니다.",
  "지금 있는 자리가 나쁘지 않습니다.",
  "호기심을 따라가도 좋습니다.",
  "정리 한 번이 운을 닦습니다.",
  "물 한 잔이 집중을 돌려줍니다.",
  "오늘은 약속을 가볍게 지키면 됩니다.",
  "처음 보는 간판이 힌트입니다.",
  "느린 걸음이 더 멀리 갑니다.",
  "웃으면 숫자가 따라옵니다.",
  "미뤄 둔 연락이 따뜻합니다.",
  "창밖을 보면 다음이 보입니다.",
  "주머니를 가볍게 하면 마음이 가볍습니다.",
  "오늘은 새 메뉴보다 단골이 좋습니다.",
  "질문을 하나 더 하면 이깁니다.",
  "그늘보다 그늘 끝이 좋습니다.",
  "같은 장소도 시간이 다르면 다릅니다.",
  "발밑을 보면 행운이 붙어 있습니다.",
  "오늘은 크게 벌리기보다 맞추기입니다.",
  "짧은 산책이 긴 고민을 이깁니다.",
  "반가운 이름이 떠오르면 그 사람입니다.",
  "오늘은 왼쪽보다 밝은 쪽이 맞습니다.",
  "작은 성취를 꼭 세어 보세요.",
];

const MONEY = [
  "지갑을 열기 전에 한 번만 더 생각해 보세요.",
  "작은 거스름돈이 기분을 살립니다.",
  "오늘은 충동구매보다 목록이 이깁니다.",
  "공짜처럼 보여도 시간을 씁니다.",
  "아끼지 말고, 아낄 곳만 아끼세요.",
  "잔액보다 오늘 쓴 이유를 적어 보세요.",
  "점심값을 아껴 커피를 사지 않아도 됩니다.",
  "중고나 나눔이 새 결정보다 낫습니다.",
  "자동이체 하나를 확인해 보세요.",
  "오늘은 현금이 마음을 차분하게 합니다.",
  "할인은 필요했던 물건에만 해당됩니다.",
  "친구와 더치페이하면 관계가 편합니다.",
  "통장 이름을 보면 목표가 떠오릅니다.",
  "오늘 산 것은 내일도 좋을지 물어보세요.",
  "포인트는 쓰려고 만든 날입니다.",
  "큰돈은 내일, 작은 정리는 오늘.",
  "영수증을 한 장만 버려도 정리가 됩니다.",
  "공과금 날짜를 달력에 적으면 마음이 놓입니다.",
  "오늘은 비교 한 번이 천 원을 지킵니다.",
  "지갑 사진을 정리하면 자리가 납니다.",
  "나눔 한 번이 의외의 여유를 줍니다.",
  "오늘은 새로 사기보다 고치는 날입니다.",
  "커피 한 잔 값을 내일의 나에게 남겨 두세요.",
  "세일 알림은 오늘만 꺼도 좋습니다.",
  "잔돈을 저금통에 넣으면 운이 쌓입니다.",
  "필요한 것과 갖고 싶은 것을 나눠 적으세요.",
  "오늘은 비싼 메뉴보다 나눠 먹는 메뉴입니다.",
  "구독 하나를 훑어보면 새는 곳이 보입니다.",
  "가격표 아래 글씨를 끝까지 읽으세요.",
  "오늘은 숫자보다 만족이 기준입니다.",
  "거스름돈을 바로 넣으면 잃지 않습니다.",
  "작은 이체가 큰 마음보다 정확합니다.",
];

const LOVE = [
  "먼저 안부를 묻는 쪽이 이깁니다.",
  "답장을 짧게라도 오늘 보내세요.",
  "같이 걸을 사람이 떠오르면 그 사람입니다.",
  "칭찬 한 마디가 긴 설명보다 낫습니다.",
  "오늘은 조언보다 듣기가 맞습니다.",
  "사진 한 장이 마음을 전합니다.",
  "약속 시간을 지키면 호감이 오릅니다.",
  "다툰 일은 오늘은 덮어 두세요.",
  "이름 뒤에 쉼표를 넣고 생각해 보세요.",
  "같이 먹을 메뉴를 물어보는 것만으로 충분합니다.",
  "오늘은 새로운 사람보다 오래된 사람이 따뜻합니다.",
  "웃는 얼굴이 가장 짧은 편지입니다.",
  "늦게 보낸 안부도 안 보낸 것보다 낫습니다.",
  "손편지 대신 음성 메시지 하나가 좋습니다.",
  "취향을 기억해 주면 점수가 오릅니다.",
  "오늘은 질투보다 궁금함이 이깁니다.",
  "같이 있는 침묵도 대화입니다.",
  "상대의 하루를 한 문장만 물어보세요.",
  "장소보다 같이 있는 시간이 중요합니다.",
  "오늘은 고백보다 감사가 맞습니다.",
  "읽씹은 내일로 미루지 마세요.",
  "작은 기념일을 먼저 기억하면 빛납니다.",
  "연락처 별명을 다정하게 바꿔 보세요.",
  "오늘은 내가 맞다는 말보다 그랬구나가 좋습니다.",
  "같이 들을 노래를 하나 고르세요.",
  "스킨십보다 눈맞춤이 먼저입니다.",
  "오래된 농담이 오늘 다시 통합니다.",
  "만나기 어렵다면 사진으로 자리를 나누세요.",
  "오늘은 기대보다 있는 그대로가 좋습니다.",
  "헤어질 때 다음을 정하면 마음이 남습니다.",
  "친구의 연애 이야기도 내 마음을 보여 줍니다.",
  "좋은 말은 오늘 안에 도착해야 합니다.",
];

const HEALTH = [
  "물을 평소보다 한 컵 더 마시세요.",
  "어깨를 한 번 내리면 숨이 깊어집니다.",
  "오늘은 엘리베이터 대신 한 층만 걸어 보세요.",
  "화면을 20분마다 멀리 보세요.",
  "식사 속도만 늦춰도 속이 편합니다.",
  "햇빛을 5분 쬐면 눈이 깨어납니다.",
  "자기 전 휴대폰을 팔 길이 밖에 두세요.",
  "목 뒤를 따뜻하게 하면 긴장이 풀립니다.",
  "오늘은 매운 것보다 따뜻한 국물이 맞습니다.",
  "스트레칭은 아프기 전에 멈추세요.",
  "카페인을 오후에 한 잔만 줄여 보세요.",
  "발바닥을 바닥에 붙이고 앉아 보세요.",
  "오늘은 늦게 자기보다 10분이 이득입니다.",
  "간식은 단것보다 견과 한 줌이 좋습니다.",
  "창문을 열면 머리가 정리됩니다.",
  "양치 후에 물만 마셔도 입이 개운합니다.",
  "가방을 양쪽으로 번갈아 메 보세요.",
  "오늘은 무리한 운동보다 산책이 약입니다.",
  "눈을 감고 열까지 세면 맥박이 느려집니다.",
  "점심 후 5분 걷기가 졸음을 이깁니다.",
  "자세를 펴면 목소리도 밝아집니다.",
  "오늘은 찬물보다 미지근한 물이 맞습니다.",
  "손목을 둥글게 돌려 주세요.",
  "배고프기 전에 가볍게 먹는 날이 좋습니다.",
  "신발을 고쳐 신으면 걸음이 달라집니다.",
  "오늘은 소식보다 꼭꼭 씹기가 중요합니다.",
  "허리를 등받이에 붙여 보세요.",
  "밤공기 대신 아침 공기가 이깁니다.",
  "알림을 잠시 끄면 숨이 돌아옵니다.",
  "오늘은 약속도 쉬는 시간에 넣으세요.",
  "손을 따뜻하게 씻으면 기분이 정리됩니다.",
  "작은 통증이 있으면 오늘 메모해 두세요.",
];

const COLORS = [
  ["빨강", "#e23b3b"], ["주황", "#f08a24"], ["노랑", "#f2c14e"], ["연두", "#8fce4a"],
  ["초록", "#2f9e44"], ["청록", "#1aa6a6"], ["하늘", "#4dabf7"], ["파랑", "#3b6fe0"],
  ["남색", "#364fc7"], ["보라", "#7950f2"], ["자주", "#c2255c"], ["분홍", "#f783ac"],
  ["살구", "#ffc9a9"], ["베이지", "#e6d3b3"], ["아이보리", "#f6f1e7"], ["하얀색", "#f8f9fa"],
  ["회색", "#868e96"], ["먹색", "#212529"], ["금색", "#e0b84a"], ["은색", "#ced4da"],
  ["민트", "#63e6be"], ["라벤더", "#b197fc"], ["코랄", "#ff8787"], ["카키", "#a69b4c"],
  ["와인", "#9b2242"], ["바다색", "#1864ab"], ["잔디", "#2b8a3e"], ["귤색", "#fd7e14"],
  ["자두", "#ae3ec9"], ["모래", "#d8c3a5"], ["밤색", "#6f4e37"], ["산호", "#ff6b6b"],
];

const MISSIONS = [
  "{dir}쪽으로 {m}m만 천천히 걸어 보기",
  "{dir}쪽 골목의 끝까지 가 보고 돌아오기",
  "{dir}쪽 창가에서 하늘을 1분 바라보기",
  "{dir}쪽으로 걸으며 간판 세 개 읽어 보기",
  "{dir}쪽에서 물 한 컵을 다 마시기",
  "{dir}쪽 벤치나 난간에 잠시 앉아 보기",
  "{dir}쪽으로 {m}m 갔다가 다른 길로 돌아오기",
  "{dir}쪽 그늘과 볕의 경계를 찾아보기",
  "{dir}쪽에서 사진 한 장만 찍고 걷기",
  "{dir}쪽 횡단보도까지 여유 있게 걸어가기",
  "{dir}쪽으로 가며 발걸음 수를 백까지 세기",
  "{dir}쪽 나무나 화분 앞에서 잠깐 멈추기",
  "{dir}쪽으로 {m}m 걷고 어깨의 힘을 빼기",
  "{dir}쪽에서 오늘 먹은 메뉴를 한 줄로 적기",
  "{dir}쪽 모퉁이를 돌 때 속도를 늦추기",
  "{dir}쪽으로 걸으며 좋은 냄새를 하나 찾기",
  "{dir}쪽 계단이 있으면 한 층만 걸어 보기",
  "{dir}쪽에서 아는 사람에게 안부 한 줄 보내기",
  "{dir}쪽으로 {m}m 가는 동안 화면을 주머니에 넣기",
  "{dir}쪽 밝은 간판 아래에서 숨 한 번 고르기",
  "{dir}쪽으로 걷다 처음 보는 가게 이름을 기억하기",
  "{dir}쪽에서 양말을 바로 신고 다시 걷기",
  "{dir}쪽으로 {m}m, 돌아오는 길은 더 천천히",
  "{dir}쪽 공터나 공원 입구까지 가 보기",
  "{dir}쪽에서 오늘 감사한 일을 하나만 떠올리기",
  "{dir}쪽으로 가며 새 소리나 차 소리를 구분해 보기",
  "{dir}쪽 그늘에서 목과 손목을 한 바퀴 돌리기",
  "{dir}쪽으로 걷고, 도착하면 물을 한 모금 마시기",
  "{dir}쪽 도로가 아니라 사람이 적은 길을 골라 보기",
  "{dir}쪽으로 {m}m 걸어 오늘의 색을 하나 찾기",
  "{dir}쪽에서 신발을 털고 다시 매기",
  "{dir}쪽을 바라보고 오늘 할 일 하나만 정하기",
];

const DISTANCES = [120, 180, 240, 300, 360, 420];

export const POOLS = { summary: SUMMARIES, money: MONEY, love: LOVE, health: HEALTH, color: COLORS, mission: MISSIONS };

export function sphericalMidpoint(points) {
  if (!Array.isArray(points) || !points.length) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const point of points) {
    const lat = radians(point.lat);
    const lng = radians(point.lng);
    const cosLat = Math.cos(lat);
    x += cosLat * Math.cos(lng);
    y += cosLat * Math.sin(lng);
    z += Math.sin(lat);
  }
  const count = points.length;
  x /= count;
  y /= count;
  z /= count;
  return {
    lat: degrees(Math.atan2(z, Math.hypot(x, y))),
    lng: degrees(Math.atan2(y, x)),
  };
}

export function distanceMeters(from, to) {
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const dLat = lat2 - lat1;
  const dLng = radians(to.lng - from.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatMeters(meters) {
  const value = Math.max(0, Number(meters) || 0);
  if (value < 1000) return `${Math.round(value)}m`;
  const digits = value < 10_000 ? 1 : 0;
  return `${(value / 1000).toFixed(digits)}km`;
}

export function gridCell(lat, lng) {
  const latCell = Math.round((Number(lat) * LAT_M) / 100);
  const latCenter = (latCell * 100) / LAT_M;
  const lngMeters = Math.max(20_000, LAT_M * Math.cos(radians(latCenter)));
  const lngCell = Math.round((Number(lng) * lngMeters) / 100);
  return { latCell, lngCell };
}

export function seoulDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function fortuneFor(lat, lng, date = seoulDate()) {
  const cell = gridCell(lat, lng);
  const random = mulberry32(fnv1a(`${date}|${cell.latCell}|${cell.lngCell}`));
  const direction = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
  const colorPair = COLORS[Math.floor(random() * COLORS.length)];
  const mission = MISSIONS[Math.floor(random() * MISSIONS.length)]
    .replaceAll("{dir}", direction.label)
    .replaceAll("{m}", String(DISTANCES[Math.floor(random() * DISTANCES.length)]));
  return {
    date,
    cell,
    score: 58 + Math.floor(random() * 42),
    summary: pick(SUMMARIES, random),
    money: pick(MONEY, random),
    love: pick(LOVE, random),
    health: pick(HEALTH, random),
    direction,
    color: { name: colorPair[0], hex: colorPair[1] },
    number: 1 + Math.floor(random() * 45),
    mission,
  };
}

export function shareText(result, pageUrl = "") {
  const lines = [
    "오늘의 위치 운세 · 재미용",
    `이 근처 총운 ${result.score}점`,
    result.summary,
    `금전: ${result.money}`,
    `연애: ${result.love}`,
    `건강: ${result.health}`,
    `행운의 방향: ${result.direction.label}쪽`,
    `행운의 색: ${result.color.name}`,
    `행운의 숫자: ${result.number}`,
    `오늘의 미션: ${result.mission}`,
  ];
  if (pageUrl) lines.push(String(pageUrl).split("?")[0].split("#")[0]);
  return lines.join("\n");
}

export function sanitizePin(input) {
  const lat = Number(input?.lat);
  const lng = Number(input?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    source: input?.source === "map" ? "map" : "gps",
  };
}

export function placeLinks(lat, lng) {
  const latitude = Number(lat).toFixed(6);
  const longitude = Number(lng).toFixed(6);
  return {
    kakao: `https://map.kakao.com/link/map/${encodeURIComponent("중간지점")},${latitude},${longitude}`,
    naver: `https://map.naver.com/p?c=${longitude},${latitude},16,0,0,0,dh`,
    search: `https://map.kakao.com/link/search/${encodeURIComponent("카페 맛집")}`,
  };
}

export function attachMeet(view, pins) {
  if (!view || view.game !== "meet") return view;
  const bySeat = pins instanceof Map
    ? pins
    : new Map(Object.entries(pins || {}).map(([seat, pin]) => [Number(seat), pin]));
  const people = view.seats.map((seat, index) => {
    const pin = sanitizePin(bySeat.get(index));
    return {
      seat: index,
      name: seat.name,
      lat: pin ? pin.lat : null,
      lng: pin ? pin.lng : null,
      source: pin ? pin.source : null,
    };
  });
  const placed = people.filter((person) => person.lat != null);
  const midpoint = placed.length >= 2 ? roundPoint(sphericalMidpoint(placed)) : null;
  return {
    ...view,
    meet: {
      people: people.map((person) => ({
        ...person,
        meters: midpoint && person.lat != null ? Math.round(distanceMeters(person, midpoint)) : null,
      })),
      midpoint,
    },
  };
}

function roundPoint(point) {
  if (!point) return null;
  return {
    lat: Math.round(point.lat * 1e6) / 1e6,
    lng: Math.round(point.lng * 1e6) / 1e6,
  };
}

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function radians(degreesValue) {
  return (Number(degreesValue) * Math.PI) / 180;
}

function degrees(radiansValue) {
  return (radiansValue * 180) / Math.PI;
}
