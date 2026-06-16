// 사용자에게 보여줄 표기 포맷 모음

// 관객수 표기 (모두 내림)
// - 500만(5,000,000) 이상: 50만 단위로 내림 → 753만 → "750만"
// - 500만 미만: 10만 단위로 내림 → 254.7만 → "250만"
// - 10만 미만: 만 단위 내림
// 값이 없으면 null (호출부에서 미표시)
export function formatAudience(value) {
  const v = Number(value);
  if (!v || Number.isNaN(v) || v <= 0) return null;
  if (v >= 5000000) return `${Math.floor(v / 500000) * 50}만`;
  if (v >= 100000) return `${Math.floor(v / 100000) * 10}만`;
  const man = Math.floor(v / 10000);
  return man > 0 ? `${man}만` : null;
}
