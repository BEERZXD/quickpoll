export type PollResult = { optionId: string; count: number };

export function getWinningOptionIds(results: PollResult[]): string[] {
  const highScore = Math.max(0, ...results.map((result) => result.count));

  if (highScore === 0) {
    return [];
  }

  return results.filter((result) => result.count === highScore).map((result) => result.optionId);
}
