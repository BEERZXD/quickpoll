"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, Home, OctagonX, Plus, QrCode, Radio, Send, Square, Users, X } from "lucide-react";
import { realtimeSocketUrl } from "@/lib/poll-api";
import { appCopy } from "@/lib/copy";
import {
  getWinningOptionIds,
  hostHeaderLayoutClasses,
  shouldShowHostNewQuestionForm,
  shouldShowHostResults,
  type HostStoppedView,
} from "@/lib/host-stop-ui";
import { buildFollowUpPollPayload, canSubmitPollForm, removePollOptionAt } from "@/lib/poll-form";
import type { PollState, ServerMessage } from "@/lib/types";

type HostDashboardProps = {
  roomCode: string;
  hostToken: string;
};

const colors = ["#22d3ee", "#ffcc30", "#ff7ab6", "#7cf36e", "#c084fc", "#fb923c", "#67e8f9", "#f87171"];
const copy = appCopy.host;
const formCopy = appCopy.home;
const emptyOptions = ["", ""];

export function HostDashboard({ roomCode, hostToken }: HostDashboardProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const reconnectTimerRef = useRef<number | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const manualStopRef = useRef(false);
  const wasActiveRef = useRef<boolean | null>(null);
  const [state, setState] = useState<PollState | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting" | "closed">("connecting");
  const [error, setError] = useState(hostToken ? "" : copy.missingToken);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [stoppedView, setStoppedView] = useState<HostStoppedView | null>(null);
  const [nextQuestion, setNextQuestion] = useState("");
  const [nextOptions, setNextOptions] = useState<string[]>(emptyOptions);
  const [startingPoll, setStartingPoll] = useState(false);
  const [joinLinkCopyStatus, setJoinLinkCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const connect = useCallback(() => {
    if (!hostToken || manualStopRef.current) {
      return;
    }

    socketRef.current?.close();
    const url = new URL(realtimeSocketUrl(`/polls/${roomCode}/socket`));
    url.searchParams.set("role", "host");
    url.searchParams.set("token", hostToken);

    const socket = new WebSocket(url);
    socketRef.current = socket;
    setStatus((current) => (current === "live" ? "live" : "connecting"));

    socket.onopen = () => {
      setStatus("live");
      setError("");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "state" || message.type === "results") {
        if (message.state.active || wasActiveRef.current !== false) {
          setStoppedView(null);
        }
        wasActiveRef.current = message.state.active;
        setState(message.state);
        setStatus(message.state.active ? "live" : "closed");
        setError(message.state.active ? "" : copy.pollStopped);
        if (message.state.active) {
          setStartingPoll(false);
          setNextQuestion("");
          setNextOptions(emptyOptions);
        }
        return;
      }

      if (message.type === "roomClosed") {
        manualStopRef.current = true;
        setStatus("closed");
        setError(message.reason === "stopped" ? copy.pollStopped : copy.roomClosed);
        socket.close();
        return;
      }

      if (message.type === "error") {
        setError(message.message);
      }
    };

    socket.onclose = () => {
      if (manualStopRef.current) {
        setStatus("closed");
        return;
      }

      setStatus("reconnecting");
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(() => connectRef.current(), 1000);
    };

    socket.onerror = () => {
      setError(copy.realtimeFailed);
    };
  }, [hostToken, roomCode]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      socketRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    const voterUrl = `${window.location.origin}/poll/${roomCode}`;

    QRCode.toDataURL(voterUrl, {
      margin: 1,
      width: 320,
      color: {
        dark: "#101114",
        light: "#fff8e8",
      },
    }).then(setQrDataUrl, () => setQrDataUrl(""));
  }, [roomCode]);

  const totalVotes = state?.results.reduce((total, result) => total + result.count, 0) ?? 0;
  const showHostResults = shouldShowHostResults({
    active: state?.active ?? true,
    stoppedView,
  });
  const showNewQuestionForm = shouldShowHostNewQuestionForm({
    active: state?.active ?? true,
    stoppedView,
  });
  const winningOptionIds = new Set(state && !state.active ? getWinningOptionIds(state.results) : []);
  const headerLayout = hostHeaderLayoutClasses({
    active: state?.active ?? true,
    hasState: Boolean(state),
  });
  const canStartPoll = canSubmitPollForm({
    title: "",
    question: nextQuestion,
    options: nextOptions,
  });

  function stopPoll() {
    if (!state?.active) {
      return;
    }

    socketRef.current?.send(JSON.stringify({ type: "stopPoll" }));
  }

  async function copyJoinLink() {
    try {
      const voterUrl = `${window.location.origin}/poll/${roomCode}`;
      await navigator.clipboard.writeText(voterUrl);
      setJoinLinkCopyStatus("copied");
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => setJoinLinkCopyStatus("idle"), 1800);
    } catch {
      setJoinLinkCopyStatus("failed");
    }
  }

  function startAnotherPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStartPoll || startingPoll) {
      return;
    }

    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      setError(copy.realtimeFailed);
      return;
    }

    setStartingPoll(true);
    setError("");
    socket.send(
      JSON.stringify({
        type: "startPoll",
        poll: buildFollowUpPollPayload({
          currentTitle: state?.poll.title ?? "",
          question: nextQuestion,
          options: nextOptions,
        }),
      }),
    );
  }

  return (
    <main className="stage-shell">
      <div className="stage-grid grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="glass-panel flex min-h-[560px] flex-col rounded-lg p-5 sm:p-8">
          <header className={headerLayout.header}>
            <div className={headerLayout.titleArea}>
              <div className="mb-3 inline-flex whitespace-nowrap items-center gap-2 rounded-md bg-[#22d3ee]/15 px-3 py-2 text-sm font-black text-[#b7f7ff]">
                <Radio size={18} />
                {statusLabel(status)}
              </div>
              <h1 className="poll-text-wrap w-full text-3xl font-black tracking-normal sm:text-6xl">
                {state?.poll.title ?? copy.connectingTitle}
              </h1>
              <p className="poll-text-wrap mt-3 w-full text-xl font-bold text-white/78 sm:text-3xl">
                {state?.poll.question ?? copy.warmingUp}
              </p>
            </div>
            {state?.active ? (
              <div className={headerLayout.actions}>
                <button className="event-button rounded-md bg-[#ff4d6d] text-white" type="button" onClick={stopPoll}>
                  <OctagonX size={22} />
                  {copy.stopPoll}
                </button>
              </div>
            ) : state ? (
              <div className={headerLayout.actions}>
                <Link className="event-button rounded-md bg-white/12 text-white no-underline" href="/">
                  <Home size={18} />
                  {copy.backHome}
                </Link>
                <button
                  className="event-button rounded-md bg-[#22d3ee] text-[#071013]"
                  type="button"
                  onClick={() => setStoppedView("newQuestion")}
                >
                  <Plus size={18} />
                  {copy.askAgain}
                </button>
              </div>
            ) : null}
          </header>

          {showNewQuestionForm ? (
            <form className="mt-6 grid max-w-2xl gap-3" onSubmit={startAnotherPoll}>
              <h2 className="text-xl font-black">{copy.askAgain}</h2>
              <input
                className="focus-ring rounded-md border border-white/15 bg-white/8 px-3 py-2 font-bold text-white"
                maxLength={140}
                placeholder={formCopy.questionPlaceholder}
                required
                value={nextQuestion}
                onChange={(event) => setNextQuestion(event.target.value)}
              />
              <div className="grid gap-2">
                {nextOptions.map((option, index) => (
                  <div className="flex min-w-0 gap-2" key={index}>
                    <input
                      className="focus-ring min-w-0 flex-1 rounded-md border border-white/15 bg-white/8 px-3 py-2 text-white"
                      maxLength={80}
                      placeholder={formCopy.choicePlaceholder(index + 1)}
                      required
                      value={option}
                      onChange={(event) => {
                        const updated = [...nextOptions];
                        updated[index] = event.target.value;
                        setNextOptions(updated);
                      }}
                    />
                    {nextOptions.length > 2 ? (
                      <button
                        aria-label={`${formCopy.removeChoice} ${index + 1}`}
                        className="focus-ring grid size-11 shrink-0 place-items-center rounded-md border border-white/15 bg-white/10 text-white transition hover:bg-[#ff4d6d]/35"
                        type="button"
                        onClick={() => setNextOptions(removePollOptionAt(nextOptions, index))}
                      >
                        <X size={18} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="event-button rounded-md bg-white/12 text-white"
                  type="button"
                  disabled={nextOptions.length >= 8}
                  onClick={() => setNextOptions([...nextOptions, ""])}
                >
                  <Plus size={18} />
                  {formCopy.addChoice}
                </button>
              </div>
              <button
                className="event-button rounded-md bg-[#22d3ee] text-[#071013] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canStartPoll || startingPoll}
                type="submit"
              >
                <Send size={18} />
                {startingPoll ? copy.startingPoll : copy.startPoll}
              </button>
            </form>
          ) : showHostResults ? (
            <div className="mt-6 grid flex-1 content-start gap-4">
              {state?.poll.options.map((option, index) => {
                const count = state.results.find((result) => result.optionId === option.id)?.count ?? 0;
                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const isWinner = winningOptionIds.has(option.id);
                return (
                  <div
                    className={`result-row overflow-hidden rounded-md border p-3 ${
                      isWinner
                        ? "border-[#ffcc30]/70 bg-[#ffcc30]/10 shadow-[0_0_0_1px_rgba(255,204,48,0.18)]"
                        : "border-transparent"
                    }`}
                    key={option.id}
                  >
                    <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                      <div className="min-w-0">
                        <div className="poll-text-wrap text-xl font-black sm:text-3xl">{option.text}</div>
                        {isWinner ? (
                          <div className="mt-1 text-sm font-black text-[#ffcc30]">{copy.winnerLabel}</div>
                        ) : null}
                      </div>
                      <div className="shrink-0 font-mono text-2xl font-black text-[#ffcc30] sm:text-5xl">{count}</div>
                    </div>
                    <div className="h-7 overflow-hidden rounded-md bg-white/10 sm:h-10">
                      <div
                        className="result-bar h-full rounded-md"
                        style={{
                          width: `${Math.max(percent, count > 0 ? 5 : 0)}%`,
                          background: colors[index % colors.length],
                        }}
                      />
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-white/58">{percent}%</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center py-12 text-center">
              <p className="text-3xl font-black text-[#ffcc30]">{copy.pollStopped}</p>
            </div>
          )}
        </section>

        <aside className="grid auto-rows-max content-start gap-5">
          <section className="glass-panel rounded-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[#7cf36e]">{copy.roomLabel}</p>
                <p className="font-mono text-5xl font-black tracking-[0.08em]">{roomCode}</p>
              </div>
              <QrCode className="text-[#ffcc30]" size={34} />
            </div>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="mt-5 w-full rounded-md bg-[#fff8e8] p-3"
                src={qrDataUrl}
                alt={`${copy.qrAltPrefix} ${roomCode}`}
              />
            ) : (
              <div className="mt-5 aspect-square rounded-md bg-white/10" />
            )}
            <button
              className="event-button mt-3 w-full rounded-md bg-white/12 text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={copyJoinLink}
            >
              <Copy size={18} />
              {joinLinkCopyStatus === "copied" ? copy.linkCopied : copy.copyJoinLink}
            </button>
            {joinLinkCopyStatus === "failed" ? (
              <p className="mt-2 text-sm font-bold text-[#ff7ab6]">{copy.linkCopyFailed}</p>
            ) : null}
          </section>

          <section className="glass-panel rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-[#ff7ab6]">{copy.votersLabel}</p>
                <p className="font-mono text-5xl font-black">{state?.voterCount ?? 0}</p>
              </div>
              <Users className="text-[#ff7ab6]" size={38} />
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm font-bold text-white/70">
              <Square size={14} fill={status === "live" ? "#7cf36e" : "#ffcc30"} />
              {error || (state?.hostGraceDeleteAt ? copy.graceTimerActive : copy.dashboardConnected)}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function statusLabel(status: "connecting" | "live" | "reconnecting" | "closed"): string {
  if (status === "live") {
    return copy.status.live;
  }
  if (status === "reconnecting") {
    return copy.status.reconnecting;
  }
  if (status === "closed") {
    return copy.status.closed;
  }
  return copy.status.connecting;
}
