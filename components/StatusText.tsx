export type SaveStatus = { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string };

export function StatusText({ status }: { status: SaveStatus }) {
  if (status.kind === "idle") return <span role="status" aria-live="polite" />;
  if (status.kind === "saved") {
    return (
      <span role="status" aria-live="polite" className="text-sm font-semibold text-[var(--good-fg)]">
        ✓ Saved
      </span>
    );
  }
  return (
    <span role="alert" className="text-sm font-semibold text-[var(--bad-fg)]">
      ✕ {status.message}
    </span>
  );
}
