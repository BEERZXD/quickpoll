export type HomeMode = "start" | "create" | "join";

export function homeModePath(mode: HomeMode): string {
  if (mode === "create" || mode === "join") {
    return `/${mode}`;
  }

  return "/";
}

export function normalizeHomeMode(value: string | string[] | undefined): HomeMode {
  const mode = Array.isArray(value) ? value[0] : value;

  if (mode === "create" || mode === "join") {
    return mode;
  }

  return "start";
}
