import { DaumPostcodeData } from "@/types/daum-postcode";

const SCRIPT_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

// 모듈 스코프에 캐시 - 여러 주소 입력 필드가 한 페이지에 있어도(받는사람/반송 주소 등) 스크립트는
// 한 번만 로드한다. 이미 로드돼 있으면(다른 페이지에서 먼저 썼거나) 즉시 resolve.
let loadPromise: Promise<void> | null = null;

export function loadDaumPostcodeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저 환경이 아닙니다."));
  if (window.daum?.Postcode) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null; // 실패 시 캐시를 비워 다음 시도가 재요청하게 한다.
      reject(new Error("주소 검색 스크립트를 불러오지 못했습니다."));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

// 우편번호 검색 팝업을 연다 - 라이브러리가 자체 팝업 레이어를 그려주므로 별도 모달 UI가 필요 없다.
export function openDaumPostcode(onComplete: (data: DaumPostcodeData) => void) {
  if (!window.daum?.Postcode) {
    throw new Error("주소 검색 스크립트가 아직 로드되지 않았습니다.");
  }
  new window.daum.Postcode({ oncomplete: onComplete }).open();
}
