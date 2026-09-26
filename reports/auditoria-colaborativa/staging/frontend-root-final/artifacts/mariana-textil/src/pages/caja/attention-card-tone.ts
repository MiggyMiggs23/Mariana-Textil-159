/** Color signals nonzero operational activity, never just the category. */
export function attentionCardTone(
  color: "amber" | "red",
  count: number | undefined,
  amount: string | number | undefined,
  exceedsThreshold = false,
) {
  const nonzero = (value: number | string | undefined) =>
    Number.isFinite(Number(value)) && Number(value) !== 0;
  const active = nonzero(count) || nonzero(amount);
  if (!active) {
    return {
      active, state: "neutral",
      card: "border-sidebar/10 bg-card",
      title: "text-muted-foreground",
      text: "text-foreground",
      icon: "text-muted-foreground",
    };
  }
  if (color === "amber") {
    return {
      active, state: "attention",
      card: "border-amber-300 bg-amber-50",
      title: "text-amber-900", text: "text-amber-950", icon: "text-amber-800",
    };
  }
  return exceedsThreshold
    ? {
        active, state: "elevated",
        card: "border-red-700 bg-red-200 ring-2 ring-red-700",
        title: "text-red-950", text: "text-red-950", icon: "text-red-900",
      }
    : {
        active, state: "attention",
        card: "border-red-300 bg-red-50",
        title: "text-red-900", text: "text-red-950", icon: "text-red-800",
      };
}