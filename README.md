# NES Project Lab

GitHub + Cloudflare Pages에 바로 배포 가능한 정적 포트폴리오입니다.

## 배포
1. GitHub 새 저장소를 생성하고 `index.html`을 루트에 업로드합니다.
2. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Git repository 연결.
3. 해당 저장소를 선택하고 Framework preset `None`, Build command 비움, Build output directory `/`로 설정합니다.
4. Deploy 후 `*.pages.dev` 주소로 접속합니다.
5. 도메인 구매 후 Pages → Custom domains에서 연결합니다.

## 공유 캘린더
현재 연결 주소: https://shared-calendar-4pu.pages.dev/

포트폴리오의 `#calendar` 페이지에 `홈 > 공유 캘린더` 경로를 표시합니다. 캘린더 앱 자체의 상단 경로를 바꾸려면 기존 `shared-calendar` 저장소를 별도로 수정해야 합니다.

## 같이 하는 게임
홈 메뉴의 `게임`에서 오목, 체스, 장기, 두더지 잡기 대결을 고를 수 있습니다. 방을 만들면 주소가 생기고, 그 주소를 받은 사람이 같은 판에 들어옵니다.

오목은 다섯 칸 이상이면 이깁니다. 체스는 캐슬링, 앙파상, 프로모션, 체크메이트, 스테일메이트를 판정합니다. 장기는 궁성, 마·상의 막힘, 포는 포를 넘거나 잡지 못하는 규칙, 장군, 외통, 한수쉼, 빅장을 판정합니다. 반복해서 같은 판이 나올 때의 점수 승부와 체스의 50수 규칙은 넣지 않았습니다. 두더지 잡기는 60초 동안 최대 4명이 같은 두더지를 먼저 누릅니다.

페이지를 배포하는 것만으로는 실시간 방이 연결되지 않습니다. 게임 방은 별도의 Cloudflare Worker 하나에 저장됩니다. 처음 한 번만 아래 순서로 연결하면 됩니다.

1. 이 저장소 폴더에서 `npm install`을 실행합니다.
2. `npx wrangler login`으로 Cloudflare 계정에 로그인합니다.
3. `npm run deploy:games`를 실행합니다. 성공하면 Worker 이름 `jeonghan-games`와 방 저장소 `GameRoom`이 만들어집니다.
4. Cloudflare 대시보드 → Workers & Pages → 이 사이트의 Pages 프로젝트 → Settings → Bindings → Add → Durable Object를 선택합니다.
5. 변수 이름은 `GAME_ROOMS`, 클래스 이름은 `GameRoom`, 스크립트 이름은 `jeonghan-games`로 적습니다.
6. Pages의 Deployments에서 최신 배포를 한 번 다시 배포합니다. 바인딩은 다시 배포해야 사이트에 적용됩니다.

연결 전에는 게임 화면은 열리지만, 방을 만들 때 "게임 서버가 아직 연결되지 않았습니다"라고 안내합니다. 홈, 만든이, 공유 캘린더는 이 연결과 상관없이 그대로 동작합니다.

로컬에서 두 브라우저로 확인하려면 `npm run dev` 후 `http://127.0.0.1:8787/games`를 엽니다.

## 수정
- 제목과 소개: `index.html` 내 `NES | Project Lab`, `아이디어를` 등을 검색
- 프로젝트: `id="projectGrid"` 안의 카드 편집
- 링크: 각 카드의 `href` 변경

주의: 회사의 비공개 자료, 내부 주소, 고객 정보, 계정/보안 설정 등은 공개 페이지에 올리지 마세요. 프로젝트 설명은 공개 가능한 수준으로 작성하세요.


## 공유 캘린더 iframe 통합
- `#calendar` 경로에서 기존 Cloudflare Pages 캘린더를 iframe으로 표시합니다.
- 상단 홈 링크와 브라우저 뒤로가기를 지원합니다.
- iframe 차단 또는 서드파티 쿠키 제한이 있는 경우 새 창에서 열기를 사용합니다.
- 캘린더 자체의 보안 헤더는 이 저장소에서 변경할 수 없습니다. 기존 캘린더 프로젝트에서 별도로 관리해야 합니다.
