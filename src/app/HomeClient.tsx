"use client";

import { FormEvent, MouseEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, DoorOpen, Plus, Radio, Send, X } from "lucide-react";
import type { CreatePollResponse } from "@/lib/types";
import { fetchJson, realtimeHttpUrl } from "@/lib/poll-api";
import { appCopy } from "@/lib/copy";
import { homeModePath, type HomeMode } from "@/lib/home-mode";
import { buildPollPayload, canSubmitPollForm, removePollOptionAt } from "@/lib/poll-form";

type HomeClientProps = {
  initialMode: HomeMode;
};

const copy = appCopy.home;
const emptyOptions = ["", ""];

export function HomeClient({ initialMode }: HomeClientProps) {
  const [mode, setMode] = useState<HomeMode>(initialMode);
  const [title, setTitle] = useState<string>("");
  const [question, setQuestion] = useState<string>("");
  const [options, setOptions] = useState<string[]>(emptyOptions);
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canCreate = useMemo(() => canSubmitPollForm({ title, question, options }), [options, question, title]);

  async function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await fetchJson<CreatePollResponse>(realtimeHttpUrl("/polls"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPollPayload({ title, question, options })),
      });
      window.location.assign(result.hostUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.createError);
    } finally {
      setBusy(false);
    }
  }

  function joinPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (/^\d{6}$/.test(roomCode)) {
      window.location.assign(`/poll/${roomCode}`);
      return;
    }
    setError(copy.roomCodeError);
  }

  function chooseMode(nextMode: HomeMode, event?: MouseEvent<HTMLAnchorElement>) {
    event?.preventDefault();
    setError("");
    setMode(nextMode);
    window.history.pushState(null, "", homeModePath(nextMode));
  }

  return (
    <main className="stage-shell">
      <div className="stage-grid grid min-h-[calc(100vh-48px)] content-center">
        <section className="glass-panel mx-auto w-full max-w-2xl rounded-lg p-5 sm:p-7">
          <div className="mb-7 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-lg bg-[#ffcc30] text-[#111114]">
              <Radio size={26} strokeWidth={2.8} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-normal sm:text-5xl">{appCopy.productName}</h1>
              <p className="mt-1 text-sm font-semibold text-[#b7f7ff]">{copy.subtitle}</p>
            </div>
          </div>

          {mode === "start" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                className="focus-ring flex min-h-32 flex-col items-start justify-between rounded-md border border-[#22d3ee]/35 bg-[#22d3ee]/16 p-5 text-left text-white no-underline transition hover:bg-[#22d3ee]/22"
                href="/create"
                onClick={(event) => chooseMode("create", event)}
              >
                <Plus size={26} />
                <span className="text-3xl font-black">{copy.chooseCreate}</span>
              </Link>
              <Link
                className="focus-ring flex min-h-32 flex-col items-start justify-between rounded-md border border-[#ffcc30]/40 bg-[#ffcc30]/16 p-5 text-left text-white no-underline transition hover:bg-[#ffcc30]/24"
                href="/join"
                onClick={(event) => chooseMode("join", event)}
              >
                <DoorOpen size={26} />
                <span className="text-3xl font-black">{copy.chooseJoin}</span>
              </Link>
            </div>
          ) : null}

          {mode === "create" ? (
            <div>
              <Link
                className="event-button mb-5 rounded-md bg-white/12 text-white no-underline"
                href="/"
                onClick={(event) => chooseMode("start", event)}
              >
                <ArrowLeft size={18} />
                {copy.backHome}
              </Link>
              <h2 className="mb-5 text-2xl font-black">{copy.createTitle}</h2>
              <form className="grid gap-4" onSubmit={createPoll}>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#ffcc30]">{copy.titleLabel}</span>
                  <input
                    className="focus-ring rounded-md border border-white/15 bg-white/8 px-4 py-3 text-lg font-bold text-white"
                    maxLength={80}
                    placeholder={copy.titlePlaceholder}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#ff7ab6]">{copy.questionLabel}</span>
                  <input
                    className="focus-ring rounded-md border border-white/15 bg-white/8 px-4 py-3 text-lg font-bold text-white"
                    maxLength={140}
                    placeholder={copy.questionPlaceholder}
                    required
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                </label>
                <div className="grid gap-2">
                  <span className="text-sm font-bold text-[#7cf36e]">{copy.choicesLabel}</span>
                  <div className="grid gap-2">
                    {options.map((option, index) => (
                      <div className="flex gap-2" key={index}>
                        <input
                          className="focus-ring min-w-0 flex-1 rounded-md border border-white/15 bg-white/8 px-4 py-3 text-white"
                          maxLength={80}
                          placeholder={copy.choicePlaceholder(index + 1)}
                          required
                          value={option}
                          onChange={(event) => {
                            const next = [...options];
                            next[index] = event.target.value;
                            setOptions(next);
                          }}
                        />
                        {options.length > 2 ? (
                          <button
                            aria-label={`${copy.removeChoice} ${index + 1}`}
                            className="focus-ring grid size-12 shrink-0 place-items-center rounded-md border border-white/15 bg-white/10 text-white transition hover:bg-[#ff4d6d]/35"
                            type="button"
                            onClick={() => setOptions(removePollOptionAt(options, index))}
                          >
                            <X size={19} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="event-button rounded-md bg-white/12 text-white"
                      type="button"
                      disabled={options.length >= 8}
                      onClick={() => setOptions([...options, ""])}
                    >
                      <Plus size={18} />
                      {copy.addChoice}
                    </button>
                  </div>
                </div>

                <button
                  className="event-button mt-2 rounded-md bg-[#22d3ee] text-[#071013] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canCreate || busy}
                  type="submit"
                >
                  <Send size={20} />
                  {busy ? copy.creating : copy.createButton}
                </button>
              </form>
            </div>
          ) : null}

          {mode === "join" ? (
            <div>
              <Link
                className="event-button mb-5 rounded-md bg-white/12 text-white no-underline"
                href="/"
                onClick={(event) => chooseMode("start", event)}
              >
                <ArrowLeft size={18} />
                {copy.backHome}
              </Link>
              <h2 className="text-2xl font-black">{copy.joinTitle}</h2>
              <form className="mt-5 grid gap-3" onSubmit={joinPoll}>
                <input
                  className="focus-ring rounded-md border border-white/15 bg-white/8 px-4 py-4 text-center font-mono text-4xl font-black tracking-[0.18em] text-white"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={copy.roomPlaceholder}
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <button className="event-button rounded-md bg-[#ffcc30] text-[#111114]" type="submit">
                  <DoorOpen size={20} />
                  {copy.joinButton}
                </button>
              </form>
            </div>
          ) : null}

          {error ? (
            <p className="mt-5 rounded-md border border-[#ff7ab6]/40 bg-[#ff7ab6]/12 p-3 text-sm font-bold text-[#ffd2e5]">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
