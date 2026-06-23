import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateQuestionSchema = z
  .object({
    id: z.string().uuid().optional(),
    ids: z.array(z.string().uuid()).min(1).max(100).optional(),
    status: z.enum(["draft", "published", "rejected", "archived"]).optional(),
    section: z.enum(["Math", "Reading and Writing"]).optional(),
    domain: z.string().min(1).max(160).optional(),
    skill: z.string().min(1).max(160).optional(),
    difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
    content: z
      .object({
        passage: z.string().max(20_000).optional(),
        stem: z.string().max(20_000).optional(),
        choices: z
          .array(
            z.object({
              label: z.enum(["A", "B", "C", "D"]),
              text: z.string().max(5_000),
            }),
          )
          .max(4)
          .optional(),
      })
      .optional(),
    acceptedAnswers: z
      .array(
        z.object({
          value: z.string().min(1).max(80),
          normalizedValue: z.string().min(1).max(80),
        }),
      )
      .min(1)
      .max(20)
      .optional(),
  })
  .refine((value) => Boolean(value.id) !== Boolean(value.ids), {
    message: "Provide either id or ids.",
  })
  .refine((value) => value.acceptedAnswers === undefined || Boolean(value.id), {
    message: "Answer keys can be updated for one question at a time.",
  })
  .refine((value) => value.content === undefined || Boolean(value.id), {
    message: "Question content can be updated for one question at a time.",
  });

const deleteQuestionSchema = z.object({
  id: z.string().uuid(),
});

const duplicateQuestionSchema = z.object({
  duplicateId: z.string().uuid(),
  id: z.string().uuid(),
  sourceId: z.string().min(1).max(160),
  versionHash: z.string().min(1).max(300),
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
  const parsed = duplicateQuestionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid question duplication request." },
      { status: 400 },
    );
  }

  const { data: sourceQuestion, error: questionError } = await supabase
    .from("questions")
    .select("*")
    .eq("id", parsed.data.duplicateId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (questionError) {
    return NextResponse.json({ error: questionError.message }, { status: 500 });
  }
  if (!sourceQuestion?.current_version_id) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  const { data: existingSourceId, error: sourceIdError } = await supabase
    .from("questions")
    .select("id")
    .eq("owner_id", user.id)
    .eq("source_id", parsed.data.sourceId)
    .maybeSingle();
  if (sourceIdError) {
    return NextResponse.json({ error: sourceIdError.message }, { status: 500 });
  }
  if (existingSourceId) {
    return NextResponse.json(
      { error: "A question with this ID already exists." },
      { status: 409 },
    );
  }

  const { data: sourceVersion, error: versionError } = await supabase
    .from("question_versions")
    .select("*")
    .eq("id", sourceQuestion.current_version_id)
    .single();
  if (versionError) {
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }

  const [assetsResult, answersResult] = await Promise.all([
    supabase
      .from("question_assets")
      .select("*")
      .eq("question_version_id", sourceVersion.id),
    supabase
      .from("accepted_answers")
      .select("*")
      .eq("question_version_id", sourceVersion.id),
  ]);
  const lookupError = assetsResult.error ?? answersResult.error;
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  const { error: insertQuestionError } = await supabase.from("questions").insert({
    id: parsed.data.id,
    owner_id: user.id,
    source_id: parsed.data.sourceId,
    assessment: sourceQuestion.assessment,
    section: sourceQuestion.section,
    domain: sourceQuestion.domain,
    skill: sourceQuestion.skill,
    difficulty: sourceQuestion.difficulty,
    status: "published",
    tags: Array.isArray(sourceQuestion.tags) ? sourceQuestion.tags : [],
  });
  if (insertQuestionError) {
    return NextResponse.json(
      { error: insertQuestionError.message },
      { status: 500 },
    );
  }

  const { data: version, error: insertVersionError } = await supabase
    .from("question_versions")
    .insert({
      question_id: parsed.data.id,
      source_document_id: sourceVersion.source_document_id,
      version_hash: parsed.data.versionHash,
      response_type: sourceVersion.response_type,
      content: sourceVersion.content ?? {},
      extracted_text: sourceVersion.extracted_text ?? "",
      review_notes: sourceVersion.review_notes ?? "",
    })
    .select("id")
    .single();
  if (insertVersionError) {
    return NextResponse.json(
      { error: insertVersionError.message },
      { status: 500 },
    );
  }

  const assetRows = (assetsResult.data ?? []).map((asset) => ({
    question_version_id: version.id,
    kind: asset.kind,
    asset_order: asset.asset_order,
    source_page: asset.source_page,
    storage_path: asset.storage_path,
    width: asset.width,
    height: asset.height,
  }));
  if (assetRows.length) {
    const { error } = await supabase.from("question_assets").insert(assetRows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const answerRows = (answersResult.data ?? []).map((answer) => ({
    question_version_id: version.id,
    value: answer.value,
    normalized_value: answer.normalized_value,
  }));
  if (answerRows.length) {
    const { error } = await supabase.from("accepted_answers").insert(answerRows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { error: currentVersionError } = await supabase
    .from("questions")
    .update({ current_version_id: version.id })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id);
  if (currentVersionError) {
    return NextResponse.json(
      { error: currentVersionError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

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
  const { id, ids, acceptedAnswers, content, ...changes } = parsed.data;
  if (
    changes.status === undefined &&
    changes.section === undefined &&
    changes.domain === undefined &&
    changes.skill === undefined &&
    changes.difficulty === undefined &&
    changes.tags === undefined &&
    content === undefined &&
    acceptedAnswers === undefined
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
  if (Object.keys(databaseChanges).length) {
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
  }
  if (acceptedAnswers && id) {
    const { error } = await supabase.rpc("update_question_answers", {
      target_question_id: id,
      answer_values: acceptedAnswers.map((answer) => ({
        value: answer.value,
        normalized_value: answer.normalizedValue,
      })),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
  }
  if (content !== undefined && id) {
    const { error } = await supabase.rpc("update_question_content", {
      target_question_id: id,
      content_value: content,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
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
