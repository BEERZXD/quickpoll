import { describe, expect, it, vi } from "vitest";
import { PollRoomCore } from "../worker/room-core";

const poll = {
  title: "Launch check",
  question: "Ship it?",
  options: [
    { id: "yes", text: "Yes" },
    { id: "no", text: "No" },
  ],
};

describe("PollRoomCore", () => {
  it("creates an active room with empty results", () => {
    const room = PollRoomCore.create({ poll, hostToken: "host-secret" });

    expect(room.snapshot()).toMatchObject({
      active: true,
      poll,
      results: [
        { optionId: "yes", count: 0 },
        { optionId: "no", count: 0 },
      ],
      voterCount: 0,
    });
  });

  it("counts one vote per active voter session and removes it on leave", () => {
    const room = PollRoomCore.create({ poll, hostToken: "host-secret" });

    room.joinVoter("tab-1");
    room.vote("tab-1", "yes");
    room.joinVoter("tab-2");
    room.vote("tab-2", "no");
    room.vote("tab-2", "yes");

    expect(room.snapshot().results).toEqual([
      { optionId: "yes", count: 2 },
      { optionId: "no", count: 0 },
    ]);

    room.leaveVoter("tab-1");

    expect(room.snapshot()).toMatchObject({
      voterCount: 1,
      results: [
        { optionId: "yes", count: 1 },
        { optionId: "no", count: 0 },
      ],
    });
  });

  it("stores aggregate counts with room state and restores them", () => {
    const room = PollRoomCore.create({ poll, hostToken: "host-secret" });

    room.joinVoter("tab-1");
    room.vote("tab-1", "yes");
    room.joinVoter("tab-2");
    room.vote("tab-2", "no");
    room.vote("tab-2", "yes");

    expect(room.toState().counts).toEqual([
      ["yes", 2],
      ["no", 0],
    ]);

    const restored = PollRoomCore.fromState(room.toState());

    expect(restored.snapshot().results).toEqual([
      { optionId: "yes", count: 2 },
      { optionId: "no", count: 0 },
    ]);
  });

  it("restores aggregate counts for older stored state without count data", () => {
    const room = PollRoomCore.fromState({
      active: true,
      poll,
      hostToken: "host-secret",
      hostConnected: false,
      hostGraceDeleteAt: null,
      maxVoters: 10,
      votes: [
        ["tab-1", "yes"],
        ["tab-2", "yes"],
        ["tab-3", null],
      ],
    });

    expect(room.toState().counts).toEqual([
      ["yes", 2],
      ["no", 0],
    ]);
  });

  it("lets a voter clear their vote without leaving the room", () => {
    const room = PollRoomCore.create({ poll, hostToken: "host-secret" });

    room.joinVoter("tab-1");
    room.vote("tab-1", "yes");
    room.clearVote("tab-1");

    expect(room.snapshot()).toMatchObject({
      voterCount: 1,
      results: [
        { optionId: "yes", count: 0 },
        { optionId: "no", count: 0 },
      ],
    });
  });

  it("reports whether a vote actually changed", () => {
    const room = PollRoomCore.create({ poll, hostToken: "host-secret" });

    room.joinVoter("tab-1");

    expect(room.vote("tab-1", "yes")).toBe(true);
    expect(room.vote("tab-1", "yes")).toBe(false);
    expect(room.vote("tab-1", "no")).toBe(true);
  });

  it("reports whether clearing a vote actually changed", () => {
    const room = PollRoomCore.create({ poll, hostToken: "host-secret" });

    room.joinVoter("tab-1");

    expect(room.clearVote("tab-1")).toBe(false);
    room.vote("tab-1", "yes");
    expect(room.clearVote("tab-1")).toBe(true);
    expect(room.clearVote("tab-1")).toBe(false);
  });

  it("rejects new voter sessions after the configured room limit", () => {
    const room = PollRoomCore.create({ poll, hostToken: "host-secret", maxVoters: 2 });

    room.joinVoter("tab-1");
    room.joinVoter("tab-2");

    expect(() => room.joinVoter("tab-3")).toThrow("Room is full");
    expect(() => room.joinVoter("tab-2")).not.toThrow();
    expect(room.snapshot().voterCount).toBe(2);
  });

  it("allows 1000 active voter sessions by default", () => {
    const room = PollRoomCore.create({ poll, hostToken: "host-secret" });

    for (let index = 0; index < 1_000; index += 1) {
      room.joinVoter(`tab-${index}`);
    }

    expect(room.snapshot().voterCount).toBe(1_000);
    expect(() => room.joinVoter("tab-1000")).toThrow("Room is full");
  });

  it("deletes the room immediately when the host stops the poll", () => {
    const room = PollRoomCore.create({ poll, hostToken: "host-secret" });

    room.joinHost("host-secret");
    room.joinVoter("tab-1");
    room.vote("tab-1", "yes");
    const event = room.stopPoll("host-secret");

    expect(event).toEqual({ type: "roomClosed", reason: "stopped" });
    expect(room.snapshot()).toMatchObject({ active: false, voterCount: 0 });
    expect(() => room.joinVoter("late-tab")).toThrow("Room is closed");
  });

  it("starts a 30 second grace timer when the host disconnects and cancels it on reconnect", () => {
    const now = vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(12_000)
      .mockReturnValueOnce(12_000);
    const room = PollRoomCore.create({ poll, hostToken: "host-secret", now });

    room.joinHost("host-secret");
    const disconnectEvent = room.leaveHost();
    const reconnectEvent = room.joinHost("host-secret");

    expect(disconnectEvent).toEqual({
      type: "hostGraceStarted",
      deleteAt: 31_000,
    });
    expect(reconnectEvent).toEqual({ type: "hostReconnected" });
    expect(room.snapshot()).toMatchObject({ active: true, hostConnected: true });
  });

  it("deletes the room when host grace expires", () => {
    const now = vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(31_001);
    const room = PollRoomCore.create({ poll, hostToken: "host-secret", now });

    room.joinHost("host-secret");
    room.leaveHost();
    const event = room.expireHostGrace();

    expect(event).toEqual({ type: "roomClosed", reason: "host-timeout" });
    expect(room.snapshot()).toMatchObject({ active: false, voterCount: 0 });
  });

  it("restores active votes from stored room state", () => {
    const room = PollRoomCore.create({ poll, hostToken: "host-secret" });

    room.joinHost("host-secret");
    room.joinVoter("tab-1");
    room.vote("tab-1", "yes");

    const restored = PollRoomCore.fromState(room.toState());

    expect(restored.snapshot()).toMatchObject({
      active: true,
      hostConnected: true,
      voterCount: 1,
      results: [
        { optionId: "yes", count: 1 },
        { optionId: "no", count: 0 },
      ],
    });
  });
});
