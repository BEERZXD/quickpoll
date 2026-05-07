"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { OctagonX, QrCode, Radio, Square, Users } from "lucide-react";
import { realtimeSocketUrl } from "@/lib/poll-api";
import { appCopy } from "@/lib/copy";
import type { PollState, ServerMessage } from "@/lib/types";

type HostDashboardProps = {
  roomCode: string;
  hostToken: string;
};

const colors = ["#22d3ee", "#ffcc30", "#ff7ab6", "#7cf36e", "#c084fc", "#fb923c", "#67e8f9", "#f87171"];
const copy = appCopy.host;

export function HostDashboard({ roomCode, hostToken }: HostDashboardProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const reconnectTimerRef = useRef<number | null>(null);
  const manualStopRef = useRef(false);
  const [state, setState] = useState<PollState | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting" | "closed">("connecting");
  const [error, setError] = useState(hostToken ? "" : copy.missingToken);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const voterUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return `${window.location.origin}/poll/${roomCode}`;
  }, [roomCode]);

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
        setState(message.state);
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
      socketRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    if (!voterUrl) {
      return;
    }

    QRCode.toDataURL(voterUrl, {
      margin: 1,
      width: 320,
      color: {
        dark: "#101114",
        light: "#fff8e8",
      },
    }).then(setQrDataUrl, () => setQrDataUrl(""));
  }, [voterUrl]);

  const totalVotes = state?.results.reduce((total, result) => total + result.count, 0) ?? 0;

  function stopPoll() {
    manualStopRef.current = true;
    socketRef.current?.send(JSON.stringify({ type: "stopPoll" }));
  }

  return (
    <main className="stage-shell">
      <div className="stage-grid grid min-h-[calc(100vh-48px)] gap-5 xl:grid-cols-[1fr_320px]">
        <section className="glass-panel flex min-h-[560px] flex-col rounded-lg p-5 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-[#22d3ee]/15 px-3 py-2 text-sm font-black text-[#b7f7ff]">
                <Radio size={18} />
                {statusLabel(status)}
              </div>
              <h1 className="max-w-[760px] text-3xl font-black tracking-normal sm:text-6xl">
                {state?.poll.title ?? copy.connectingTitle}
              </h1>
              <p className="mt-3 max-w-[760px] text-xl font-bold text-white/78 sm:text-3xl">
                {state?.poll.question ?? copy.warmingUp}
              </p>
            </div>
            <button className="event-button rounded-md bg-[#ff4d6d] text-white" type="button" onClick={stopPoll}>
              <OctagonX size={22} />
              {copy.stopPoll}
            </button>
          </header>

          <div className="mt-8 grid flex-1 content-end gap-4">
            {state?.poll.options.map((option, index) => {
              const count = state.results.find((result) => result.optionId === option.id)?.count ?? 0;
              const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              return (
                <div className="result-row" key={option.id}>
                  <div className="mb-2 flex items-end justify-between gap-3">
                    <div className="min-w-0 text-xl font-black sm:text-3xl">{option.text}</div>
                    <div className="font-mono text-2xl font-black text-[#ffcc30] sm:text-5xl">{count}</div>
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
        </section>

        <aside className="grid gap-5">
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
