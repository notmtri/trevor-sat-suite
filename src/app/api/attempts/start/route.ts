import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireStudentSession,
  sessionErrorResponse,
} from "@/lib/supabase/attempt-server";

const startSchema = z.object({
  assignmentId: z.string().uuid(),
  moduleId: z.string().uuid(),
  attemptId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const session = await requireStudentSession();
  if (session.error) {
    const error = sessionErrorResponse(session.error);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid launch request." }, { status: 400 });
  }
  const { admin, user } = session;
  const now = new Date();
  const { data: assignment, error: assignmentError } = await admin
    .from("assignments")
    .select("id,test_id,available_at,due_at,attempt_limit,allow_resume,status")
    .eq("id", parsed.data.assignmentId)
    .maybeSingle();
  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }
  if (
    !assignment ||
    assignment.status !== "open" ||
    now < new Date(assignment.available_at) ||
    now > new Date(assignment.due_at)
  ) {
    return NextResponse.json(
      { error: "This assignment is not currently available." },
      { status: 409 },
    );
  }
  const { data: recipient, error: recipientError } = await admin
    .from("assignment_students")
    .select("time_multiplier")
    .eq("assignment_id", assignment.id)
    .eq("student_id", user.id)
    .maybeSingle();
  if (recipientError) {
    return NextResponse.json({ error: recipientError.message }, { status: 500 });
  }
  if (!recipient) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }
  const { data: testModule, error: moduleError } = await admin
    .from("test_modules")
    .select("id,duration_minutes,test_id")
    .eq("id", parsed.data.moduleId)
    .eq("test_id", assignment.test_id)
    .maybeSingle();
  if (moduleError) {
    return NextResponse.json({ error: moduleError.message }, { status: 500 });
  }
  if (!testModule) {
    return NextResponse.json({ error: "Test module not found." }, { status: 404 });
  }

  let attempt = null;
  if (parsed.data.attemptId) {
    const result = await admin
      .from("attempts")
      .select("*")
      .eq("id", parsed.data.attemptId)
      .eq("assignment_id", assignment.id)
      .eq("student_id", user.id)
      .maybeSingle();
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    attempt = result.data;
  }
  if (!attempt) {
    const result = await admin
      .from("attempts")
      .select("*")
      .eq("assignment_id", assignment.id)
      .eq("student_id", user.id)
      .in("status", ["not_started", "in_progress"])
      .maybeSingle();
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    attempt = result.data;
  }

  if (attempt?.status === "in_progress" && attempt.server_deadline) {
    const existingDeadline = new Date(attempt.server_deadline);
    if (
      attempt.current_module_id === testModule.id &&
      existingDeadline > now &&
      assignment.allow_resume
    ) {
      return NextResponse.json({
        attemptId: attempt.id,
        deadline: existingDeadline.toISOString(),
        serverNow: now.toISOString(),
      });
    }
    if (attempt.current_module_id === testModule.id && existingDeadline <= now) {
      await admin
        .from("attempts")
        .update({
          status: "expired",
          submitted_at: now.toISOString(),
          connection_status: "stale",
        })
        .eq("id", attempt.id);
      return NextResponse.json(
        { error: "This timed module has expired." },
        { status: 409 },
      );
    }
  }

  if (!attempt || !["not_started", "in_progress"].includes(attempt.status)) {
    const { count, error: countError } = await admin
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", assignment.id)
      .eq("student_id", user.id);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    if ((count ?? 0) >= assignment.attempt_limit) {
      return NextResponse.json(
        { error: "No attempts remain for this assignment." },
        { status: 409 },
      );
    }
  }

  const durationMs =
    testModule.duration_minutes * 60_000 * Number(recipient.time_multiplier);
  const deadline = new Date(now.getTime() + durationMs);
  if (deadline > new Date(assignment.due_at)) {
    deadline.setTime(new Date(assignment.due_at).getTime());
  }

  if (attempt) {
    const { data, error } = await admin
      .from("attempts")
      .update({
        status: "in_progress",
        current_module_id: testModule.id,
        current_question_index: 0,
        server_deadline: deadline.toISOString(),
        connection_status: "online",
        started_at: attempt.started_at ?? now.toISOString(),
        last_heartbeat_at: now.toISOString(),
      })
      .eq("id", attempt.id)
      .eq("student_id", user.id)
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    attempt = data;
  } else {
    const { data, error } = await admin
      .from("attempts")
      .insert({
        assignment_id: assignment.id,
        student_id: user.id,
        status: "in_progress",
        current_module_id: testModule.id,
        server_deadline: deadline.toISOString(),
        connection_status: "online",
        started_at: now.toISOString(),
        last_heartbeat_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    attempt = data;
  }

  await admin
    .from("students")
    .update({ last_active_at: now.toISOString() })
    .eq("user_id", user.id);

  return NextResponse.json({
    attemptId: attempt.id,
    deadline: deadline.toISOString(),
    serverNow: now.toISOString(),
  });
}
