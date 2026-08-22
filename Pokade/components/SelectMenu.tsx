"use client";

import { useEffect, useId, useRef, useState } from "react";

type Option<T extends string> = { key: T; label: string };

// 네이티브 <select>의 펼침 목록은 OS가 그려 CSS(rounded/border/그림자)가 닿지 않는다.
// 버튼 + 직접 그리는 목록 패널로 대체해 박스와 목록의 모서리·톤을 일치시킨 커스텀 드롭다운.
// WAI-ARIA listbox 패턴(방향키/Enter/Escape/Home/End, aria-activedescendant)을 따른다.
export default function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: T;
  options: Option<T>[];
  onChange: (key: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // 키보드 하이라이트 위치(마우스 hover와도 동기화). 열릴 때 현재 선택 항목으로 맞춘다.
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const selected = options.find((o) => o.key === value) ?? options[0];

  // 바깥 클릭 시 닫힘.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // 열릴 때: 활성 인덱스를 현재 선택으로 맞추고 목록에 포커스(키보드 조작 시작점).
  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.key === value);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 오픈 시점 1회 활성 인덱스 동기화
    setActiveIndex(idx < 0 ? 0 : idx);
    listRef.current?.focus();
  }, [open, value, options]);

  const commit = (key: T) => {
    onChange(key);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(options[activeIndex].key);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        className="flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] border-[#E4E4E9] bg-white py-2 pl-[15px] pr-3 text-[13.5px] font-semibold text-[#7A7A82] outline-none focus:border-primary"
      >
        <span>{selected.label}</span>
        <svg
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7A7A82"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={optionId(activeIndex)}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="dropdown-pop-in absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-[10px] border-[1.5px] border-[#E4E4E9] bg-white py-1 shadow-lift outline-none"
        >
          {options.map((o, i) => {
            const isSelected = o.key === value;
            const isActive = i === activeIndex;
            return (
              <li
                key={o.key}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(o.key)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap px-[15px] py-2 text-[13.5px] font-semibold ${
                  isActive ? "bg-neutral" : ""
                } ${isSelected ? "text-primary" : "text-[#4B4B52]"}`}
              >
                {o.label}
                {isSelected && (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
