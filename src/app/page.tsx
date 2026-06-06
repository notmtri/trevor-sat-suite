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
            href={demo ? "/student" : "/login"}
            className="focus-ring rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            {demo ? "Student demo" : "Student sign in"}
          </Link>
          <Link
            href={demo ? "/tutor" : "/login"}
            className="focus-ring rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--navy-dark)]"
          >
            {demo ? "Tutor demo" : "Tutor sign in"}
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden border-y bg-[var(--wash)]">
        <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-blue-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-28">
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
                href={demo ? "/tutor" : "/login"}
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

          <div className="card-shadow rounded-[2rem] border bg-white p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between border-b pb-4">
              <div>
                <p className="text-sm font-bold text-slate-500">Live session</p>
                <p className="text-xl font-black">Algebra Checkpoint</p>
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                In progress
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["14:02", "Time remaining"],
                ["2 of 3", "Current question"],
                ["Online", "Connection"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xl font-black text-[var(--navy)]">
                    {value}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border p-5">
              <div className="mb-5 flex items-center justify-between">
                <p className="font-bold">Question progress</p>
                <span className="text-sm text-slate-500">Minh Nguyen</span>
              </div>
              <div className="flex gap-2">
                <span className="h-3 flex-1 rounded-full bg-[var(--green)]" />
                <span className="h-3 flex-1 rounded-full bg-[var(--blue)]" />
                <span className="h-3 flex-1 rounded-full bg-slate-200" />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Answers remain private during the session. The tutor sees
                timing, progress, and connection health only.
              </p>
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
