import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--wash)] p-5">
      <Card className="max-w-lg p-8 text-center">
        <p className="text-sm font-black uppercase tracking-widest text-[var(--blue)]">
          404
        </p>
        <h1 className="mt-3 text-2xl font-black">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page may have moved or the assignment link may no longer be valid.
        </p>
        <Link
          href="/"
          className="focus-ring mt-6 inline-flex h-11 items-center rounded-xl bg-[var(--navy)] px-5 text-sm font-bold text-white"
        >
          Return home
        </Link>
      </Card>
    </main>
  );
}
