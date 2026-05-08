import type { Metadata } from "next";
import { appCopy } from "./copy";
import { fetchJson, realtimeHttpUrl } from "./poll-api";
import type { PollState } from "./types";

type VoterPageMetadataInput = {
  roomCode: string;
  pollTitle?: string | null;
};

export function createPageMetadata(): Metadata {
  return baseMetadata(appCopy.metadata.createTitle);
}

export function hostPageMetadata(roomCode: string): Metadata {
  return baseMetadata(appCopy.metadata.hostTitle(roomCode));
}

export async function fetchVoterPageMetadata(roomCode: string): Promise<Metadata> {
  try {
    const state = await fetchJson<PollState>(realtimeHttpUrl(`/polls/${roomCode}`), { cache: "no-store" });
    return voterPageMetadata({ roomCode, pollTitle: state.poll.title });
  } catch {
    return voterPageMetadata({ roomCode });
  }
}

export function voterPageMetadata({ roomCode, pollTitle }: VoterPageMetadataInput): Metadata {
  const title = appCopy.metadata.voterTitle(roomCode);
  const description = normalizeMetadataText(pollTitle) || appCopy.metadata.voterFallbackDescription(roomCode);

  return {
    ...baseMetadata(title, description),
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

function baseMetadata(title: string, description: string = appCopy.metadata.description): Metadata {
  return {
    title,
    description,
  };
}

function normalizeMetadataText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}
