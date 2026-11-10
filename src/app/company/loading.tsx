export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <div className="mb-8 h-10 w-72 rounded-xl bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-[1.25rem] bg-surface-2" />)}</div>
      <div className="mt-6 h-72 rounded-[1.25rem] bg-surface-2" />
    </div>
  );
}
