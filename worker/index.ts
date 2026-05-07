import {
  DEFAULT_MAX_VOTERS,
  PollRoomCore,
  type PollConfig,
  type PollRoomCoreState,
  type PollRoomSnapshot,
} from "./room-core";
import { ResultBroadcastBatcher } from "./result-batcher";
import { shouldReceiveResultBroadcast } from "./socket-policy";
import { StorageWriteBatcher } from "./storage-batcher";

export interface Env {
  POLL_ROOMS: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
}

type CreatePollBody = {
  title?: unknown;
  question?: unknown;
  options?: unknown;
};

type SocketAttachment = {
  role: "host" | "voter";
  sessionId: string;
  hostToken?: string;
};

type ClientMessage =
  | { type: "vote"; optionId: string }
  | { type: "clearVote" }
  | { type: "leave" }
  | { type: "stopPoll" };

const ROOM_KEY = "room";
const RESULTS_FLUSH_MS = 1_000;
const STORAGE_FLUSH_MS = 500;
const apiCopy = {
  notFound: "ไม่พบปลายทางนี้",
  roomClosed: "ห้องถูกปิดแล้ว",
  missingSession: "ไม่พบเซสชัน",
  unexpected: "เกิดข้อผิดพลาด",
  roomExists: "มีห้องนี้อยู่แล้ว",
  expectedWebSocket: "ต้องเชื่อมต่อด้วย WebSocket",
  invalidSocketRole: "ประเภทการเชื่อมต่อไม่ถูกต้อง",
  couldNotJoin: "เข้าห้องไม่ได้",
  unsupportedHostMessage: "คำสั่งแอดมินไม่รองรับ",
  unsupportedVoterMessage: "คำสั่งผู้โหวตไม่รองรับ",
  leftRoom: "ออกจากห้องแล้ว",
  allocateRoomFailed: "สร้างรหัสห้องไม่สำเร็จ",
  invalidPayload: "ข้อมูลโพลไม่ถูกต้อง",
  titleRequired: "กรุณากรอกชื่อโพล",
  questionRequired: "กรุณากรอกคำถาม",
  optionCount: "โพลต้องมีตัวเลือก 2 ถึง 8 ตัวเลือก",
  binaryUnsupported: "ไม่รองรับข้อความแบบไบนารี",
  invalidMessage: "ข้อความไม่ถูกต้อง",
  invalidJson: "JSON ไม่ถูกต้อง",
} as const;

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/polls") {
      return createPoll(request, env);
    }

    const match = url.pathname.match(/^\/polls\/(\d{6})(?:\/socket)?$/);
    if (!match) {
      return json(request, env, { error: apiCopy.notFound }, 404);
    }

    const roomCode = match[1];
    const stub = env.POLL_ROOMS.get(env.POLL_ROOMS.idFromName(roomCode));

    if (url.pathname.endsWith("/socket")) {
      return stub.fetch(request);
    }

    return withCors(await stub.fetch(request), request, env);
  },
};

export default worker;

export class PollRoom {
  private readonly sockets = new Map<WebSocket, SocketAttachment>();
  private cachedCore: PollRoomCore | null | undefined;
  private readonly resultBatcher = new ResultBroadcastBatcher(() => {
    void this.flushBatchedResults().catch(() => null);
  }, RESULTS_FLUSH_MS);
  private readonly storageBatcher = new StorageWriteBatcher<PollRoomCoreState>((roomState) => {
    return this.state.storage.put(ROOM_KEY, roomState);
  }, STORAGE_FLUSH_MS);

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    for (const socket of state.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      if (attachment) {
        this.sockets.set(socket, attachment);
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname.endsWith("/create")) {
      return this.createRoom(request);
    }

    if (request.method === "GET" && url.pathname.endsWith("/socket")) {
      return this.connectSocket(request);
    }

    if (request.method === "GET") {
      const core = await this.loadCore();
      if (!core || !core.snapshot().active) {
        return Response.json({ error: apiCopy.roomClosed }, { status: 404 });
      }

      return Response.json(publicState(core.snapshot()));
    }

    return Response.json({ error: apiCopy.notFound }, { status: 404 });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = this.readAttachment(socket);
    if (!attachment) {
      socket.close(1008, apiCopy.missingSession);
      return;
    }

    const parsed = parseClientMessage(message);
    if (!parsed.ok) {
      send(socket, { type: "error", message: parsed.error });
      return;
    }

    const core = await this.loadCore();
    if (!core || !core.snapshot().active) {
      send(socket, { type: "roomClosed", reason: "closed" });
      socket.close(1000, apiCopy.roomClosed);
      return;
    }

    try {
      await this.handleMessage(core, attachment, parsed.message, socket);
    } catch (error) {
      send(socket, {
        type: "error",
        message: error instanceof Error ? toPublicError(error.message) : apiCopy.unexpected,
      });
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    await this.handleSocketGone(socket);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    await this.handleSocketGone(socket);
  }

  async alarm(): Promise<void> {
    const core = await this.loadCore();
    if (!core) {
      return;
    }

    const event = core.expireHostGrace();
    if (event?.type === "roomClosed") {
      await this.closeRoom(event.reason);
      return;
    }

    await this.saveCoreNow(core);
  }

  private async createRoom(request: Request): Promise<Response> {
    const existing = await this.loadCore();
    if (existing?.snapshot().active) {
      return Response.json({ error: apiCopy.roomExists }, { status: 409 });
    }

    const body = (await request.json()) as {
      poll: PollConfig;
      hostToken: string;
    };

    const core = PollRoomCore.create({
      poll: body.poll,
      hostToken: body.hostToken,
      maxVoters: DEFAULT_MAX_VOTERS,
    });
    await this.saveCoreNow(core);

    return Response.json(publicState(core.snapshot()), { status: 201 });
  }

  private async connectSocket(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return Response.json({ error: apiCopy.expectedWebSocket }, { status: 426 });
    }

    const core = await this.loadCore();
    if (!core || !core.snapshot().active) {
      return Response.json({ error: apiCopy.roomClosed }, { status: 404 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const sessionId = url.searchParams.get("sessionId") ?? crypto.randomUUID();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    try {
      let attachment: SocketAttachment;

      if (role === "host") {
        const hostToken = url.searchParams.get("token") ?? "";
        const event = core.joinHost(hostToken);
        attachment = { role: "host", sessionId: `host:${crypto.randomUUID()}`, hostToken };
        if (event.type === "hostReconnected") {
          await this.state.storage.deleteAlarm();
        }
      } else if (role === "voter") {
        attachment = { role: "voter", sessionId };
        core.joinVoter(sessionId);
      } else {
        return Response.json({ error: apiCopy.invalidSocketRole }, { status: 400 });
      }

      this.state.acceptWebSocket(server);
      server.serializeAttachment(attachment);
      this.sockets.set(server, attachment);
      if (attachment.role === "host") {
        await this.saveCoreNow(core);
      } else {
        this.scheduleCoreSave(core);
      }
      send(server, { type: "state", state: publicState(core.snapshot()) });
      this.scheduleResultsBroadcast();
      return new Response(null, { status: 101, webSocket: client });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? toPublicError(error.message) : apiCopy.couldNotJoin },
        { status: 400 },
      );
    }
  }

  private async handleMessage(
    core: PollRoomCore,
    attachment: SocketAttachment,
    message: ClientMessage,
    socket: WebSocket,
  ): Promise<void> {
    if (attachment.role === "host") {
      if (message.type !== "stopPoll") {
        send(socket, { type: "error", message: apiCopy.unsupportedHostMessage });
        return;
      }

      const event = core.stopPoll(attachment.hostToken ?? "");
      if (event.type === "roomClosed") {
        await this.closeRoom(event.reason);
      }
      return;
    }

    let changed = false;

    if (message.type === "vote") {
      changed = core.vote(attachment.sessionId, message.optionId);
    } else if (message.type === "clearVote") {
      changed = core.clearVote(attachment.sessionId);
    } else if (message.type === "leave") {
      changed = core.leaveVoter(attachment.sessionId);
      socket.close(1000, apiCopy.leftRoom);
    } else {
      send(socket, { type: "error", message: apiCopy.unsupportedVoterMessage });
      return;
    }

    if (!changed) {
      return;
    }

    this.scheduleCoreSave(core);
    this.scheduleResultsBroadcast();
  }

  private async handleSocketGone(socket: WebSocket): Promise<void> {
    const attachment = this.readAttachment(socket);
    this.sockets.delete(socket);

    if (!attachment) {
      return;
    }

    const core = await this.loadCore();
    if (!core || !core.snapshot().active) {
      return;
    }

    if (attachment.role === "voter") {
      if (core.leaveVoter(attachment.sessionId)) {
        this.scheduleCoreSave(core);
        this.scheduleResultsBroadcast();
      }
      return;
    }

    if (this.countHostSockets() > 0) {
      return;
    }

    const event = core.leaveHost();
    await this.saveCoreNow(core);
    if (event.type === "hostGraceStarted") {
      await this.state.storage.setAlarm(event.deleteAt);
    }
    this.broadcast({ type: "state", state: publicState(core.snapshot()) });
  }

  private async loadCore(): Promise<PollRoomCore | null> {
    if (this.cachedCore !== undefined) {
      return this.cachedCore;
    }

    const stored = await this.state.storage.get<PollRoomCoreState>(ROOM_KEY);
    if (!stored) {
      this.cachedCore = null;
      return null;
    }
    this.cachedCore = PollRoomCore.fromState(stored);
    return this.cachedCore;
  }

  private scheduleCoreSave(core: PollRoomCore): void {
    this.cachedCore = core;
    this.storageBatcher.schedule(core.toState());
  }

  private async saveCoreNow(core: PollRoomCore): Promise<void> {
    this.cachedCore = core;
    this.storageBatcher.cancel();
    await this.state.storage.put(ROOM_KEY, core.toState());
  }

  private async closeRoom(reason: "stopped" | "host-timeout"): Promise<void> {
    this.resultBatcher.cancel();
    this.storageBatcher.cancel();
    this.cachedCore = null;
    this.broadcast({ type: "roomClosed", reason });
    for (const socket of this.sockets.keys()) {
      socket.close(1000, apiCopy.roomClosed);
    }
    this.sockets.clear();
    await this.state.storage.delete(ROOM_KEY);
    await this.state.storage.deleteAlarm();
  }

  private broadcast(payload: unknown): void {
    for (const socket of this.sockets.keys()) {
      send(socket, payload);
    }
  }

  private scheduleResultsBroadcast(): void {
    if (this.countHostSockets() === 0) {
      return;
    }

    this.resultBatcher.schedule();
  }

  private async flushBatchedResults(): Promise<void> {
    const core = await this.loadCore();
    if (!core || !core.snapshot().active) {
      return;
    }

    this.broadcastResults({ type: "results", state: publicState(core.snapshot()) });
  }

  private broadcastResults(payload: unknown): void {
    for (const [socket, attachment] of this.sockets.entries()) {
      if (shouldReceiveResultBroadcast(attachment)) {
        send(socket, payload);
      }
    }
  }

  private countHostSockets(): number {
    let count = 0;
    for (const attachment of this.sockets.values()) {
      if (attachment.role === "host") {
        count += 1;
      }
    }
    return count;
  }

  private readAttachment(socket: WebSocket): SocketAttachment | null {
    return (socket.deserializeAttachment() as SocketAttachment | null) ?? this.sockets.get(socket) ?? null;
  }
}

async function createPoll(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as CreatePollBody | null;
  const validation = validatePoll(body);
  if (!validation.ok) {
    return json(request, env, { error: validation.error }, 400);
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomCode = makeRoomCode();
    const hostToken = crypto.randomUUID().replaceAll("-", "");
    const stub = env.POLL_ROOMS.get(env.POLL_ROOMS.idFromName(roomCode));
    const response = await stub.fetch("https://room/create", {
      method: "POST",
      body: JSON.stringify({ poll: validation.poll, hostToken }),
    });

    if (response.status === 409) {
      continue;
    }

    const state = await response.json();
    const appOrigin = request.headers.get("Origin") ?? new URL(request.url).origin;
    return json(
      request,
      env,
      {
        roomCode,
        hostToken,
        hostUrl: `${appOrigin}/host/${roomCode}?token=${hostToken}`,
        voterUrl: `${appOrigin}/poll/${roomCode}`,
        state,
      },
      201,
    );
  }

  return json(request, env, { error: apiCopy.allocateRoomFailed }, 503);
}

function validatePoll(body: CreatePollBody | null):
  | { ok: true; poll: PollConfig }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: apiCopy.invalidPayload };
  }

  const title = cleanText(body.title, 80);
  const question = cleanText(body.question, 140);
  const rawOptions = Array.isArray(body.options) ? body.options : [];
  const optionTexts = rawOptions
    .map((option) => cleanText(option, 80))
    .filter((option): option is string => Boolean(option));

  if (!title) {
    return { ok: false, error: apiCopy.titleRequired };
  }

  if (!question) {
    return { ok: false, error: apiCopy.questionRequired };
  }

  if (optionTexts.length < 2 || optionTexts.length > 8) {
    return { ok: false, error: apiCopy.optionCount };
  }

  return {
    ok: true,
    poll: {
      title,
      question,
      options: optionTexts.map((text, index) => ({
        id: `option-${index + 1}`,
        text,
      })),
    },
  };
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().replace(/\s+/g, " ");
  return text ? text.slice(0, maxLength) : null;
}

function publicState(snapshot: PollRoomSnapshot) {
  return {
    active: snapshot.active,
    poll: snapshot.poll,
    results: snapshot.results,
    voterCount: snapshot.voterCount,
    hostConnected: snapshot.hostConnected,
    hostGraceDeleteAt: snapshot.hostGraceDeleteAt,
  };
}

function makeRoomCode(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

function parseClientMessage(message: string | ArrayBuffer):
  | { ok: true; message: ClientMessage }
  | { ok: false; error: string } {
  if (typeof message !== "string") {
    return { ok: false, error: apiCopy.binaryUnsupported };
  }

  try {
    const parsed = JSON.parse(message) as ClientMessage;
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return { ok: false, error: apiCopy.invalidMessage };
    }

    return { ok: true, message: parsed };
  } catch {
    return { ok: false, error: apiCopy.invalidJson };
  }
}

function send(socket: WebSocket, payload: unknown): void {
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    socket.close(1011, "Send failed");
  }
}

function toPublicError(message: string): string {
  if (message === "Room is closed") {
    return apiCopy.roomClosed;
  }
  if (message === "Room is full") {
    return "ห้องเต็มแล้ว";
  }
  if (message === "Invalid option") {
    return "ตัวเลือกไม่ถูกต้อง";
  }
  if (message === "Invalid host token") {
    return "ลิงก์แอดมินไม่ถูกต้อง";
  }
  if (message === "Voter is not in room") {
    return "ผู้โหวตไม่ได้อยู่ในห้อง";
  }
  return message;
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: corsHeaders(request, env),
  });
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const requestOrigin = request.headers.get("Origin") ?? "*";
  const allowed = (env.ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = allowed.includes("*") || allowed.includes(requestOrigin) ? requestOrigin : allowed[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
