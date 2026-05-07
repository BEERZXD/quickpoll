export type PollFormInput = {
  title: string;
  question: string;
  options: string[];
};

export type BuildPollPayloadInput = PollFormInput & {
  now?: Date;
};

export type BuildFollowUpPollPayloadInput = Omit<PollFormInput, "title"> & {
  currentTitle: string;
};

export type PollPayload = {
  title: string;
  question: string;
  options: string[];
};

export function formatDefaultPollTitle(date = new Date()): string {
  const day = padDatePart(date.getDate());
  const month = padDatePart(date.getMonth() + 1);
  const year = date.getFullYear();
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());

  return `Poll ${day}/${month}/${year} : ${hour}:${minute}`;
}

export function canSubmitPollForm(input: PollFormInput): boolean {
  return (
    normalizeText(input.question).length > 0 &&
    input.options.length >= 2 &&
    input.options.length <= 8 &&
    input.options.every((option) => normalizeText(option).length > 0)
  );
}

export function buildPollPayload(input: BuildPollPayloadInput): PollPayload {
  const title = normalizeText(input.title) || formatDefaultPollTitle(input.now);

  return {
    title: title.slice(0, 80),
    question: normalizeText(input.question).slice(0, 140),
    options: input.options
      .map((option) => normalizeText(option).slice(0, 80))
      .filter((option) => option.length > 0),
  };
}

export function buildFollowUpPollPayload(input: BuildFollowUpPollPayloadInput): PollPayload {
  return buildPollPayload({
    title: input.currentTitle,
    question: input.question,
    options: input.options,
  });
}

export function removePollOptionAt(options: string[], index: number): string[] {
  if (options.length <= 2 || index < 0 || index >= options.length) {
    return options;
  }

  return options.filter((_, optionIndex) => optionIndex !== index);
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
