export function NotFoundScene() {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative mx-auto flex h-48 w-full max-w-md items-center justify-center overflow-hidden sm:h-56"
    >
      <span className="absolute size-40 rounded-full bg-primary/10 blur-3xl" />
      <span className="absolute size-32 rotate-12 rounded-[2rem] border border-primary/30 bg-gradient-to-br from-primary/15 via-lavender/10 to-transparent shadow-[0_0_80px_-28px_rgba(212,175,55,0.65)]" />
      <span className="absolute size-24 -rotate-12 rounded-[1.5rem] border border-white/10 bg-white/[0.03] backdrop-blur-sm" />
      <span className="relative text-7xl drop-shadow-[0_12px_32px_rgba(212,175,55,0.28)] sm:text-8xl">
        🧸
      </span>
    </div>
  );
}
