import { NextResponse } from "next/server";
import { z } from "zod";
import type { TutorSettings } from "@/lib/domain";
import { normalizeTutorSettings } from "@/lib/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  landingHeadline: z.string().min(1).max(180).optional(),
  landingSubheadline: z.string().min(1).max(500).optional(),
  heroEyebrow: z.string().min(1).max(80).optional(),
  heroTitle: z.string().min(1).max(120).optional(),
  heroSubtitle: z.string().min(1).max(180).optional(),
  timezone: z.string().min(1).max(80).optional(),
  defaultDueDays: z.number().int().min(1).max(120).optional(),
  defaultAttemptLimit: z.number().int().min(1).max(20).optional(),
  defaultFeedbackPolicy: z
    .enum(["immediate", "after_submission", "tutor_release"])
    .optional(),
  defaultAllowResume: z.boolean().optional(),
});

function mapRow(row: Record<string, unknown> | null): Partial<TutorSettings> {
  if (!row) return {};
  return {
    displayName: String(row.display_name ?? ""),
    landingHeadline: String(row.landing_headline ?? ""),
    landingSubheadline: String(row.landing_subheadline ?? ""),
    heroEyebrow: String(row.hero_eyebrow ?? ""),
    heroTitle: String(row.hero_title ?? ""),
    heroSubtitle: String(row.hero_subtitle ?? ""),
    timezone: String(row.timezone ?? ""),
    defaultDueDays: Number(row.default_due_days),
    defaultAttemptLimit: Number(row.default_attempt_limit),
    defaultFeedbackPolicy: row.default_feedback_policy as TutorSettings["defaultFeedbackPolicy"],
    defaultAllowResume: Boolean(row.default_allow_resume),
  };
}

async function requireTutor() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unconfigured" as const };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata.role !== "tutor") {
    return { error: "forbidden" as const };
  }
  return { supabase, user };
}

export async function GET() {
  const auth = await requireTutor();
  if (auth.error === "unconfigured") {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  if (auth.error === "forbidden") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data, error } = await auth.supabase
    .from("tutor_settings")
    .select("*")
    .eq("tutor_id", auth.user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    settings: normalizeTutorSettings(mapRow(data)),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireTutor();
  if (auth.error === "unconfigured") {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  if (auth.error === "forbidden") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = settingsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const settings = normalizeTutorSettings(parsed.data);
  const { error } = await auth.supabase.from("tutor_settings").upsert({
    tutor_id: auth.user.id,
    display_name: settings.displayName,
    landing_headline: settings.landingHeadline,
    landing_subheadline: settings.landingSubheadline,
    hero_eyebrow: settings.heroEyebrow,
    hero_title: settings.heroTitle,
    hero_subtitle: settings.heroSubtitle,
    timezone: settings.timezone,
    default_due_days: settings.defaultDueDays,
    default_attempt_limit: settings.defaultAttemptLimit,
    default_feedback_policy: settings.defaultFeedbackPolicy,
    default_allow_resume: settings.defaultAllowResume,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ settings });
}
