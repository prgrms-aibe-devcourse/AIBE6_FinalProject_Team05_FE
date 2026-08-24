// 아이폰 "고효율" 카메라 설정으로 찍은 사진은 HEIC로 저장되는데, OpenAI Vision이 HEIC를
// 지원하지 않는다. 일반 Safari는 <input type="file">에서 이를 알아서 JPEG로 재인코딩해
// 넘겨주지만, 카카오톡/인스타그램 인앱 브라우저(WebView) 등에서는 원본 HEIC가 그대로 올라올
// 수 있어 업로드 시점에 감지해 변환해준다.
function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  if (type.startsWith("image/")) return false; // 명확한 다른 이미지 포맷이면 heic가 아님
  // 타입이 비어있거나 application/octet-stream 같은 범용 값이면 파일명 확장자로 판단
  return /\.hei[cf]$/i.test(file.name);
}

// EXIF Orientation(1~8) 값에 맞춰 캔버스에 그릴 때 적용할 변환 행렬.
// heic2any(libheif)는 회전 정보를 무시하고 센서가 찍은 그대로의 픽셀을 내보내는 경우가 있어,
// 원본 HEIC의 방향 태그를 직접 읽어 우리가 캔버스로 바로잡아준다.
// 참고: https://github.com/strukturag/libheif/issues/227
const ORIENTATION_TRANSFORMS: Record<
  number,
  { swapDimensions: boolean; apply: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }
> = {
  2: { swapDimensions: false, apply: (ctx, w) => ctx.transform(-1, 0, 0, 1, w, 0) },
  3: { swapDimensions: false, apply: (ctx, w, h) => ctx.transform(-1, 0, 0, -1, w, h) },
  4: { swapDimensions: false, apply: (ctx, _w, h) => ctx.transform(1, 0, 0, -1, 0, h) },
  5: { swapDimensions: true, apply: (ctx) => ctx.transform(0, 1, 1, 0, 0, 0) },
  6: { swapDimensions: true, apply: (ctx, _w, h) => ctx.transform(0, 1, -1, 0, h, 0) },
  7: { swapDimensions: true, apply: (ctx, w, h) => ctx.transform(0, -1, -1, 0, h, w) },
  8: { swapDimensions: true, apply: (ctx, w) => ctx.transform(0, -1, 1, 0, 0, w) },
};

async function correctOrientation(blob: Blob, orientation: number | undefined): Promise<Blob> {
  const transform = orientation ? ORIENTATION_TRANSFORMS[orientation] : undefined;
  if (!transform) return blob; // orientation 1(정상) 또는 미확인이면 그대로 둔다

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = transform.swapDimensions ? bitmap.height : bitmap.width;
  canvas.height = transform.swapDimensions ? bitmap.width : bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;
  transform.apply(ctx, bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);

  const rotated = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  return rotated ?? blob;
}

export async function ensureUploadableImage(file: File): Promise<File> {
  if (!isHeic(file)) return file;

  try {
    const [heic2any, exifr] = await Promise.all([
      import("heic2any").then((m) => m.default),
      import("exifr"),
    ]);
    const [converted, orientation] = await Promise.all([
      heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 }),
      exifr.orientation(file).catch(() => undefined),
    ]);
    const blob = Array.isArray(converted) ? converted[0] : converted;
    const corrected = await correctOrientation(blob, orientation);
    const name = file.name.replace(/\.hei[cf]$/i, ".jpg");
    return new File([corrected], name || "photo.jpg", { type: "image/jpeg" });
  } catch {
    // 변환 실패 시 원본을 그대로 반환 — 제출 시점의 기존 형식 검증/에러 처리에 맡긴다.
    return file;
  }
}
