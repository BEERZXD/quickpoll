import { appCopy, fontConfig } from "./copy";
import { getWinningOptionIds } from "./result-ui";
import type { PollState } from "./types";

export type ResultImageRow = {
  optionId: string;
  text: string;
  count: number;
  percent: number;
  color: string;
  isWinner: boolean;
};

export type ResultImageModel = {
  title: string;
  question: string;
  totalVotes: number;
  rows: ResultImageRow[];
};

export type ResultImageRowLayout = {
  rowHeight: number;
  textFirstBaselineY: number;
  winnerLabelBaselineY: number | null;
  winnerLabelBottomY: number;
  barY: number;
};

export type ResultImageHeaderLayout = {
  brandBaselineY: number;
  timestampBaselineY: number;
  titleFirstBaselineY: number;
};

export type ResultImageFaviconShape =
  | { kind: "roundRect"; x: number; y: number; width: number; height: number; radius: number; fill: string }
  | { kind: "circle"; cx: number; cy: number; radius: number; fill: string };

export const resultImageBrandName = "bquickpoll";
export const resultImageColors = ["#22d3ee", "#ffcc30", "#ff7ab6", "#7cf36e", "#c084fc", "#fb923c", "#67e8f9", "#f87171"];

const rowPadding = 28;
const optionTextBaselineOffset = 34;
const optionTextLineHeight = 42;
const winnerLabelFontSize = 24;
const winnerLabelTopGap = 8;
const barTopGap = 18;
const barHeight = 28;
const headerTitleTopGap = 106;

export function buildResultImageModel(state: PollState): ResultImageModel {
  const totalVotes = state.results.reduce((total, result) => total + result.count, 0);
  const winningOptionIds = new Set(getWinningOptionIds(state.results));

  return {
    title: state.poll.title,
    question: state.poll.question,
    totalVotes,
    rows: state.poll.options.map((option, index) => {
      const count = state.results.find((result) => result.optionId === option.id)?.count ?? 0;
      return {
        optionId: option.id,
        text: option.text,
        count,
        percent: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
        color: resultImageColors[index % resultImageColors.length],
        isWinner: totalVotes > 0 && winningOptionIds.has(option.id),
      };
    }),
  };
}

export function resultImageFilename(roomCode: string, date = new Date()): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());

  return `bquickpoll-${roomCode}-${year}-${month}-${day}-${hour}${minute}.png`;
}

export function resultImageTimestampLabel(date = new Date()): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function resultImageFaviconShapes({
  x,
  y,
  size,
}: {
  x: number;
  y: number;
  size: number;
}): ResultImageFaviconShape[] {
  const scale = size / 64;
  const sx = (value: number) => x + value * scale;
  const sy = (value: number) => y + value * scale;
  const ss = (value: number) => value * scale;

  return [
    { kind: "roundRect", x, y, width: size, height: size, radius: ss(14), fill: "#101114" },
    { kind: "circle", cx: sx(47), cy: sy(17), radius: ss(6), fill: "#ffcc30" },
    { kind: "roundRect", x: sx(15), y: sy(18), width: ss(26), height: ss(8), radius: ss(4), fill: "#22d3ee" },
    { kind: "roundRect", x: sx(15), y: sy(32), width: ss(34), height: ss(8), radius: ss(4), fill: "#ffcc30" },
    { kind: "roundRect", x: sx(15), y: sy(46), width: ss(20), height: ss(8), radius: ss(4), fill: "#22d3ee" },
    { kind: "circle", cx: sx(12), cy: sy(22), radius: ss(3), fill: "#fff8e8" },
    { kind: "circle", cx: sx(12), cy: sy(36), radius: ss(3), fill: "#fff8e8" },
    { kind: "circle", cx: sx(12), cy: sy(50), radius: ss(3), fill: "#fff8e8" },
  ];
}

export function resultImageHeaderLayout({ top }: { top: number }): ResultImageHeaderLayout {
  return {
    brandBaselineY: top,
    timestampBaselineY: top + 34,
    titleFirstBaselineY: top + headerTitleTopGap,
  };
}

export function wrapResultImageText(text: string, measureText: (text: string) => number, maxWidth: number): string[] {
  const chars = Array.from(text.trim() || "-");
  const lines: string[] = [];
  let line = "";

  for (const char of chars) {
    const next = line + char;
    if (line && measureText(next) > maxWidth) {
      lines.push(line.trimEnd());
      line = char.trimStart();
    } else {
      line = next;
    }
  }

  if (line) {
    lines.push(line.trimEnd());
  }

  return lines;
}

export function resultImageRowLayout({
  lineCount,
  isWinner,
}: {
  lineCount: number;
  isWinner: boolean;
}): ResultImageRowLayout {
  const safeLineCount = Math.max(1, lineCount);
  const textFirstBaselineY = rowPadding + optionTextBaselineOffset;
  const textBottomY = textFirstBaselineY + safeLineCount * optionTextLineHeight;
  const winnerLabelBaselineY = isWinner ? textBottomY + winnerLabelTopGap : null;
  const winnerLabelBottomY = winnerLabelBaselineY === null ? textBottomY : winnerLabelBaselineY + winnerLabelFontSize;
  const barY = winnerLabelBottomY + barTopGap;

  return {
    rowHeight: barY + barHeight + rowPadding,
    textFirstBaselineY,
    winnerLabelBaselineY,
    winnerLabelBottomY,
    barY,
  };
}

export async function renderResultImageBlob({
  roomCode,
  state,
  exportedAt = new Date(),
}: {
  roomCode: string;
  state: PollState;
  exportedAt?: Date;
}): Promise<Blob> {
  await document.fonts?.ready;

  const model = buildResultImageModel(state);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available");
  }

  const width = 1080;
  const padding = 72;
  const contentWidth = width - padding * 2;
  const rowGap = 18;

  context.font = `900 54px "${fontConfig.sansName}", sans-serif`;
  const titleLines = wrapResultImageText(model.title, (line) => context.measureText(line).width, contentWidth);
  context.font = `800 40px "${fontConfig.sansName}", sans-serif`;
  const questionLines = wrapResultImageText(model.question, (line) => context.measureText(line).width, contentWidth);
  context.font = `900 34px "${fontConfig.sansName}", sans-serif`;
  const rowLineGroups = model.rows.map((row) =>
    wrapResultImageText(row.text, (line) => context.measureText(line).width, contentWidth - rowPadding * 2 - 180),
  );
  const rowLayouts = model.rows.map((row, index) =>
    resultImageRowLayout({
      lineCount: rowLineGroups[index].length,
      isWinner: row.isWinner,
    }),
  );
  const headerLayout = resultImageHeaderLayout({ top: padding });

  const headerHeight = headerTitleTopGap + titleLines.length * 66 + questionLines.length * 50 + 28;
  const rowsHeight = rowLayouts.reduce((total, layout) => total + layout.rowHeight, 0) + rowGap * Math.max(0, model.rows.length - 1);
  const footerHeight = 88;
  const height = padding * 2 + headerHeight + rowsHeight + footerHeight;

  canvas.width = width;
  canvas.height = height;

  drawBackground(context, width, height);

  const faviconSize = 46;
  drawFavicon(context, resultImageFaviconShapes({ x: padding, y: padding - 35, size: faviconSize }));
  context.fillStyle = "#b7f7ff";
  context.font = `900 28px "${fontConfig.sansName}", sans-serif`;
  context.fillText(resultImageBrandName, padding + faviconSize + 16, headerLayout.brandBaselineY);
  context.fillStyle = "#ffcc30";
  context.font = `900 30px "${fontConfig.monoName}", monospace`;
  context.textAlign = "right";
  context.fillText(roomCode, width - padding, headerLayout.brandBaselineY);
  context.fillStyle = "rgba(255, 248, 232, 0.62)";
  context.font = `800 24px "${fontConfig.monoName}", monospace`;
  context.fillText(resultImageTimestampLabel(exportedAt), width - padding, headerLayout.timestampBaselineY);
  context.textAlign = "left";

  let y = headerLayout.titleFirstBaselineY;
  context.fillStyle = "#fff8e8";
  context.font = `900 54px "${fontConfig.sansName}", sans-serif`;
  for (const line of titleLines) {
    context.fillText(line, padding, y);
    y += 66;
  }

  context.fillStyle = "rgba(255, 248, 232, 0.78)";
  context.font = `800 40px "${fontConfig.sansName}", sans-serif`;
  for (const line of questionLines) {
    context.fillText(line, padding, y);
    y += 50;
  }

  y += 28;
  model.rows.forEach((row, index) => {
    const lines = rowLineGroups[index];
    const layout = rowLayouts[index];
    const rowHeight = layout.rowHeight;
    drawRoundedRect(context, padding, y, contentWidth, rowHeight, 18, row.isWinner ? "rgba(255, 204, 48, 0.12)" : "rgba(255, 255, 255, 0.07)");

    if (row.isWinner) {
      context.strokeStyle = "rgba(255, 204, 48, 0.78)";
      context.lineWidth = 3;
      strokeRoundedRect(context, padding, y, contentWidth, rowHeight, 18);
    }

    let textY = y + layout.textFirstBaselineY;
    context.fillStyle = "#fff8e8";
    context.font = `900 34px "${fontConfig.sansName}", sans-serif`;
    for (const line of lines) {
      context.fillText(line, padding + rowPadding, textY);
      textY += optionTextLineHeight;
    }

    if (row.isWinner && layout.winnerLabelBaselineY !== null) {
      context.fillStyle = "#ffcc30";
      context.font = `900 ${winnerLabelFontSize}px "${fontConfig.sansName}", sans-serif`;
      context.fillText(appCopy.host.winnerLabel, padding + rowPadding, y + layout.winnerLabelBaselineY);
    }

    context.fillStyle = "#ffcc30";
    context.font = `900 52px "${fontConfig.monoName}", monospace`;
    context.textAlign = "right";
    context.fillText(String(row.count), width - padding - rowPadding, y + rowPadding + 48);
    context.font = `800 28px "${fontConfig.monoName}", monospace`;
    context.fillStyle = "rgba(255, 248, 232, 0.66)";
    context.fillText(`${row.percent}%`, width - padding - rowPadding, y + rowPadding + 84);
    context.textAlign = "left";

    const barY = y + layout.barY;
    drawRoundedRect(context, padding + rowPadding, barY, contentWidth - rowPadding * 2, barHeight, 10, "rgba(255, 255, 255, 0.12)");
    if (row.percent > 0) {
      const barWidth = Math.max(12, ((contentWidth - rowPadding * 2) * row.percent) / 100);
      drawRoundedRect(context, padding + rowPadding, barY, barWidth, barHeight, 10, row.color);
    }

    y += rowHeight + rowGap;
  });

  y += 32;
  context.fillStyle = "rgba(255, 248, 232, 0.62)";
  context.font = `800 28px "${fontConfig.sansName}", sans-serif`;
  context.fillText(`${appCopy.host.votersLabel}: ${model.totalVotes}`, padding, y);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("PNG export failed");
  }

  return blob;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function drawBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = "#101114";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(34, 211, 238, 0.08)";
  context.fillRect(0, 0, width, 18);
  context.fillStyle = "rgba(255, 204, 48, 0.10)";
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(width * 0.36, 0);
  context.lineTo(0, height * 0.16);
  context.closePath();
  context.fill();
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
): void {
  roundedRectPath(context, x, y, width, height, radius);
  context.fillStyle = fillStyle;
  context.fill();
}

function drawFavicon(context: CanvasRenderingContext2D, shapes: ResultImageFaviconShape[]): void {
  for (const shape of shapes) {
    if (shape.kind === "roundRect") {
      drawRoundedRect(context, shape.x, shape.y, shape.width, shape.height, shape.radius, shape.fill);
    } else {
      context.beginPath();
      context.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
      context.fillStyle = shape.fill;
      context.fill();
    }
  }
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  roundedRectPath(context, x, y, width, height, radius);
  context.stroke();
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}
