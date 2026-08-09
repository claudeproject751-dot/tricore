import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "1,234" — used for dataset counts. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** Compact relative time for the history rail. */
export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Minimal RFC 4180 CSV parser: handles quoted fields, escaped quotes and
 * newlines inside quotes. Enough for "one sentence per row" uploads without
 * pulling in a dependency.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/**
 * Pulls the text column out of an uploaded CSV.
 * Prefers a column literally named text/sentence/content; falls back to the
 * longest-on-average column, and drops an obvious header row.
 */
export function extractTextColumn(rows: string[][]): string[] {
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const named = header.findIndex((h) => ["text", "sentence", "content", "message", "body"].includes(h));

  if (named !== -1) {
    return rows
      .slice(1)
      .map((r) => (r[named] ?? "").trim())
      .filter(Boolean);
  }

  if (rows[0].length === 1) {
    const values = rows.map((r) => r[0].trim()).filter(Boolean);
    // Drop a lone header cell that is clearly a column name, not a sentence.
    if (values.length > 1 && values[0].length < 20 && !values[0].includes(" ")) {
      return values.slice(1);
    }
    return values;
  }

  const columnCount = Math.max(...rows.map((r) => r.length));
  let best = 0;
  let bestScore = -1;
  for (let c = 0; c < columnCount; c += 1) {
    const lengths = rows.map((r) => (r[c] ?? "").trim().length);
    const score = lengths.reduce((a, b) => a + b, 0) / rows.length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return rows.map((r) => (r[best] ?? "").trim()).filter(Boolean);
}

export function toCsv(rows: (string | number)[][]): string {
  const escape = (cell: string | number) => {
    const value = String(cell);
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return rows.map((r) => r.map(escape).join(",")).join("\r\n");
}

export function downloadFile(filename: string, contents: string, mime = "text/csv"): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
