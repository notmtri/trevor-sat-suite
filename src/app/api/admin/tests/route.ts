import { NextResponse } from "next/server";
import { z } from "zod";
import { duplicatedQuestionIds } from "@/lib/work-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const workTypeSchema = z.enum([
  "custom",
  "full_length",
  "verbal_simulation",
  "math_simulation",
  "verbal_practice",
  "math_practice",
]);

const testSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  description: z.string().max(1000),
  mode: z.enum(["practice", "exam"]),
  workType: workTypeSchema.default("custom"),
  status: z.enum(["draft", "published"]),
  routingThreshold: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
  modules: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(160),
      section: z.enum(["Math", "Reading and Writing"]),
      durationMinutes: z.number().int().min(1).max(240),
      route: z.enum(["common", "easier", "harder"]),
      order: z.number().int().min(1),
      questions: z.array(
        z.object({
          questionId: z.string().uuid(),
          order: z.number().int().min(1),
          unscored: z.boolean().optional(),
        }),
      ),
    }),
  ),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata.role !== "tutor") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const parsed = testSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid test definition.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const test = parsed.data;
  if (duplicatedQuestionIds(test).length) {
    return NextResponse.json(
      { error: "Each question can appear only once in a test." },
      { status: 400 },
    );
  }
  const questionIds = [
    ...new Set(
      test.modules.flatMap((module) =>
        module.questions.map((question) => question.questionId),
      ),
    ),
  ];
  if (questionIds.length) {
    const { data: ownedQuestions, error } = await supabase
      .from("questions")
      .select("id,status")
      .eq("owner_id", user.id)
      .in("id", questionIds);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if ((ownedQuestions ?? []).length !== questionIds.length) {
      return NextResponse.json(
        { error: "One or more questions are unavailable." },
        { status: 400 },
      );
    }
    if ((ownedQuestions ?? []).some((question) => question.status !== "published")) {
      return NextResponse.json(
        { error: "Only published questions can be added to tests." },
        { status: 400 },
      );
    }
  }

  const { error: testError } = await supabase.from("tests").upsert({
    id: test.id,
    owner_id: user.id,
    title: test.title,
    description: test.description,
    mode: test.mode,
    work_type: test.workType,
    status: test.status,
    routing_threshold: test.routingThreshold,
    created_at: test.createdAt,
    updated_at: new Date().toISOString(),
  });
  if (testError) {
    return NextResponse.json({ error: testError.message }, { status: 500 });
  }

  const moduleIds = test.modules.map((testModule) => testModule.id);
  const staleModulesQuery = supabase
    .from("test_modules")
    .delete()
    .eq("test_id", test.id);
  const { error: staleModulesError } = moduleIds.length
    ? await staleModulesQuery.not("id", "in", `(${moduleIds.join(",")})`)
    : await staleModulesQuery;
  if (staleModulesError) {
    return NextResponse.json(
      { error: staleModulesError.message },
      { status: 500 },
    );
  }

  for (const testModule of test.modules) {
    const { error: moduleError } = await supabase.from("test_modules").upsert({
      id: testModule.id,
      test_id: test.id,
      title: testModule.title,
      section: testModule.section,
      duration_minutes: testModule.durationMinutes,
      route: testModule.route,
      module_order: testModule.order,
    });
    if (moduleError) {
      return NextResponse.json({ error: moduleError.message }, { status: 500 });
    }
    const { error: deleteError } = await supabase
      .from("module_questions")
      .delete()
      .eq("module_id", testModule.id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    if (testModule.questions.length) {
      const { error: questionError } = await supabase
        .from("module_questions")
        .insert(
          testModule.questions.map((question) => ({
            module_id: testModule.id,
            question_id: question.questionId,
            question_order: question.order,
            unscored: question.unscored ?? false,
          })),
        );
      if (questionError) {
        return NextResponse.json(
          { error: questionError.message },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
