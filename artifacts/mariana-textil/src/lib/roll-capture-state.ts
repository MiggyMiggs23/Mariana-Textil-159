export type RollCaptureCounts = {
  uniform: number;
  adjusted: number;
  blank: number;
};

export const isValidDeclaredRollCount = (value: string | number): boolean => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
};

export const createBlankRollQuantities = (count: number): string[] => (
  Array.from({ length: count }, () => "")
);

export const createUniformRollQuantities = (count: number, value: string): string[] => (
  Array.from({ length: count }, () => value)
);

export const applyUniformToBlankRolls = (values: string[], uniformValue: string): string[] => (
  values.map((value) => value.trim() === "" ? uniformValue : value)
);

export const isAdjustedRoll = (
  value: string,
  index: number,
  uniformBaseline: string | null,
  editedIndexes: ReadonlySet<number>,
): boolean => (
  value.trim() !== "" && (
    editedIndexes.has(index) ||
    (uniformBaseline !== null && Number(value) !== Number(uniformBaseline))
  )
);

export const getRollCaptureCounts = (
  values: string[],
  uniformBaseline: string | null,
  editedIndexes: ReadonlySet<number>,
): RollCaptureCounts => values.reduce<RollCaptureCounts>(
  (counts, value, index) => {
    if (value.trim() === "") {
      counts.blank += 1;
    } else if (isAdjustedRoll(value, index, uniformBaseline, editedIndexes)) {
      counts.adjusted += 1;
    } else if (uniformBaseline !== null && Number(value) === Number(uniformBaseline)) {
      counts.uniform += 1;
    } else {
      counts.adjusted += 1;
    }
    return counts;
  },
  { uniform: 0, adjusted: 0, blank: 0 },
);

export const resetRollToUniform = (
  values: string[],
  index: number,
  uniformBaseline: string,
): string[] => (
  values.map((value, currentIndex) => currentIndex === index ? uniformBaseline : value)
);