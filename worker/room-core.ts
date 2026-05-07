export type PollOption = {
  id: string;
  text: string;
};

export type PollConfig = {
  title: string;
  question: string;
  options: PollOption[];
};

export type PollRoomSnapshot = {
  active: boolean;
  poll: PollConfig;
  results: { optionId: string; count: number }[];
  voterCount: number;
  hostConnected: boolean;
  hostGraceDeleteAt: number | null;
};

export type HostEvent =
  | { type: "hostConnected" }
  | { type: "hostReconnected" }
  | { type: "hostGraceStarted"; deleteAt: number }
  | { type: "roomClosed"; reason: "stopped" | "host-timeout" };

type CreateRoomInput = {
  poll: PollConfig;
  hostToken: string;
  now?: () => number;
  maxVoters?: number;
};

export type PollRoomCoreState = {
  active: boolean;
  poll: PollConfig;
  hostToken: string;
  hostConnected: boolean;
  hostGraceDeleteAt: number | null;
  maxVoters: number;
  votes: [string, string | null][];
  counts?: [string, number][];
};

type RestoreRoomInput = {
  state: PollRoomCoreState;
  now?: () => number;
};

export const DEFAULT_MAX_VOTERS = 1_000;

export class PollRoomCore {
  private active = true;
  private hostConnected = false;
  private hostGraceDeleteAt: number | null = null;
  private readonly hostToken: string;
  private readonly maxVoters: number;
  private readonly now: () => number;
  private readonly poll: PollConfig;
  private readonly counts = new Map<string, number>();
  private readonly votes = new Map<string, string | null>();

  private constructor(input: CreateRoomInput) {
    this.poll = input.poll;
    this.hostToken = input.hostToken;
    this.now = input.now ?? Date.now;
    this.maxVoters = input.maxVoters ?? DEFAULT_MAX_VOTERS;
    this.resetCounts();
  }

  static create(input: CreateRoomInput): PollRoomCore {
    return new PollRoomCore(input);
  }

  static fromState(state: PollRoomCoreState, now?: () => number): PollRoomCore {
    const room = new PollRoomCore({
      poll: state.poll,
      hostToken: state.hostToken,
      maxVoters: state.maxVoters,
      now,
    });
    room.active = state.active;
    room.hostConnected = state.hostConnected;
    room.hostGraceDeleteAt = state.hostGraceDeleteAt;
    for (const [sessionId, optionId] of state.votes) {
      room.votes.set(sessionId, optionId);
    }
    if (state.counts) {
      room.resetCounts();
      for (const [optionId, count] of state.counts) {
        if (room.counts.has(optionId)) {
          room.counts.set(optionId, count);
        }
      }
    } else {
      room.rebuildCounts();
    }
    return room;
  }

  static restore(input: RestoreRoomInput): PollRoomCore {
    return PollRoomCore.fromState(input.state, input.now);
  }

  toState(): PollRoomCoreState {
    return {
      active: this.active,
      poll: this.poll,
      hostToken: this.hostToken,
      hostConnected: this.hostConnected,
      hostGraceDeleteAt: this.hostGraceDeleteAt,
      maxVoters: this.maxVoters,
      votes: [...this.votes.entries()],
      counts: this.poll.options.map((option) => [option.id, this.counts.get(option.id) ?? 0]),
    };
  }

  snapshot(): PollRoomSnapshot {
    return {
      active: this.active,
      poll: this.poll,
      results: this.poll.options.map((option) => ({
        optionId: option.id,
        count: this.counts.get(option.id) ?? 0,
      })),
      voterCount: this.votes.size,
      hostConnected: this.hostConnected,
      hostGraceDeleteAt: this.hostGraceDeleteAt,
    };
  }

  joinHost(hostToken: string): HostEvent {
    this.assertActive();
    this.assertHost(hostToken);

    const wasInGrace = this.hostGraceDeleteAt !== null;
    this.hostConnected = true;
    this.hostGraceDeleteAt = null;

    return { type: wasInGrace ? "hostReconnected" : "hostConnected" };
  }

  leaveHost(): HostEvent {
    this.assertActive();
    this.hostConnected = false;
    this.hostGraceDeleteAt = this.now() + 30_000;
    return { type: "hostGraceStarted", deleteAt: this.hostGraceDeleteAt };
  }

  expireHostGrace(): HostEvent | null {
    if (!this.active || this.hostGraceDeleteAt === null) {
      return null;
    }

    if (this.now() < this.hostGraceDeleteAt) {
      return null;
    }

    return this.close("host-timeout");
  }

  stopPoll(hostToken: string): HostEvent {
    this.assertActive();
    this.assertHost(hostToken);
    return this.close("stopped");
  }

  joinVoter(sessionId: string): void {
    this.assertActive();
    if (!this.votes.has(sessionId) && this.votes.size >= this.maxVoters) {
      throw new Error("Room is full");
    }

    if (!this.votes.has(sessionId)) {
      this.votes.set(sessionId, null);
    }
  }

  leaveVoter(sessionId: string): boolean {
    const previous = this.votes.get(sessionId);
    if (!this.votes.has(sessionId)) {
      return false;
    }

    if (previous) {
      this.decrement(previous);
    }
    this.votes.delete(sessionId);
    return true;
  }

  vote(sessionId: string, optionId: string): boolean {
    this.assertActive();
    this.assertJoined(sessionId);
    if (!this.poll.options.some((option) => option.id === optionId)) {
      throw new Error("Invalid option");
    }

    const previous = this.votes.get(sessionId);
    if (previous === optionId) {
      return false;
    }

    if (previous) {
      this.decrement(previous);
    }
    this.votes.set(sessionId, optionId);
    this.increment(optionId);
    return true;
  }

  clearVote(sessionId: string): boolean {
    this.assertActive();
    this.assertJoined(sessionId);
    const previous = this.votes.get(sessionId);
    if (previous === null) {
      return false;
    }

    if (previous) {
      this.decrement(previous);
    }
    this.votes.set(sessionId, null);
    return true;
  }

  private close(reason: "stopped" | "host-timeout"): HostEvent {
    this.active = false;
    this.hostConnected = false;
    this.hostGraceDeleteAt = null;
    this.votes.clear();
    this.resetCounts();
    return { type: "roomClosed", reason };
  }

  private resetCounts(): void {
    this.counts.clear();
    for (const option of this.poll.options) {
      this.counts.set(option.id, 0);
    }
  }

  private rebuildCounts(): void {
    this.resetCounts();
    for (const vote of this.votes.values()) {
      if (vote) {
        this.increment(vote);
      }
    }
  }

  private increment(optionId: string): void {
    this.counts.set(optionId, (this.counts.get(optionId) ?? 0) + 1);
  }

  private decrement(optionId: string): void {
    this.counts.set(optionId, Math.max(0, (this.counts.get(optionId) ?? 0) - 1));
  }

  private assertActive(): void {
    if (!this.active) {
      throw new Error("Room is closed");
    }
  }

  private assertHost(hostToken: string): void {
    if (hostToken !== this.hostToken) {
      throw new Error("Invalid host token");
    }
  }

  private assertJoined(sessionId: string): void {
    if (!this.votes.has(sessionId)) {
      throw new Error("Voter is not in room");
    }
  }
}
