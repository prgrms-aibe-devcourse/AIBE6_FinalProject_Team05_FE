export default function Loading() {
  return (
    <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E2E2E8] border-t-primary" />
        <p className="text-[13.5px] font-semibold text-[#8A8A92]">불러오는 중…</p>
      </div>
    </main>
  );
}
