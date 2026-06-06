import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  FileImage,
  ShieldCheck,
} from "lucide-react";
import { isDemoMode } from "@/lib/runtime-config";

export default function Home() {
  const demo = isDemoMode();
  return (
    <main className="min-h-screen bg-white">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--navy)] font-black text-white">
            TS
          </div>
          <div>
            <p className="font-extrabold text-[var(--navy-dark)]">
              Trevor&apos;s SAT Suite
            </p>
            <p className="text-xs text-slate-500">Private student practice</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={demo ? "/student" : "/login?role=student"}
            className="focus-ring rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            {demo ? "Student demo" : "Student sign in"}
          </Link>
          <Link
            href={demo ? "/tutor" : "/login?role=tutor"}
            className="focus-ring rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--navy-dark)]"
          >
            {demo ? "Tutor demo" : "Tutor sign in"}
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden border-y bg-[var(--wash)]">
        <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-blue-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-12 lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[1.1fr_.9fr] lg:py-8">
          <div className="self-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-bold text-[var(--navy)] shadow-sm">
              <ShieldCheck className="h-4 w-4 text-[var(--green)]" />
              Built for one-on-one SAT tutoring
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.08] tracking-tight text-[var(--navy-dark)] sm:text-6xl">
              Serious SAT practice, with every detail intact.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Import official Question Bank exports as exact images, assign
              Bluebook-inspired practice, and see where every student gains or
              loses time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={demo ? "/tutor" : "/login?role=tutor"}
                className="focus-ring inline-flex h-13 items-center gap-2 rounded-xl bg-[var(--navy)] px-6 font-bold text-white shadow-lg shadow-blue-950/15 hover:bg-[var(--navy-dark)]"
              >
                {demo ? "Open tutor workspace" : "Sign in"}{" "}
                <ArrowRight className="h-5 w-5" />
              </Link>
              {demo && (
                <Link
                  href="/student/test/demo"
                  className="focus-ring inline-flex h-13 items-center gap-2 rounded-xl border bg-white px-6 font-bold text-[var(--ink)] hover:bg-slate-50"
                >
                  Preview testing mode
                </Link>
              )}
            </div>
          </div>

          <div className="card-shadow relative mx-auto w-full max-w-[26rem] overflow-hidden rounded-[2rem] border border-white/80 bg-white">
            <div className="relative aspect-[3/4] lg:aspect-auto lg:h-[min(32rem,calc(100svh-9rem))]">
              <Image
                src="/trevor-hero.png"
                alt="Trevor, SAT tutor, holding a laptop"
                fill
                preload
                sizes="(max-width: 1024px) 92vw, 40vw"
                className="object-cover object-[center_18%]"
              />
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[var(--navy-dark)]/85 via-[var(--navy-dark)]/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-100">
                  Your SAT tutor
                </p>
                <p className="mt-2 text-3xl font-black">Hi, I&apos;m Trevor.</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-blue-50">
                  CompSci Undergraduate | 1550 SAT | 8.5 IELTS
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            [
              FileImage,
              "Pixel-faithful import",
              "Equations, graphs, tables, and choices stay exactly as exported.",
            ],
            [
              Calculator,
              "Desmos-ready Math",
              "Graphing and scientific calculators live beside the test.",
            ],
            [
              BarChart3,
              "Useful analytics",
              "See skill accuracy, pacing, omissions, and long-term growth.",
            ],
            [
              CheckCircle2,
              "Tutor-controlled",
              "Choose assignments, accommodations, attempts, and feedback.",
            ],
          ].map(([Icon, title, copy]) => {
            const FeatureIcon = Icon as typeof FileImage;
            return (
              <div key={title as string} className="rounded-2xl border p-6">
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-[var(--navy)]">
                  <FeatureIcon className="h-5 w-5" />
                </div>
                <h2 className="font-extrabold">{title as string}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {copy as string}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
