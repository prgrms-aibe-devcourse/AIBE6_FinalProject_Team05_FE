"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>문제가 발생했습니다</h1>
          <p style={{ marginTop: 10, color: "#7A7A82" }}>페이지를 표시하지 못했습니다.</p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              background: "#EE1515",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
