const STORAGE_KEY = "pocket-trade:chat-session-id";
const IMPORT_QUEUE_KEY = "pocket-trade:chat-import-queue";
// 서버가 24시간 초과 항목을 skip하므로 클라이언트도 같은 기준으로 필터링
const IMPORT_TTL_MS = 24 * 60 * 60 * 1000;
// 서버 허용 최대 entries 수
const IMPORT_QUEUE_MAX = 20;
// 서버가 처리하는 presetId — 이 목록 외에는 큐에 쌓지 않는다
const IMPORT_PRESET_IDS = new Set(["top-gainers", "top-losers"]);

export interface ImportQueueEntry {
  presetId: string;
  askedAt: string; // ISO-8601
}

function readImportQueue(): ImportQueueEntry[] {
  try {
    const raw = window.localStorage.getItem(IMPORT_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as ImportQueueEntry[]) : [];
  } catch {
    return [];
  }
}

function writeImportQueue(queue: ImportQueueEntry[]): void {
  try {
    window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

// 비로그인 프리셋 클릭 시 호출 — top-gainers/top-losers만 큐에 쌓는다.
// 24시간 만료 항목 정리 + 최대 20개 초과분(오래된 것)도 제거.
export function pushToImportQueue(presetId: string): void {
  if (typeof window === "undefined") return;
  if (!IMPORT_PRESET_IDS.has(presetId)) return;
  const now = Date.now();
  let queue = readImportQueue().filter(
    (e) => now - new Date(e.askedAt).getTime() < IMPORT_TTL_MS,
  );
  queue.push({ presetId, askedAt: new Date().toISOString() });
  if (queue.length > IMPORT_QUEUE_MAX) queue = queue.slice(queue.length - IMPORT_QUEUE_MAX);
  writeImportQueue(queue);
}

// 전송할 유효 항목 반환 — 큐는 건드리지 않는다.
// 전송 성공 후 removeImportQueueEntries로 제거할 것.
export function peekImportQueue(): ImportQueueEntry[] {
  if (typeof window === "undefined") return [];
  const now = Date.now();
  return readImportQueue().filter((e) => now - new Date(e.askedAt).getTime() < IMPORT_TTL_MS);
}

// 전송 성공한 항목만 큐에서 제거 (askedAt을 unique key로 사용).
// 실패 시에는 호출하지 않아 다음 로그인 때 재시도 가능.
export function removeImportQueueEntries(sent: ImportQueueEntry[]): void {
  if (typeof window === "undefined") return;
  const sentSet = new Set(sent.map((e) => e.askedAt));
  writeImportQueue(readImportQueue().filter((e) => !sentSet.has(e.askedAt)));
}

// 챗봇 세션 ID — 최초 진입 시 UUID를 생성해 localStorage에 저장, 이후 재사용.
// 비로그인 상태에서도 대화가 이어지도록 로그아웃해도 지우지 않는다.
export function getChatSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
