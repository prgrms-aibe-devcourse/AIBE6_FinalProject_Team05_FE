import { useCallback, useEffect, useRef, useState } from "react";

// "복사됨", "등록됨" 같은 N초짜리 성공 피드백에 쓰는 훅. trigger()를 호출하면 flag가 true가
// 되고 ms 이후 자동으로 false로 돌아오며, 연속 호출 시 이전 타이머를 취소하고 다시 잰다.
export function useTimedFlag(ms: number) {
  const [flag, setFlag] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const trigger = useCallback(() => {
    setFlag(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFlag(false), ms);
  }, [ms]);

  return [flag, trigger] as const;
}
