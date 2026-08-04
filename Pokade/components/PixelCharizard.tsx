// 진단 이력이 없을 때 보여주는 도트(픽셀 아트) 리자몽 일러스트.
// 참고 이미지를 28x28 그리드로 샘플링한 뒤 색상을 몇 가지로 단순화해서 그대로 옮긴 패턴.
const ROWS: string[] = [
  ".....................D.....",
  "....................ddD....",
  "....................ddD....",
  "...................DRRdD...",
  "...................DRoRD...",
  "...................DRYRRD..",
  ".....DD...DDD.DD....doYoD..",
  "....Ddd..ddRdDdoddD.dRYdD..",
  "....dRd.dRddRRRdoddDDddD...",
  "....ddD.ddDDdRRDodoRdDdRD..",
  "...dodDdodD.DddooGGdooddd..",
  "...doooooddDDdoodGGGdodddD.",
  "..DooooYoooddooodoGGGGdDod.",
  "..DooodDodoooodoodddGGddddD",
  ".DRoodGodddoYYYDdododD.dDdD",
  "DdoooododdDDYYYYYdoDodDdddD",
  ".doRddddRdDdYYYYDdoDodoodD.",
  "..dddD.DddDodDYDdoddoddod..",
  "...........dood.oddoodDD...",
  "............DDDDD.dodD.....",
  "...............DDdoodD.....",
  ".................DdDD......",
];

const COLORS: Record<string, string> = {
  D: "#3A2A1F", // 외곽선
  d: "#B5651D", // 어두운 주황(음영)
  o: "#FF9320", // 몸통(주황)
  R: "#C53838", // 빨강(코/입가)
  Y: "#EFDC48", // 노랑(배/불꽃)
  G: "#33A454", // 초록(날개 포인트)
};

export default function PixelCharizard({ className = "" }: { className?: string }) {
  const grid = ROWS.map((row) => row.split(""));
  const width = grid[0]?.length ?? 0;
  const height = grid.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * 6}
      height={height * 6}
      className={className}
      style={{ imageRendering: "pixelated" }}
      shapeRendering="crispEdges"
      role="img"
      aria-label="도트로 그린 리자몽"
    >
      {grid.map((row, r) =>
        row.map((ch, c) => {
          const color = COLORS[ch];
          if (!color) return null;
          return <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={color} />;
        }),
      )}
    </svg>
  );
}
