import type { HandoffRequest } from "./types";

/** Quote a cell and neutralise spreadsheet formulas (=, +, -, @) that could run when the file is opened. */
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

const COLUMNS = ["id", "client", "title", "type", "queue", "owner", "priority", "status", "source", "createdAt", "dueAt", "resolvedAt"] as const;

export function requestsToCsv(requests: HandoffRequest[]): string {
  const rows = requests.map((request) => COLUMNS.map((key) => csvCell(request[key])).join(","));
  return [COLUMNS.join(","), ...rows].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
