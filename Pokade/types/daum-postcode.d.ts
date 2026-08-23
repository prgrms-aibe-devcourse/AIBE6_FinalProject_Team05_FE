// 다음(카카오) 우편번호 서비스 - https://postcode.map.daum.net 스크립트가 전역에 심는 window.daum.
// 공식 타입 패키지가 없어(비공식 @types만 존재) 실제 쓰는 필드만 최소한으로 선언한다.
export interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: "R" | "J";
}

interface DaumPostcodeOptions {
  oncomplete: (data: DaumPostcodeData) => void;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: DaumPostcodeOptions) => { open: () => void };
    };
  }
}

export {};
