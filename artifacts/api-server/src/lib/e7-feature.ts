/** Source-only gates. Client reads do not activate E5 operations or attribution. */
export const E7_ENABLED: boolean = true;
export const E7_CLIENT_FINANCIAL_READS_ENABLED: boolean = true;
export const E7_ATTRIBUTION_ENABLED: boolean = false;
/** Tanda B installed this read source; this is not the E5 operational gate. */
export const E7_E5_READ_SOURCE_ENABLED: boolean = true;