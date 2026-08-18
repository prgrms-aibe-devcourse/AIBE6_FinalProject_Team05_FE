"use client";

import { useEffect } from "react";
import { recordVisit } from "@/lib/analyticsApi";

const SESSION_FLAG_KEY = "pokade_visit_recorded";

// 브라우저 세션(sessionStorage)당 1회만 방문을 기록한다 - 페이지 이동마다 재실행되는
// 이 컴포넌트가 매번 카운트를 올리면 "방문 수"가 아니라 "페이지뷰 수"가 되어버린다.
export default function VisitTracker() {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_FLAG_KEY)) return;
    sessionStorage.setItem(SESSION_FLAG_KEY, "1");
    recordVisit().catch(() => {});
  }, []);
  return null;
}
