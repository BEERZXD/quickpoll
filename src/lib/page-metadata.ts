import type { Metadata } from "next";
import { appCopy } from "./copy";

export function createPageMetadata(): Metadata {
  return baseMetadata(appCopy.metadata.createTitle);
}

export function hostPageMetadata(roomCode: string): Metadata {
  return baseMetadata(appCopy.metadata.hostTitle(roomCode));
}

export function voterPageMetadata(roomCode: string): Metadata {
  const title = appCopy.metadata.voterTitle(roomCode);
  const description = appCopy.metadata.voterDescription(roomCode);

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
