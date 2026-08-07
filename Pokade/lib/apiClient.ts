import { getAccessToken, setAccessToken } from "@/lib/authToken";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const REQUEST_TIMEOUT_MS = 10000; // 10초 — 일반 CRUD 기준

// AI 등급 진단(POST /api/ai/grade)은 이미지 6장 업로드 후 S3 업로드 6회 + 서버측 품질검사 +
// Vision 모델 호출이 동기로 실행돼 수십 초~2분이 걸린다. 기본 10초로는 브라우저가 먼저
// 요청을 끊어(nginx 499) 서버가 정상인데도 실패로 보인다. nginx proxy_read_timeout(180s)과 정렬.
const UPLOAD_TIMEOUT_MS = 180_000; // 3분

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

// 진행 중인 reissue를 하나로 합침 - 동시 호출(StrictMode 이중 마운트, 동시 401)이 reissue를 한 번만 보내게
let reissuePromise: Promise<string | null> | null = null;

export function reissueAccessToken(): Promise<string | null> {
  if (!reissuePromise) {
    reissuePromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/reissue`, {
          method: "POST",
          credentials: "include", // refresh 쿠키 송수신 (login Set-Cookie / reissue·logout 전송)
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as ApiEnvelope<{ accessToken: string }>;
        setAccessToken(body.data.accessToken);
        return body.data.accessToken;
      } catch {
        return null;
      } finally {
        reissuePromise = null;
      }
    })();
  }
  return reissuePromise;
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

// 공통 요청 - access 토큰이 있으면 Authorization 자동 첨부 + refresh 쿠키 동봉(credentials)
async function request(
  path: string,
  init: RequestInit = {},
  retry = true,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "include", // refresh 쿠키 송수신 (login Set-Cookie / reissue·logout 전송)
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    // 타임아웃(AbortSignal.timeout)과 연결 실패를 구분한다 — 둘 다 NETWORK_ERROR로 뭉개면
    // 서버가 정상 동작 중인데도 "BE 서버 실행 여부를 확인해 주세요"가 떠서 원인 파악을 방해한다.
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new ApiError(
        0,
        "REQUEST_TIMEOUT",
        `응답이 너무 오래 걸려 요청을 중단했습니다. (${Math.round(timeoutMs / 1000)}초 초과)`,
      );
    }
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "서버에 연결할 수 없습니다. BE 서버 실행 여부를 확인해 주세요.",
    );
  }
  //access 만료(401) → reissue 후 원요청 1회 재시도 (auth 엔드포인트 자신은 제외)
  if (res.status === 401 && retry && !path.startsWith("/api/auth/")) {
    const newToken = await reissueAccessToken();
    if (newToken) {
      return request(path, init, false, timeoutMs); // 재귀 호출 시 retry=false로 무한 루프 방지
    }
  }

  if (!res.ok) {
    let code = String(res.status);
    let msg = `요청이 실패했습니다. (${res.status})`;
    try {
      const body = (await res.json()) as ApiEnvelope<unknown>;
      if (body?.code) code = body.code;
      const parsedMsg = body?.message ?? body?.msg;
      if (parsedMsg) {
        if (isJavaExceptionMessage(parsedMsg)) {
          msg =
            res.status >= 500
              ? "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
              : "잘못된 요청입니다.";
        } else {
          msg = parsedMsg;
        }
      }
    } catch {
      // 에러 응답 본문이 JSON이 아닐 수 있음
    }
    throw new ApiError(res.status, code, msg);
  }

  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(path);
  const body = (await res.json()) as ApiEnvelope<T>;
  return body.data;
}

// ApiResponse 래퍼 없이 raw body를 그대로 내려주는 엔드포인트용 (예: GET /api/listings).
export async function apiGetRaw<T>(path: string): Promise<T> {
  const res = await request(path);
  return (await res.json()) as T;
}

// 멀티파트 업로드용 (예: POST /api/ai/grade). apiPost와 달리 Content-Type을 강제하지
// 않아야 브라우저가 FormData의 boundary를 포함한 multipart/form-data를 자동으로 설정한다.
// 응답도 ApiResponse 래퍼 없이 raw body 그대로 내려주는 엔드포인트용.
export async function apiPostFormRaw<T>(path: string, formData: FormData): Promise<T> {
  const res = await request(
    path,
    {
      method: "POST",
      body: formData,
    },
    true,
    UPLOAD_TIMEOUT_MS, // 업로드 + AI 추론이 10초를 크게 넘긴다
  );
  return (await res.json()) as T;
}

async function requestWrapped<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await request(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return text ? (JSON.parse(text) as ApiEnvelope<T>).data : (undefined as T);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return requestWrapped<T>("POST", path, body);
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return requestWrapped<T>("PUT", path, body);
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return requestWrapped<T>("PATCH", path, body);
}

// ApiResponse<Void> 래퍼 응답(성공 메시지만 있고 data는 없음)을 반환하는 삭제용.
export async function apiDelete(path: string): Promise<void> {
  await request(path, { method: "DELETE" });
}

