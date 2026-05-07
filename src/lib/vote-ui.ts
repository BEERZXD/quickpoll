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

