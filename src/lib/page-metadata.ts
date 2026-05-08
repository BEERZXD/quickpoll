import type { Metadata } from "next";
import { appCopy } from "./copy";

export function createPageMetadata(): Metadata {
  return baseMetadata(appCopy.metadata.createTitle);
}

export function hostPageMetadata(roomCode: string): Metadata {
  return baseMetadata(appCopy.metadata.hostTitle(roomCode));
}

export function voterPageMetadata(roomCode: string): Metadata {
  return baseMetadata(appCopy.metadata.voterTitle(roomCode));
}

function baseMetadata(title: string): Metadata {
  return {
    title,
    description: appCopy.metadata.description,
  };
}
