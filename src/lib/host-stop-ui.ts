export type HostStoppedView = "newQuestion";

export { getWinningOptionIds } from "./result-ui";

export function shouldShowHostResults({
  active,
  stoppedView,
}: {
  active: boolean;
  stoppedView: HostStoppedView | null;
}): boolean {
  return active || stoppedView === null;
}

export function shouldShowHostNewQuestionForm({
  active,
  stoppedView,
}: {
  active: boolean;
  stoppedView: HostStoppedView | null;
}): boolean {
  return !active && stoppedView === "newQuestion";
}

export function hostHeaderLayoutClasses({
  active,
  hasState,
}: {
  active: boolean;
  hasState: boolean;
}): {
  header: string;
  titleArea: string;
  actions: string;
} {
  if (!active && hasState) {
    return {
      header: "flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between",
      titleArea: "min-w-0 w-full sm:flex-1",
      actions: "flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end",
    };
  }

  return {
    header: "flex flex-wrap items-start justify-between gap-4",
    titleArea: "min-w-0 flex-1",
    actions: "flex flex-wrap gap-2",
  };
}
