import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

// 이 페이지 전용 FAQ 하나만 쓰는 아코디언 — @radix-ui/react-accordion을 새로
// 설치하는 대신 네이티브 <details>/<summary>로 충분해서 그대로 쓴다.
export function Accordion({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function AccordionItem({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="future-accordion-item">
      <summary>
        {question}
        <ChevronDown size={18} />
      </summary>
      <p>{children}</p>
    </details>
  );
}
