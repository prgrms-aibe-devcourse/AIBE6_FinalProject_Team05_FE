const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

// BE ApiResponse<T> 래퍼 (com.pokade.global.response.ApiResponse) 미러링.
// 성공 응답은 msg, 에러 응답(ErrorResponse)은 message 필드를 쓰는 등 필드명이
// 아직 팀 내 통일이 안 돼 있어 둘 다 대응한다.
export interface ApiEnvelope<T> {
  status: number;
  code: string;
  msg?: string;
  message?: string;
  data: T;
}

// Spring Data Page<T> JSON 직렬화 형태.
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// BE가 의도적으로 내려주는 사용자 친화적 400 메시지(필터 값 검증 실패 등)와 달리,
// 컨트롤러 이전 단계에서 터진 Java 예외(예: @PathVariable Long 파싱 실패 시
// "For input string: \"abc\"")는 메시지가 그대로 노출된다 — 이런 형태만 골라서
// 일반화된 문구로 대체한다.
const JAVA_EXCEPTION_MESSAGE_PATTERNS = [
  /for input string/i,
  /^(java\.[\w.]+|[\w.]*[A-Z]\w*Exception)\b/,
];

function isJavaExceptionMessage(message: string): boolean {
  return JAVA_EXCEPTION_MESSAGE_PATTERNS.some((p) => p.test(message));
}

async function fetchOk(path: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "서버에 연결할 수 없습니다. BE 서버 실행 여부를 확인해 주세요.",
    );
  }

  if (!res.ok) {
    let code = String(res.status);
    let msg = `요청이 실패했습니다. (${res.status})`;
    try {
      const body = (await res.json()) as ApiEnvelope<unknown>;
      if (body?.code) code = body.code;
      const parsedMsg = body?.message ?? body?.msg;
      if (parsedMsg) {
        msg =
          res.status === 400 && isJavaExceptionMessage(parsedMsg)
            ? "잘못된 요청입니다."
            : parsedMsg;
      }
    } catch {
      // 에러 응답 본문이 JSON이 아닐 수 있음 — 기본 메시지 사용.
    }
    throw new ApiError(res.status, code, msg);
  }

  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchOk(path);
  const body = (await res.json()) as ApiEnvelope<T>;
  return body.data;
}

// ApiResponse 래퍼 없이 raw body를 그대로 내려주는 엔드포인트용 (예: GET /api/listings).
export async function apiGetRaw<T>(path: string): Promise<T> {
  const res = await fetchOk(path);
  return (await res.json()) as T;
}
