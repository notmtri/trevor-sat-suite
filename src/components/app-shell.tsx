"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  ChevronLeft,
  FileUp,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAppState } from "@/components/providers/app-state-provider";
import {
  createSupabaseBrowserClient,
  isDemoMode,
} from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const tutorLinks = [
  { href: "/tutor", label: "Overview", icon: LayoutDashboard },
  { href: "/tutor/import", label: "Import questions", icon: FileUp },
  { href: "/tutor/questions", label: "Question library", icon: BookOpenCheck },
  { href: "/tutor/students", label: "Students", icon: Users },
  { href: "/tutor/tests", label: "Tests & assignments", icon: GraduationCap },
  { href: "/tutor/monitor", label: "Live monitor", icon: Activity },
  { href: "/tutor/analytics", label: "Analytics", icon: BarChart3 },
];

const studentLinks = [
  { href: "/student", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/results", label: "My results", icon: BarChart3 },
];

export function AppShell({
  role,
  children,
}: {
  role: "tutor" | "student";
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, loadError, refresh } = useAppState();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = role === "tutor" ? tutorLinks : studentLinks;
  const student = state.students[0];
  const displayName =
    role === "tutor" ? "Trevor" : student?.displayName || "Student";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    if (!isDemoMode()) {
      await createSupabaseBrowserClient()?.auth.signOut();
    }
    router.replace(isDemoMode() ? "/" : "/login");
    router.refresh();
  }

  const nav = (
    <>
      <div className="flex h-20 items-center gap-3 border-b px-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--navy)] text-sm font-black text-white">
          TS
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-[var(--navy-dark)]">
              Trevor&apos;s SAT Suite
            </p>
            <p className="text-xs text-[var(--muted)]">
              {role === "tutor" ? "Tutor workspace" : "Student workspace"}
            </p>
          </div>
        )}
      </div>
      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== `/${role}` && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "focus-ring flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
                active
                  ? "bg-[var(--navy)] text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-[var(--ink)]",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t p-3">
        <button
          className={cn(
            "focus-ring flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100",
            collapsed && "justify-center px-0",
          )}
          type="button"
        >
          <Settings className="h-5 w-5" />
          {!collapsed && "Settings"}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(
            "focus-ring flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r bg-white transition-all lg:flex lg:flex-col",
          collapsed ? "w-20" : "w-64",
        )}
      >
        {nav}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-3 top-24 grid h-7 w-7 place-items-center rounded-full border bg-white text-slate-500 shadow-sm"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/35"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 flex-col bg-white shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <div
        className={cn(
          "transition-all",
          collapsed ? "lg:pl-20" : "lg:pl-64",
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            {role === "student" && pathname.startsWith("/student/test/") && (
              <Link
                href="/student"
                className="mr-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-500"
              >
                <ChevronLeft className="h-4 w-4" /> Leave test
              </Link>
            )}
            <div className="text-right">
              <p className="text-sm font-bold">
                {displayName}
              </p>
              <p className="text-xs text-slate-500">
                {role === "tutor" ? "Tutor" : "Student"}
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--mint)] font-bold text-[var(--green)]">
              {initials || (role === "tutor" ? "T" : "S")}
            </div>
          </div>
        </header>
        {loadError && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 lg:px-8">
            <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
              <span>{loadError}</span>
              <button
                type="button"
                className="shrink-0 font-black underline"
                onClick={() => void refresh()}
              >
                Retry
              </button>
            </div>
          </div>
        )}
        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
