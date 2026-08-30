export const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_SOURCE_FAILURE_LIMIT = 5;
export const LOGIN_GLOBAL_USERNAME_FAILURE_LIMIT = 15;

export type LoginLockoutReason = "source" | "global" | null;

export function getLoginLockoutReason(input: {
  sourceFailures: number;
  globalFailures: number;
}): LoginLockoutReason {
  if (input.globalFailures >= LOGIN_GLOBAL_USERNAME_FAILURE_LIMIT) {
    return "global";
  }
  if (input.sourceFailures >= LOGIN_SOURCE_FAILURE_LIMIT) {
    return "source";
  }
  return null;
}