export const CREDIT_TERMS = [7, 15, 30, 60] as const;

export type CreditTerm = (typeof CREDIT_TERMS)[number];
export type ClientCreditTerm = 0 | CreditTerm;

export function allowedCreditTerm(value: unknown): CreditTerm | null {
  return typeof value === "number" &&
    CREDIT_TERMS.includes(value as CreditTerm)
    ? (value as CreditTerm)
    : null;
}

export function creditTermOnSelectionChange(
  wasCreditActive: boolean,
  isCreditSelected: boolean,
  currentTerm: CreditTerm | null,
  habitualTerm: unknown,
): CreditTerm | null {
  if (!isCreditSelected) return null;
  return wasCreditActive ? currentTerm : allowedCreditTerm(habitualTerm);
}