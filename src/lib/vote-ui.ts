import { getWinningOptionIds, type PollResult } from "./result-ui";

export type VoterUiStatus = "loading" | "live" | "closed";

export function canPickChoice(status: VoterUiStatus): boolean {
  return status === "live";
}

export function canClearVote({
  selectedOptionId,
  status,
}: {
  selectedOptionId: string | null;
  status: VoterUiStatus;
}): boolean {
  return status === "live" && selectedOptionId !== null;
}

export function shouldShowResults({ active, resultCount }: { active: boolean; resultCount: number }): boolean {
  return !active && resultCount > 0;
}

export function getVoterWinningOptionIds({
  active,
  results,
}: {
  active: boolean;
  results: PollResult[];
}): string[] {
  return active ? [] : getWinningOptionIds(results);
}
