function getVariation(current, prev) {
  const c = Number(current);
  const p = Number(prev);
  if (p === 0) return c > 0 ? 100 : 0;
  return ((c - p) / Math.abs(p)) * 100;
}
console.log(getVariation("150", "100")); // 50
console.log(getVariation("50", "100")); // -50
