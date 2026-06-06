import { NextResponse } from "next/server";
import { z } from "zod";
import { studentUsernameToEmail } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createStudentSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9._-]+$/),
  displayName: z.string().min(2).max(80),
  temporaryPassword: z.string().min(10).max(128),
  timeMultiplier: z.union([z.literal(1), z.literal(1.5), z.literal(2)]),
});

const updateStudentSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["active", "disabled"]).optional(),
    timeMultiplier: z.union([z.literal(1), z.literal(1.5), z.literal(2)]).optional(),
    temporaryPassword: z.string().min(10).max(128).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.timeMultiplier !== undefined ||
      value.temporaryPassword !== undefined,
    { message: "No changes were provided." },
  );

async function requireTutor() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return { error: "unconfigured" as const };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata.role !== "tutor") {
    return { error: "forbidden" as const };
  }
  return { supabase, admin, user };
}

export async function POST(request: Request) {
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
  const { admin, user } = auth;

  const parsed = createStudentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid student data.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { username, displayName, temporaryPassword, timeMultiplier } =
    parsed.data;
  const { count, error: countError } = await admin
    .from("students")
    .select("user_id", { count: "exact", head: true })
    .eq("tutor_id", user.id);
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if ((count ?? 0) >= 50) {
    return NextResponse.json(
      { error: "The initial release supports up to 50 students." },
      { status: 409 },
    );
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: studentUsernameToEmail(username),
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { role: "student" },
    user_metadata: {
      username,
      display_name: displayName,
      tutor_id: user.id,
      must_change_password: true,
    },
  });
  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Student creation failed." },
      { status: 400 },
    );
  }

  const { error: studentError } = await admin.from("students").insert({
    user_id: data.user.id,
    tutor_id: user.id,
    status: "active",
    time_multiplier: timeMultiplier,
  });
  if (studentError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json(
      { error: studentError.message },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      id: data.user.id,
      username,
      displayName,
      timeMultiplier,
    },
    { status: 201 },
  );
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
  const { admin, user } = auth;
  const parsed = updateStudentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid student update.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: student, error: studentLookupError } = await admin
    .from("students")
    .select("user_id")
    .eq("user_id", parsed.data.id)
    .eq("tutor_id", user.id)
    .maybeSingle();
  if (studentLookupError) {
    return NextResponse.json(
      { error: studentLookupError.message },
      { status: 500 },
    );
  }
  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const studentChanges: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    studentChanges.status = parsed.data.status;
  }
  if (parsed.data.timeMultiplier !== undefined) {
    studentChanges.time_multiplier = parsed.data.timeMultiplier;
  }
  if (Object.keys(studentChanges).length) {
    const { error } = await admin
      .from("students")
      .update(studentChanges)
      .eq("user_id", parsed.data.id)
      .eq("tutor_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const authChanges: {
    password?: string;
    ban_duration?: string;
    user_metadata?: Record<string, unknown>;
  } = {};
  if (parsed.data.status !== undefined) {
    authChanges.ban_duration =
      parsed.data.status === "disabled" ? "876000h" : "none";
  }
  if (parsed.data.temporaryPassword) {
    const { data: existingUser, error: existingUserError } =
      await admin.auth.admin.getUserById(parsed.data.id);
    if (existingUserError) {
      return NextResponse.json(
        { error: existingUserError.message },
        { status: 500 },
      );
    }
    authChanges.password = parsed.data.temporaryPassword;
    authChanges.user_metadata = {
      ...existingUser.user.user_metadata,
      must_change_password: true,
    };
    const { error: profileError } = await admin
      .from("profiles")
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }
  if (Object.keys(authChanges).length) {
    const { error } = await admin.auth.admin.updateUserById(
      parsed.data.id,
      authChanges,
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
