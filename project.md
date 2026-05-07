# Quick Poll

Quick Poll is a no-login realtime poll maker. The website is designed for Vercel, while realtime room state lives in a Cloudflare Durable Object because Vercel Functions do not run a WebSocket server.

## Fast V1 Rules

- The admin dashboard owns the room lifetime.
- If the admin clicks **Stop Poll**, the room closes immediately, all voters are kicked, and future joins are rejected.
- If the admin dashboard disconnects, the room starts a 30 second reconnect grace period.
- If the same admin reconnects with the host token within 30 seconds, the room continues.
- If the grace period expires, the room closes, all voters are kicked, and future joins are rejected.
- Voter votes are presence-based: one active browser tab/session has one vote, and leaving removes that vote while the room is active.
- When a room is closed, voters cannot pick or reset choices anymore.
- Polls are temporary. There is no long-term poll history or 24 hour retention in V1.

## Architecture

- `src/app` contains the Next.js App Router frontend for Vercel.
- `worker/index.ts` exposes the Cloudflare Worker HTTP and WebSocket endpoints.
- `worker/room-core.ts` contains the tested room state machine used by the Durable Object.
- `worker/result-batcher.ts` coalesces live result pushes so busy rooms do not broadcast once per vote.
- `worker/socket-policy.ts` keeps live result broadcasts host-only.
- `worker/storage-batcher.ts` coalesces Durable Object storage writes while keeping in-memory room state immediate.
- `tests/room-core.test.ts` covers room lifecycle and vote behavior.
- `src/lib/vote-ui.ts` contains voter interaction rules, including the closed-poll lockout.

## Language And Fonts

- The app UI is Thai-first with `lang="th"`.
- The modern Thai UI font is `Noto Sans Thai` via `next/font/google`.
- `Geist Mono` is used only for room codes, numbers, and technical text.
- Main UI copy lives in `src/lib/copy.ts`.
- Worker error messages that users can see are translated to Thai.

## Environment

Create `.env.local` for the web app:

```env
NEXT_PUBLIC_REALTIME_URL=http://localhost:8787
```

For production, set `NEXT_PUBLIC_REALTIME_URL` in Vercel to the deployed Cloudflare Worker URL. The local app defaults to port 3000; use `npm.cmd run dev -- --port 3001` if 3000 is already busy.

`next.config.ts` allows both `localhost` and `127.0.0.1` as development origins so local browser sessions do not block Next.js dev resources when switching between those hostnames.

Local Worker CORS allows both `localhost` and `127.0.0.1` on ports 3000 and 3001. When `NEXT_PUBLIC_REALTIME_URL` is not set, the browser fallback uses the current page hostname with port 8787, so `127.0.0.1:3001` talks to `127.0.0.1:8787` instead of mixing hostnames.

## Commands

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run worker:dev
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run perf:local -- --voters 1000 --batch 100
npx.cmd agent-browser open http://localhost:3001
npx.cmd agent-browser snapshot -i
```

## Capacity And Performance

- Current V1 room cap is 1000 active voter sessions per room. This is enforced in `PollRoomCore` and in the Worker room creation path.
- Cloudflare Durable Objects with WebSocket Hibernation document a much higher platform ceiling of 32,768 WebSocket connections per Durable Object, but practical capacity depends on CPU, memory, message frequency, and broadcast behavior.
- Each room maps to one Durable Object, so different room codes scale horizontally across different objects. One very large room is still coordinated by one single-threaded Durable Object.
- Result broadcasts are dirty-batched to once per second. Votes, clears, joins, and leaves update room state immediately, but admin dashboards receive coalesced `results` messages instead of one broadcast per vote.
- Voter sockets do not receive live `results` broadcasts after joining. They keep local choice state and still receive `state`, `roomClosed`, and `error` messages.
- Duplicate voter actions are no-ops: choosing the already selected option or clearing an already empty vote skips storage writes and skips result batching.
- Room results use incremental aggregate counts instead of recounting all voter sessions for every snapshot.
- Durable Object storage writes for vote, clear, join, and leave changes are batched for 500 ms. The Durable Object keeps the latest room state in memory immediately, then persists only the latest pending state.
- Critical room lifecycle writes are still immediate: room creation, host connect/reconnect, host disconnect grace timer, and room deletion.
- Stop Poll and room deletion stay immediate. Pending result batches are cancelled when the room closes.
- For Fast V1, keep 1000 voters per room until a deployed Cloudflare load test confirms a higher cap. Raising the cap again should come with a remote production load test and anti-spam rate limits.

Local performance before result batching was checked on May 7, 2026 with Wrangler dev at `http://127.0.0.1:8787`:

| Voters | Batch | Connect time | Vote to final live result |
| --- | ---: | ---: | ---: |
| 100 | 50 | 569.7 ms | 561.6 ms |
| 250 | 50 | 2270.9 ms | 2767.5 ms |
| 500 | 50 | 7634.9 ms | 10633.3 ms |

Local performance after 1 second dirty result batching was checked on May 7, 2026 with Wrangler dev at `http://127.0.0.1:8788`:

| Voters | Batch | Connect time | Vote to final live result |
| --- | ---: | ---: | ---: |
| 500 | 50 | 3561.6 ms | 1514.5 ms |
| 1000 | 100 | 7998.1 ms | 3256.9 ms |

Local performance after host-only result broadcasts and duplicate vote no-ops was checked on May 7, 2026 with Wrangler dev at `http://127.0.0.1:8789`:

| Voters | Batch | Connect time | Vote to final host result |
| --- | ---: | ---: | ---: |
| 100 | 50 | 518.9 ms | 477.3 ms |
| 250 | 50 | 1472.8 ms | 529.9 ms |
| 500 | 50 | 3439.1 ms | 1583.3 ms |
| 1000 | 100 | 8412.2 ms | 2652.3 ms |

Local performance after incremental counts and 500 ms storage write batching was checked on May 7, 2026 with Wrangler dev at `http://127.0.0.1:8790`:

| Voters | Batch | Connect time | Vote to final host result |
| --- | ---: | ---: | ---: |
| 100 | 50 | 264.1 ms | 731.7 ms |
| 250 | 50 | 689.7 ms | 305 ms |
| 500 | 50 | 1301.9 ms | 722.9 ms |
| 1000 | 100 | 2369.9 ms | 637.8 ms |

These are local development numbers, not production Cloudflare guarantees. They are still useful as regression checks for the current implementation.

## Deployment

- GitHub repository: `https://github.com/BEERZXD/quickpoll`
- Vercel production URL: `https://quickpoll-lovat-seven.vercel.app`
- Vercel deployment ID: `dpl_kjTnzuDA1dtFiDTWwoYLWWLWrbpZ`
- Vercel deploys the Next.js app from GitHub.
- GitHub Actions can deploy the Cloudflare Worker when these secrets are configured:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Update `ALLOWED_ORIGINS` in `wrangler.jsonc` or Cloudflare Worker settings to include the Vercel production URL.
- Set Vercel `NEXT_PUBLIC_REALTIME_URL` to the Worker URL, for example `https://quickpoll-realtime.<account>.workers.dev`.
- `wrangler.jsonc` uses a past supported compatibility date so local Wrangler can start reliably.
- The Vercel frontend is deployed, but production poll creation needs the Cloudflare Worker deployed and `NEXT_PUBLIC_REALTIME_URL` configured. Local Wrangler was not authenticated on May 7, 2026, so the Worker could not be deployed from this machine yet.

## Routes

- `/` starts with only two choices: create a poll or join by 6 digit room code.
- `/create` opens the poll creation form.
- `/join` opens the room-code join form.
- The first two choices are real route-backed links so they still navigate if client hydration is delayed, then enhance into instant in-page transitions after React loads.
- `/host/[roomCode]?token=...` is the private admin dashboard.
- `/poll/[roomCode]` is the voter page used by QR codes and room entry.

## Realtime Protocol

- `POST /polls` creates a room.
- `GET /polls/:roomCode` returns public poll state while the room is active.
- `GET /polls/:roomCode/socket` upgrades to a WebSocket.
- Host sockets send `stopPoll`.
- Voter sockets send `vote`, `clearVote`, and `leave`.
- Server messages are `state`, `results`, `roomClosed`, and `error`.

## Verification

The current implementation has been checked with:

```bash
npm.cmd test
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npx.cmd wrangler deploy --dry-run
npm.cmd audit --audit-level=moderate
npm.cmd run perf:local -- --voters 100 --batch 50
npm.cmd run perf:local -- --voters 250 --batch 50
npm.cmd run perf:local -- --voters 500 --batch 50
npm.cmd run perf:local -- --voters 1000 --batch 100
```

Local smoke coverage also created a room through the Worker, connected one host and two voters over WebSocket, counted votes live, removed a vote when a voter socket closed, stopped the poll from the host socket, kicked the remaining voter, and confirmed the deleted room returned 404.

`agent-browser` is installed as a dev dependency for visual checks of the local Next.js app. It has verified that the home page renders interactive create/join controls, has no framework error overlay, uses `Noto Sans Thai`, and can submit the create form into the admin dashboard.

On May 7, 2026, the local browser flow was rechecked on both `http://localhost:3001` and `http://127.0.0.1:3001`: create and join links opened their real routes, `127.0.0.1` poll creation posted to the local Worker successfully, and the host WebSocket connected.

Closed-poll voter UI has been verified with `agent-browser`: after the host clicks Stop Poll, the voter choice buttons and reset/clear button are disabled.

On May 7, 2026, Vercel production deploy `dpl_kjTnzuDA1dtFiDTWwoYLWWLWrbpZ` was inspected as `Ready`, and `agent-browser` verified that `https://quickpoll-lovat-seven.vercel.app` loads the home page and `/create` route with no console or page errors. Production poll creation was not fully functional yet because the Cloudflare Worker URL was not configured in Vercel.
