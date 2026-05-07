#!/usr/bin/env node

import { performance } from "node:perf_hooks";

const DEFAULTS = {
  batch: 50,
  connectTimeoutMs: 20_000,
  settleTimeoutMs: 60_000,
  worker: "http://127.0.0.1:8787",
  origin: "http://localhost:3001",
  voters: 100,
};

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const workerUrl = config.worker.replace(/\/$/, "");
  const socketBaseUrl = toSocketUrl(workerUrl);
  const poll = {
    title: "Load test",
    question: `How fast can ${config.voters} voters update?`,
    options: ["A", "B", "C", "D"],
  };

  const createStartedAt = performance.now();
  const created = await createPoll(workerUrl, config.origin, poll);
  const createMs = performance.now() - createStartedAt;

  const roomCode = created.roomCode;
  const hostUrl = `${socketBaseUrl}/polls/${roomCode}/socket?role=host&token=${created.hostToken}`;
  const host = await openSocket(hostUrl, config.connectTimeoutMs);
  await waitForMessage(host, (message) => message.type === "state", config.connectTimeoutMs);

  const voters = [];
  const connectStartedAt = performance.now();
  await runBatches(config.voters, config.batch, async (index) => {
    const sessionId = `load-${process.pid}-${index}`;
    const url = `${socketBaseUrl}/polls/${roomCode}/socket?role=voter&sessionId=${sessionId}`;
    const socket = await openSocket(url, config.connectTimeoutMs);
    await waitForMessage(socket, (message) => message.type === "state", config.connectTimeoutMs);
    voters.push(socket);
  });
  const connectMs = performance.now() - connectStartedAt;

  let latestResults = null;
  const finalResults = waitForMessage(
    host,
    (message) => {
      if (message.type !== "results") {
        return false;
      }

      latestResults = message.state;
      return totalVotes(message.state.results) === config.voters;
    },
    config.settleTimeoutMs,
  );

  const voteStartedAt = performance.now();
  for (let index = 0; index < voters.length; index += 1) {
    const optionNumber = (index % poll.options.length) + 1;
    voters[index].send(JSON.stringify({ type: "vote", optionId: `option-${optionNumber}` }));
  }
  latestResults = (await finalResults).state;
  const voteMs = performance.now() - voteStartedAt;

  host.send(JSON.stringify({ type: "stopPoll" }));
  await waitForMessage(host, (message) => message.type === "roomClosed", config.connectTimeoutMs).catch(() => null);
  for (const socket of voters) {
    closeSocket(socket);
  }
  closeSocket(host);

  const result = {
    roomCode,
    voters: config.voters,
    batch: config.batch,
    createMs: round(createMs),
    connectMs: round(connectMs),
    voteToFinalResultsMs: round(voteMs),
    finalVoterCount: latestResults.voterCount,
    finalResults: latestResults.results,
  };

  console.log(JSON.stringify(result, null, 2));
}

function parseArgs(args) {
  const config = { ...DEFAULTS };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--voters") {
      config.voters = readPositiveInt(arg, next);
      index += 1;
    } else if (arg === "--batch") {
      config.batch = readPositiveInt(arg, next);
      index += 1;
    } else if (arg === "--worker") {
      config.worker = readString(arg, next);
      index += 1;
    } else if (arg === "--origin") {
      config.origin = readString(arg, next);
      index += 1;
    } else if (arg === "--connect-timeout-ms") {
      config.connectTimeoutMs = readPositiveInt(arg, next);
      index += 1;
    } else if (arg === "--settle-timeout-ms") {
      config.settleTimeoutMs = readPositiveInt(arg, next);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return config;
}

function readString(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function readPositiveInt(flag, value) {
  const parsed = Number.parseInt(readString(flag, value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

async function createPoll(workerUrl, origin, poll) {
  const response = await fetch(`${workerUrl}/polls`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(poll),
  });

  if (!response.ok) {
    throw new Error(`Create poll failed with ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function toSocketUrl(url) {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return parsed.toString().replace(/\/$/, "");
}

function openSocket(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      closeSocket(socket);
      reject(new Error(`Timed out opening ${url}`));
    }, timeoutMs);

    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        resolve(socket);
      },
      { once: true },
    );

    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error opening ${url}`));
      },
      { once: true },
    );
  });
}

function waitForMessage(socket, predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for WebSocket message"));
    }, timeoutMs);

    const handleMessage = (event) => {
      const parsed = parseMessage(event.data);
      if (!parsed.ok) {
        cleanup();
        reject(parsed.error);
        return;
      }

      if (predicate(parsed.message)) {
        cleanup();
        resolve(parsed.message);
      }
    };

    const handleClose = () => {
      cleanup();
      reject(new Error("WebSocket closed before expected message"));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
    };

    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose, { once: true });
  });
}

function parseMessage(data) {
  if (typeof data !== "string") {
    return { ok: false, error: new Error("Unexpected binary WebSocket message") };
  }

  try {
    return { ok: true, message: JSON.parse(data) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error("Invalid JSON WebSocket message"),
    };
  }
}

async function runBatches(total, batchSize, task) {
  for (let start = 0; start < total; start += batchSize) {
    const batch = [];
    const end = Math.min(start + batchSize, total);
    for (let index = start; index < end; index += 1) {
      batch.push(task(index));
    }
    await Promise.all(batch);
  }
}

function totalVotes(results) {
  return results.reduce((sum, result) => sum + result.count, 0);
}

function closeSocket(socket) {
  try {
    socket.close();
  } catch {
    // The load test is already ending; a close failure is not actionable here.
  }
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function printHelp() {
  console.log(`Usage: npm.cmd run perf:local -- [options]

Options:
  --voters <number>             Active voter sockets to open. Default: ${DEFAULTS.voters}
  --batch <number>              Parallel voter connections per batch. Default: ${DEFAULTS.batch}
  --worker <url>                Worker base URL. Default: ${DEFAULTS.worker}
  --origin <url>                App origin used for create links. Default: ${DEFAULTS.origin}
  --connect-timeout-ms <number> Per-socket connect/message timeout.
  --settle-timeout-ms <number>  Final results timeout after sending votes.
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
