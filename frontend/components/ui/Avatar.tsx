export function Avatar({ name, initials }: { name: string; initials: string }) {
  return (
    <div
      aria-label={name}
      className="w-9 h-9 rounded-full bg-accent-soft flex items-center
                 justify-center text-accent-hover font-bold text-xs
                 shrink-0 select-none ring-2 ring-surface"
    >
      {initials}
    </div>
  );
}
