"use client";

import { useEffect, useState } from "react";
import { loadDaumPostcodeScript, openDaumPostcode } from "@/lib/daumPostcode";

// 다음(카카오) 우편번호 서비스로 도로명/지번 주소를 검색해 채우고, 상세주소(동/호수 등)만 직접
// 입력받는다. BE의 주소 컬럼(returnAddress/recipientAddress)은 문자열 하나뿐이라, 최종적으로
// "[12345] 서울시 ... 101동 202호" 형태로 합쳐 onChange로 넘긴다 - 부모는 기존처럼 문자열 하나만
// 다루면 되므로 4개 주문서 페이지(listings/new, buy-offers/new, buy-offers/fulfill, trades/checkout)
// 전부 이 컴포넌트 하나로 교체할 수 있다.
export default function AddressSearchField({
  onChange,
  inputCls,
}: {
  onChange: (value: string) => void;
  inputCls: string;
}) {
  const [zonecode, setZonecode] = useState("");
  const [baseAddress, setBaseAddress] = useState("");
  const [detailAddress, setDetailAddress] = useState("");
  const [scriptError, setScriptError] = useState(false);

  useEffect(() => {
    // 버튼을 누르기 전에 미리 로드해둬 첫 클릭에서 지연 없이 팝업이 뜨게 한다 - 실패해도
    // 여기서는 조용히 무시하고, 실제 클릭 시 handleSearch가 다시 시도한다.
    loadDaumPostcodeScript().catch(() => {});
  }, []);

  const combine = (zc: string, base: string, detail: string) => {
    if (!base) return "";
    const detailPart = detail.trim() ? ` ${detail.trim()}` : "";
    return zc ? `[${zc}] ${base}${detailPart}` : `${base}${detailPart}`;
  };

  const handleSearch = async () => {
    try {
      await loadDaumPostcodeScript();
      setScriptError(false);
      openDaumPostcode((data) => {
        const address = data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress;
        setZonecode(data.zonecode);
        setBaseAddress(address);
        onChange(combine(data.zonecode, address, detailAddress));
      });
    } catch {
      setScriptError(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={zonecode}
          readOnly
          aria-label="우편번호"
          placeholder="우편번호"
          className={`${inputCls} w-28 bg-neutral text-[#8A8A92]`}
        />
        <button
          type="button"
          onClick={handleSearch}
          className="shrink-0 rounded-[11px] border border-[#DDDDE3] bg-white px-4 text-[13px] font-bold text-[#4B4B52] transition hover:border-primary hover:text-primary"
        >
          주소 검색
        </button>
      </div>
      <input
        type="text"
        value={baseAddress}
        readOnly
        aria-label="기본 주소"
        placeholder="주소 검색을 눌러 입력해 주세요"
        className={`${inputCls} bg-neutral text-[#8A8A92]`}
      />
      <input
        type="text"
        value={detailAddress}
        onChange={(e) => {
          setDetailAddress(e.target.value);
          onChange(combine(zonecode, baseAddress, e.target.value));
        }}
        aria-label="상세 주소"
        placeholder="상세 주소 (동/호수 등)"
        disabled={!baseAddress}
        className={`${inputCls} disabled:cursor-not-allowed disabled:bg-neutral disabled:text-[#9A9AA2]`}
      />
      {scriptError && (
        <p className="text-[12px] font-semibold text-primary">
          주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      )}
    </div>
  );
}
