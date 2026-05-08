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
  hasState,
}: {
  active: boolean;
  hasState: boolean;
}): {
  header: string;
  titleArea: string;
  actions: string;
} {
  if (hasState) {
    return {
      header: "flex flex-col items-stretch gap-4",
      titleArea: "min-w-0 w-full",
      actions: "order-first flex w-full flex-wrap items-start justify-between gap-2",
    };
  }

  return {
    header: "flex flex-wrap items-start justify-between gap-4",
    titleArea: "min-w-0 flex-1",
    actions: "flex flex-wrap gap-2",
  };
}
