import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  ids: z.array(z.string().uuid()).min(1).max(100).optional(),
  status: z.enum(["draft", "published", "rejected", "archived"]).optional(),
  section: z.enum(["Math", "Reading and Writing"]).optional(),
  domain: z.string().min(1).max(160).optional(),
  skill: z.string().min(1).max(160).optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
}).refine((value) => Boolean(value.id) !== Boolean(value.ids), {
  message: "Provide either id or ids.",
});

const deleteQuestionSchema = z.object({
  id: z.string().uuid(),
});

export async function PATCH(request: Request) {
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
  const parsed = updateQuestionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid question update.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id, ids, ...changes } = parsed.data;
  if (
    changes.status === undefined &&
    changes.section === undefined &&
    changes.domain === undefined &&
    changes.skill === undefined &&
    changes.difficulty === undefined &&
    changes.tags === undefined
  ) {
    return NextResponse.json(
      { error: "No question changes were provided." },
      { status: 400 },
    );
  }
  const databaseChanges = {
    ...(changes.status ? { status: changes.status } : {}),
    ...(changes.section ? { section: changes.section } : {}),
    ...(changes.domain ? { domain: changes.domain } : {}),
    ...(changes.skill ? { skill: changes.skill } : {}),
    ...(changes.difficulty ? { difficulty: changes.difficulty } : {}),
    ...(changes.tags ? { tags: changes.tags } : {}),
  };
  let query = supabase
    .from("questions")
    .update(databaseChanges)
    .eq("owner_id", user.id)
    .select("id");
  query = id ? query.eq("id", id) : query.in("id", ids ?? []);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) {
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
  const parsed = deleteQuestionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid question deletion request." },
      { status: 400 },
    );
  }

  const { data: question, error: questionError } = await admin
    .from("questions")
    .select("id")
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (questionError) {
    return NextResponse.json({ error: questionError.message }, { status: 500 });
  }
  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  const [placementsResult, responsesResult, versionsResult] = await Promise.all([
    admin
      .from("module_questions")
      .select("module_id", { count: "exact", head: true })
      .eq("question_id", question.id),
    admin
      .from("responses")
      .select("attempt_id", { count: "exact", head: true })
      .eq("question_id", question.id),
    admin
      .from("question_versions")
      .select("id,source_document_id")
      .eq("question_id", question.id),
  ]);
  const lookupError =
    placementsResult.error ?? responsesResult.error ?? versionsResult.error;
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if ((responsesResult.count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This question has student responses and cannot be deleted without damaging result history.",
      },
      { status: 409 },
    );
  }
  if ((placementsResult.count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Remove this question from every test before deleting it.",
      },
      { status: 409 },
    );
  }

  const versionIds = (versionsResult.data ?? []).map((version) => version.id);
  const sourceDocumentIds = [
    ...new Set(
      (versionsResult.data ?? [])
        .map((version) => version.source_document_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: assets, error: assetsError } = versionIds.length
    ? await admin
        .from("question_assets")
        .select("storage_path")
        .in("question_version_id", versionIds)
    : { data: [], error: null };
  if (assetsError) {
    return NextResponse.json({ error: assetsError.message }, { status: 500 });
  }

  const { error: deleteError } = await admin
    .from("questions")
    .delete()
    .eq("id", question.id)
    .eq("owner_id", user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const assetPaths = (assets ?? []).map((asset) => asset.storage_path);
  if (assetPaths.length) {
    await admin.storage.from("question-assets").remove(assetPaths);
  }

  for (const sourceDocumentId of sourceDocumentIds) {
    const { count } = await admin
      .from("question_versions")
      .select("id", { count: "exact", head: true })
      .eq("source_document_id", sourceDocumentId);
    if ((count ?? 0) > 0) continue;

    const { data: sourceDocument } = await admin
      .from("source_documents")
      .select("storage_path")
      .eq("id", sourceDocumentId)
      .eq("owner_id", user.id)
      .maybeSingle();
    await admin
      .from("source_documents")
      .delete()
      .eq("id", sourceDocumentId)
      .eq("owner_id", user.id);
    if (
      sourceDocument?.storage_path &&
      !sourceDocument.storage_path.startsWith("manual://")
    ) {
      await admin.storage
        .from("source-pdfs")
        .remove([sourceDocument.storage_path]);
    }
  }

  return NextResponse.json({ ok: true });
}
