import { useState } from "react";

/** Request generations are not authorization. Every read is authorized by the
 * server; fresh /auth/me verification separately controls row visibility. */
export type DirectoryVerification = {
  identity: string;
  verifying: boolean;
  denied: boolean;
};
export type DirectoryReadGeneration = DirectoryVerification & { generation: number };

export function advanceDirectoryReadGeneration(
  previous: DirectoryReadGeneration,
  current: DirectoryVerification,
): DirectoryReadGeneration {
  if (previous.identity === current.identity && previous.verifying === current.verifying && previous.denied === current.denied) return previous;
  const invalidate = previous.identity !== current.identity ||
    (!previous.verifying && current.verifying) || previous.denied !== current.denied;
  return { ...current, generation: previous.generation + Number(invalidate) };
}

export function directoryRowsVisible(input: {
  active: boolean; userPresent: boolean; authSuccess: boolean;
  verifying: boolean; canView: boolean;
}): boolean {
  return input.active && input.userPresent && input.authSuccess && !input.verifying && input.canView;
}

export function useDirectoryReadPartition(current: DirectoryVerification): string {
  const [mountId] = useState(() => crypto.randomUUID());
  const [previous, setPrevious] = useState<DirectoryReadGeneration>(
    () => ({ ...current, generation: 0 }),
  );
  const next = advanceDirectoryReadGeneration(previous, current);
  if (next !== previous) setPrevious(next);
  return `${mountId}:${next.generation}`;
}