// Source-only gates. Read-only E7 never activates E5 operations.
export const E7_ENABLED = true;
export const E7_UI_ENABLED = true;
export const E7_CLIENT_FINANCIAL_READS_ENABLED = true;
export const E7_ATTRIBUTION_ENABLED = true;
export const e7On = () => E7_ENABLED && E7_UI_ENABLED && E7_ATTRIBUTION_ENABLED;
export const e7ClientFinancialOn = () =>
  E7_ENABLED && E7_UI_ENABLED && E7_CLIENT_FINANCIAL_READS_ENABLED;