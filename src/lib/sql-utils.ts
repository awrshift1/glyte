import path from "path";

const ALLOWED_DATA_DIRS = [
  path.join(process.cwd(), "data"),
  "/tmp",
];

/**
 * Quote a SQL identifier (table/column name) safely.
 * Escapes embedded double-quotes by doubling them.
 * "my_table" → "my_table", 'my"table' → "my""table"
 */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Quote a SQL string literal safely.
 * Escapes embedded single-quotes by doubling them.
 * 'hello' → 'hello', "it's" → 'it''s'
 */
export function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Validate that a CSV path is within allowed directories.
 * Prevents path traversal attacks via crafted file paths.
 */
export function safeCsvPath(csvPath: string): string {
  const resolved = path.resolve(csvPath);
  const isAllowed = ALLOWED_DATA_DIRS.some((dir) =>
    resolved.startsWith(path.resolve(dir) + path.sep) || resolved === path.resolve(dir)
  );
  if (!isAllowed) {
    throw new Error("Invalid file path: outside allowed directory");
  }
  return resolved;
}

/**
 * Sanitize error messages for client responses.
 * Strips file paths, stack traces, and internal details.
 */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Strip file paths and stack traces
    return error.message
      .replace(/\/[^\s:]+/g, "[path]")
      .replace(/at\s+.+/g, "")
      .trim();
  }
  return "An unexpected error occurred";
}
