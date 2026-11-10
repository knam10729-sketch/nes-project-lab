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
