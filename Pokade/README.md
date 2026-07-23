# PocketTrade — Next.js 14 + TypeScript + TailwindCSS

포켓몬 카드 리세일/트레이딩 웹 플랫폼 "PocketTrade"의 프론트엔드 프로젝트입니다.
9개 화면을 Next.js App Router 구조로 구현했습니다.

## 시작하기

```bash
npm install
npm run dev
# http://localhost:3000
```

빌드:

```bash
npm run build && npm start
```

## 기술 스택

- **Next.js 14** (App Router, `app/` 디렉터리)
- **TypeScript** (strict)
- **TailwindCSS 3** — 색상/폰트/그림자를 디자인 토큰으로 정의
- **Pretendard** 웹폰트 (globals.css 에서 import)

## 폴더 구조

```
app/
  layout.tsx              루트 레이아웃 (html/body, Pretendard)
  globals.css             Tailwind + 폰트 + sticky-footer scaffold
  page.tsx                홈 / 랜딩 (/)
  login/page.tsx          로그인 (/login)
  signup/page.tsx         회원가입 3단계 (/signup)
  trade-status/page.tsx   거래 상태 (/trade-status)
  chat/page.tsx           챗봇 (/chat)
  watchlist/page.tsx      워치리스트 (/watchlist)
  ai-diagnosis/page.tsx   AI 등급진단 4-state (/ai-diagnosis)
  search/page.tsx         검색 / 시세 대시보드 (/search)
  admin/reports/page.tsx  신고/제재 관리 (운영자) (/admin/reports)
  */layout.tsx            각 라우트의 브라우저 탭 타이틀 metadata

components/
  Header.tsx        모든 페이지 공통 헤더 (usePathname으로 variant/active 자동 판단)
  Footer.tsx        모든 페이지 공통 푸터
  GradeBadge.tsx    등급 뱃지 (S / A / B)
  ConditionBar.tsx  10-세그먼트 컨디션/서브스코어 바
  CardImage.tsx     카드 이미지 플레이스홀더

tailwind.config.ts  디자인 토큰
```

## 공통 컴포넌트 사용법

Header/Footer는 `app/layout.tsx`(루트 레이아웃) 한 곳에서만 렌더링합니다.
각 페이지는 `<main className="main-content ...">`만 반환하면 됩니다.

```tsx
// app/layout.tsx
<div className="page-container">
  <Header /> {/* 현재 경로(usePathname)로 variant·active 자동 결정 */}
  {children} {/* = 각 페이지의 <main> */}
  <Footer />
</div>
```

Header 상태 규칙(경로 기반 자동):

- `/chat` `/watchlist` `/trade-status` `/ai-diagnosis` → 로그인 상태(검색바+알림+프로필)
  - 알림 벨 클릭 → 알림 드롭다운(안읽음 빨간점/상대시간/전체보기), 프로필 클릭 → 프로필 드롭다운(닉네임·이메일/메뉴/로그아웃), 바깥 클릭 시 닫힘
- `/admin/*` → 운영자
- 그 외(홈/검색/로그인/회원가입) → 로그아웃(로그인·회원가입 버튼)

등급 뱃지 / 컨디션 바:

```tsx
<GradeBadge grade="S" size="md" />   {/* S | A | B */}
<ConditionBar filled={9} color="bg-secondary" />
```

## 디자인 토큰 (tailwind.config.ts)

| 토큰           | 값        | 용도                        |
| -------------- | --------- | --------------------------- |
| `primary`      | `#EE1515` | Primary (CTA, 로고)         |
| `primary.dark` | `#B80F0F` | CTA 버튼 2px 테두리         |
| `secondary`    | `#3B4CCA` | Secondary (차트, 등급바)    |
| `tertiary`     | `#FFCB05` | Tertiary (카운트다운, 강조) |
| `neutral`      | `#F7F7F8` | 배경 뉴트럴                 |
| `navy`         | `#141A34` | Hero / 인사이트 패널        |
| `lavender`     | `#EEF0FA` | 푸터 배경                   |
| `grade.s`      | `#FFCB05` | 등급 S (최상, 골드)         |
| `grade.a`      | `#3B4CCA` | 등급 A (블루)               |
| `grade.b`      | `#9CA3AF` | 등급 B (차분한 그레이)      |

그림자 `shadow-tactile` 계열은 버튼의 은은한 tactile(눌리는) 효과에 사용합니다.

## 참고

- 배경은 항상 단색(솔리드)만 사용 — 그라디언트/패턴 없음.
- 카드 이미지는 `CardImage` 플레이스홀더입니다. 실제 이미지 컴포넌트(`next/image`)로 교체하면 됩니다.
- 인터랙션(탭/토글/슬라이드인)은 `"use client"` 페이지에서 `useState` 로 처리합니다.
- 저작권 표기: © 2026 POCKET TRADE.
