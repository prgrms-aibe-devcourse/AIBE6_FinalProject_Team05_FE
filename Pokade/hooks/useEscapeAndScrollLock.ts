import { useEffect } from "react";

// 라이트박스, 필터 드로어 등 오버레이가 열려 있는 동안 배경 스크롤을 막고
// ESC 키로 닫을 수 있게 하는 공용 훅.
export function useEscapeAndScrollLock(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
}
