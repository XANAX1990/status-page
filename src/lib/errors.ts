/**
 * A label for an error that is safe to log: its class name and its code, never its message.
 * Driver and network error messages can carry hosts, connection strings or query details.
 * The label is still enough to tell "authentication failed" (MongoServerError 18) from
 * "not authorized" (13) or a timeout when reading the host's logs.
 */
export function errorLabel(err: unknown): string {
  if (!(err instanceof Error)) return "unknown error";
  const code = (err as { code?: unknown }).code;
  const plain = typeof code === "number" || (typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code));
  return plain ? `${err.name} ${code}` : err.name;
}
