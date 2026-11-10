export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <div className="bg-surface-2 mb-8 h-10 w-72 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface-2 h-28 rounded-[1.25rem]" />
        ))}
      </div>
      <div className="bg-surface-2 mt-6 h-72 rounded-[1.25rem]" />
    </div>
  );
}
