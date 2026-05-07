"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Home, Radio, RotateCcw } from "lucide-react";
import { fetchJson, realtimeHttpUrl, realtimeSocketUrl } from "@/lib/poll-api";
import { appCopy } from "@/lib/copy";
import { canClearVote, canPickChoice, getVoterWinningOptionIds, shouldShowResults } from "@/lib/vote-ui";
import type { PollState, ServerMessage } from "@/lib/types";

type VoteClientProps = {
  roomCode: string;
};

const optionColors = ["#22d3ee", "#ffcc30", "#ff7ab6", "#7cf36e", "#c084fc", "#fb923c", "#67e8f9", "#f87171"];
const copy = appCopy.voter;

export function VoteClient({ roomCode }: VoteClientProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const pollKeyRef = useRef("");
  const pollActiveRef = useRef<boolean | null>(null);
  const [state, setState] = useState<PollState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const key = `quickpoll:${roomCode}:session`;
    const existing = window.sessionStorage.getItem(key);
    if (existing) {
      return existing;
    }

    const created = crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  });
  const [status, setStatus] = useState<"loading" | "live" | "closed">("loading");
  const [error, setError] = useState("");

  const applyPollState = useCallback((nextState: PollState) => {
    const nextPollKey = pollKeyFor(nextState);
    const becameLiveAgain = pollActiveRef.current === false && nextState.active;
    if (nextPollKey !== pollKeyRef.current || becameLiveAgain) {
      pollKeyRef.current = nextPollKey;
      setSelected(null);
    }
    pollActiveRef.current = nextState.active;

    setState(nextState);
    setStatus(nextState.active ? "live" : "closed");
    setError(nextState.active ? "" : copy.pollEnded);
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) {
      return;
    }

    const url = new URL(realtimeSocketUrl(`/polls/${roomCode}/socket`));
    url.searchParams.set("role", "voter");
    url.searchParams.set("sessionId", sessionId);
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus((current) => (current === "closed" ? "closed" : "live"));
      setError("");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "state" || message.type === "results") {
        applyPollState(message.state);
        return;
      }

      if (message.type === "roomClosed") {
        setStatus("closed");
        setError(copy.pollEnded);
        socket.close();
        return;
      }

      if (message.type === "error") {
        setError(message.message);
      }
    };

    socket.onclose = () => {
      setStatus((current) => (current === "closed" ? "closed" : "closed"));
    };

    socket.onerror = () => {
      setError(copy.roomUnavailable);
      setStatus("closed");
    };
  }, [applyPollState, roomCode, sessionId]);

  useEffect(() => {
    fetchJson<PollState>(realtimeHttpUrl(`/polls/${roomCode}`))
      .then((pollState) => {
        applyPollState(pollState);
        if (pollState.active) {
          setStatus("loading");
        }
        connect();
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : copy.roomUnavailable);
        setStatus("closed");
      });
  }, [applyPollState, connect, roomCode]);

  useEffect(() => {
    function leave() {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "leave" }));
      }
      socket?.close();
    }

    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  function vote(optionId: string) {
    if (!canPickChoice(status)) {
      return;
    }

    setSelected(optionId);
    socketRef.current?.send(JSON.stringify({ type: "vote", optionId }));
  }

  function clearVote() {
    if (!canClearVote({ selectedOptionId: selected, status })) {
      return;
    }

    setSelected(null);
    socketRef.current?.send(JSON.stringify({ type: "clearVote" }));
  }

  const totalVotes = state?.results.reduce((total, result) => total + result.count, 0) ?? 0;
  const showResults = shouldShowResults({
    active: state?.active ?? true,
    resultCount: state?.results.length ?? 0,
  });
  const winningOptionIds = new Set(
    getVoterWinningOptionIds({
      active: state?.active ?? true,
      results: state?.results ?? [],
    }),
  );

  return (
    <main className="stage-shell">
      <section className="stage-grid grid min-h-[calc(100vh-48px)] content-center">
        <div className="glass-panel rounded-lg p-5 sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#ffcc30] text-[#111114]">
                <Radio size={23} strokeWidth={2.8} />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-sm font-black text-[#b7f7ff]">{roomCode}</p>
                <h1 className="poll-text-wrap text-2xl font-black sm:text-4xl">
                  {state?.poll.title ?? copy.fallbackTitle}
                </h1>
              </div>
            </div>
            <span className="rounded-md bg-white/10 px-3 py-2 text-sm font-black">{statusLabel(status)}</span>
          </div>

          <h2 className="poll-text-wrap text-2xl font-black text-white/88 sm:text-5xl">
            {state?.poll.question ?? copy.loadingQuestion}
          </h2>

          {showResults ? (
            <div className="mt-7 grid gap-4">
              <p className="text-lg font-black text-[#ffcc30]">{copy.resultsTitle}</p>
              {state?.poll.options.map((option, index) => {
                const count = state.results.find((result) => result.optionId === option.id)?.count ?? 0;
                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const isWinner = winningOptionIds.has(option.id);
                return (
                  <div
                    className={`result-row rounded-md border p-3 ${
                      isWinner
                        ? "border-[#ffcc30]/70 bg-[#ffcc30]/10 shadow-[0_0_0_1px_rgba(255,204,48,0.18)]"
                        : "border-transparent"
                    }`}
                    key={option.id}
                  >
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <div className="poll-text-wrap text-xl font-black sm:text-3xl">{option.text}</div>
                        {isWinner ? (
                          <div className="mt-1 text-sm font-black text-[#ffcc30]">{copy.winnerLabel}</div>
                        ) : null}
                      </div>
                      <div className="font-mono text-2xl font-black text-[#ffcc30]">{count}</div>
                    </div>
                    <div className="h-7 overflow-hidden rounded-md bg-white/10">
                      <div
                        className="result-bar h-full rounded-md"
                        style={{
                          width: `${Math.max(percent, count > 0 ? 5 : 0)}%`,
                          background: optionColors[index % optionColors.length],
                        }}
                      />
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-white/58">{percent}%</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-7 grid gap-3">
              {state?.poll.options.map((option, index) => {
                const active = selected === option.id;
                return (
                  <button
                    className="focus-ring flex min-h-16 items-center justify-between gap-4 rounded-md border border-white/12 bg-white/8 px-4 py-3 text-left text-xl font-black text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canPickChoice(status)}
                    key={option.id}
                    type="button"
                    onClick={() => vote(option.id)}
                  >
                    <span className="poll-text-wrap flex-1">{option.text}</span>
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-md text-[#101114]"
                      style={{ background: active ? optionColors[index % optionColors.length] : "rgba(255,255,255,0.14)" }}
                    >
                      {active ? <Check size={22} strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {showResults ? (
              <Link className="event-button rounded-md bg-white/12 text-white no-underline" href="/">
                <Home size={18} />
                {copy.backHome}
              </Link>
            ) : (
              <button
                className="event-button rounded-md bg-white/12 text-white disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={clearVote}
                disabled={!canClearVote({ selectedOptionId: selected, status })}
              >
                <RotateCcw size={18} />
                {copy.clearVote}
              </button>
            )}
            <p className="text-sm font-bold text-white/62">{error || (selected ? copy.voteRecorded : copy.noVoteSelected)}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function statusLabel(status: "loading" | "live" | "closed"): string {
  if (status === "live") {
    return copy.status.live;
  }
  if (status === "closed") {
    return copy.status.closed;
  }
  return copy.status.loading;
}

function pollKeyFor(state: PollState): string {
  return `${state.poll.title}|${state.poll.question}|${state.poll.options
    .map((option) => `${option.id}:${option.text}`)
    .join("|")}`;
}
