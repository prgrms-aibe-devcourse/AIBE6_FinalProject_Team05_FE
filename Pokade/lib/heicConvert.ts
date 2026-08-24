// 아이폰 "고효율" 카메라 설정으로 찍은 사진은 HEIC로 저장되는데, OpenAI Vision이 HEIC를
// 지원하지 않는다. 일반 Safari는 <input type="file">에서 이를 알아서 JPEG로 재인코딩해
// 넘겨주지만, 카카오톡/인스타그램 인앱 브라우저(WebView) 등에서는 원본 HEIC가 그대로 올라올
// 수 있어 업로드 시점에 감지해 변환해준다.
function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  if (type) return false; // 타입이 있는데 heic가 아니면 확실히 heic가 아님
  return /\.hei[cf]$/i.test(file.name);
}

export async function ensureUploadableImage(file: File): Promise<File> {
  if (!isHeic(file)) return file;

  try {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    const name = file.name.replace(/\.hei[cf]$/i, ".jpg");
    return new File([blob], name || "photo.jpg", { type: "image/jpeg" });
  } catch {
    // 변환 실패 시 원본을 그대로 반환 — 제출 시점의 기존 형식 검증/에러 처리에 맡긴다.
    return file;
  }
}
