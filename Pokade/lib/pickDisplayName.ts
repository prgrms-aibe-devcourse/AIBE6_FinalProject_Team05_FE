// BE 검색(/api/cards/search?q=)은 name/nameKo 양쪽에 OR로 매칭되므로,
// 검색어가 실제로 매칭된 필드를 표시 이름으로 골라야 highlightMatch가 항상 하이라이트를 그릴 수 있다.
// highlightMatch와 동일하게 대소문자를 무시하고 비교한다.
export function pickDisplayName(
  card: { name: string; nameKo?: string | null },
  query: string,
): string {
  const trimmed = query.trim();
  if (!trimmed) return card.nameKo ?? card.name;

  const q = trimmed.toLowerCase();
  if (card.nameKo && card.nameKo.toLowerCase().includes(q)) return card.nameKo;
  if (card.name.toLowerCase().includes(q)) return card.name;
  return card.nameKo ?? card.name;
}
