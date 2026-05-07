export type PollOption = {
  id: string;
  text: string;
};

export type PollConfig = {
  title: string;
  question: string;
  options: PollOption[];
};

export type PollResults = {
  optionId: string;
  count: number;
}[];

export type PollState = {
  active: boolean;
  poll: PollConfig;
  results: PollResults;
  voterCount: number;
  hostConnected: boolean;
  hostGraceDeleteAt: number | null;
};

export type CreatePollResponse = {
  roomCode: string;
  hostToken: string;
  hostUrl: string;
  voterUrl: string;
  state: PollState;
};

export type ServerMessage =
  | { type: "state"; state: PollState }
  | { type: "results"; state: PollState }
  | { type: "roomClosed"; reason: "stopped" | "host-timeout" | "closed" }
  | { type: "error"; message: string };

