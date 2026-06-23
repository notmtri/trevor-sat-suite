"use client";

import type { Question } from "@/lib/domain";
import { loadLocalAsset } from "@/lib/local-assets";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sha256 } from "@/lib/utils";

export async function persistQuestionImport(
  sourceFile: File,
  questions: Question[],
) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error("Tutor session expired.");

  const sourceHash = await sha256(await sourceFile.arrayBuffer());
  const sourcePath = `${user.id}/${sourceHash}.pdf`;
  const { error: uploadSourceError } = await supabase.storage
    .from("source-pdfs")
    .upload(sourcePath, sourceFile, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadSourceError) throw uploadSourceError;

  const { data: sourceDocument, error: sourceError } = await supabase
    .from("source_documents")
    .upsert(
      {
        owner_id: user.id,
        file_name: sourceFile.name,
        storage_path: sourcePath,
        sha256: sourceHash,
        page_count: Math.max(
          ...questions.flatMap((question) =>
            [...question.promptAssets, ...question.rationaleAssets].map(
              (asset) => asset.sourcePage,
            ),
          ),
        ),
      },
      { onConflict: "owner_id,sha256" },
    )
    .select("id")
    .single();
  if (sourceError) throw sourceError;

  for (const question of questions) {
    const { data: questionRow, error: questionError } = await supabase
      .from("questions")
      .upsert(
        {
          owner_id: user.id,
          source_id: question.sourceId,
          assessment: question.assessment,
          section: question.section,
          domain: question.domain,
          skill: question.skill,
          difficulty: question.difficulty,
          status: question.status,
          tags: question.tags ?? [],
        },
        { onConflict: "owner_id,source_id" },
      )
      .select("id")
      .single();
    if (questionError) throw questionError;

    const { data: existingVersion, error: existingVersionError } = await supabase
      .from("question_versions")
      .select("id")
      .eq("question_id", questionRow.id)
      .eq("version_hash", question.versionHash)
      .maybeSingle();
    if (existingVersionError) throw existingVersionError;

    let versionId = existingVersion?.id as string | undefined;
    if (!versionId) {
      const { data: version, error: versionError } = await supabase
        .from("question_versions")
        .insert({
          question_id: questionRow.id,
          source_document_id: sourceDocument.id,
          version_hash: question.versionHash,
          response_type: question.responseType,
          content: question.content ?? {},
          extracted_text: question.extractedText,
          review_notes: question.reviewNotes ?? "",
        })
        .select("id")
        .single();
      if (versionError) throw versionError;
      versionId = version.id;

      for (const asset of [
        ...question.promptAssets,
        ...question.rationaleAssets,
      ]) {
        if (!asset.storagePath) continue;
        const blob = await loadLocalAsset(asset.storagePath);
        if (!blob) throw new Error(`Missing rendered asset ${asset.id}.`);
        const storagePath = `${user.id}/${questionRow.id}/${versionId}/${asset.kind}-${asset.order}.png`;
        const { error: assetUploadError } = await supabase.storage
          .from("question-assets")
          .upload(storagePath, blob, {
            contentType: "image/png",
            upsert: true,
          });
        if (assetUploadError) throw assetUploadError;
        const { error: assetRowError } = await supabase
          .from("question_assets")
          .insert({
            question_version_id: versionId,
            kind: asset.kind,
            asset_order: asset.order,
            source_page: asset.sourcePage,
            storage_path: storagePath,
            width: asset.width,
            height: asset.height,
          });
        if (assetRowError) throw assetRowError;
      }

      const { error: answersError } = await supabase
        .from("accepted_answers")
        .insert(
          question.acceptedAnswers.map((answer) => ({
            question_version_id: versionId,
            value: answer.value,
            normalized_value: answer.normalizedValue,
          })),
        );
      if (answersError) throw answersError;
    }

    const { error: currentVersionError } = await supabase
      .from("questions")
      .update({
        current_version_id: versionId,
        status: question.status,
        tags: question.tags ?? [],
      })
      .eq("id", questionRow.id);
    if (currentVersionError) throw currentVersionError;
  }
}

function assetExtension(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "png";
}

export async function persistManualQuestion(question: Question) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error("Tutor session expired.");

  const sourcePath = `manual://${question.id}`;
  const { data: sourceDocument, error: sourceError } = await supabase
    .from("source_documents")
    .upsert(
      {
        owner_id: user.id,
        file_name: question.sourceFileName,
        storage_path: sourcePath,
        sha256: question.versionHash,
        page_count: 1,
      },
      { onConflict: "owner_id,sha256" },
    )
    .select("id")
    .single();
  if (sourceError) throw sourceError;

  const { data: questionRow, error: questionError } = await supabase
    .from("questions")
    .insert({
      id: question.id,
      owner_id: user.id,
      source_id: question.sourceId,
      assessment: question.assessment,
      section: question.section,
      domain: question.domain,
      skill: question.skill,
      difficulty: question.difficulty,
      status: question.status,
      tags: question.tags ?? [],
    })
    .select("id")
    .single();
  if (questionError) throw questionError;

  const { data: existingVersion, error: existingVersionError } = await supabase
    .from("question_versions")
    .select("id")
    .eq("question_id", questionRow.id)
    .eq("version_hash", question.versionHash)
    .maybeSingle();
  if (existingVersionError) throw existingVersionError;

  let versionId = existingVersion?.id as string | undefined;
  if (!versionId) {
    const { data: version, error: versionError } = await supabase
      .from("question_versions")
      .insert({
        question_id: questionRow.id,
        source_document_id: sourceDocument.id,
        version_hash: question.versionHash,
        response_type: question.responseType,
        content: question.content ?? {},
        extracted_text: question.extractedText,
        review_notes: question.reviewNotes ?? "",
      })
      .select("id")
      .single();
    if (versionError) throw versionError;
    versionId = version.id;

    for (const asset of [
      ...question.promptAssets,
      ...question.rationaleAssets,
    ]) {
      if (!asset.storagePath) continue;
      const blob = await loadLocalAsset(asset.storagePath);
      if (!blob) throw new Error(`Missing manual asset ${asset.id}.`);
      const extension = assetExtension(blob.type);
      const storagePath = `${user.id}/${questionRow.id}/${versionId}/${asset.kind}-${asset.order}.${extension}`;
      const { error: assetUploadError } = await supabase.storage
        .from("question-assets")
        .upload(storagePath, blob, {
          contentType: blob.type || "image/png",
          upsert: true,
        });
      if (assetUploadError) throw assetUploadError;
      const { error: assetRowError } = await supabase
        .from("question_assets")
        .insert({
          id: asset.id,
          question_version_id: versionId,
          kind: asset.kind,
          asset_order: asset.order,
          source_page: asset.sourcePage,
          storage_path: storagePath,
          width: asset.width,
          height: asset.height,
        });
      if (assetRowError) throw assetRowError;
    }

    const { error: answersError } = await supabase
      .from("accepted_answers")
      .insert(
        question.acceptedAnswers.map((answer) => ({
          question_version_id: versionId,
          value: answer.value,
          normalized_value: answer.normalizedValue,
        })),
      );
    if (answersError) throw answersError;
  }

  const { error: currentVersionError } = await supabase
    .from("questions")
    .update({
      current_version_id: versionId,
      status: question.status,
      tags: question.tags ?? [],
    })
    .eq("id", questionRow.id)
    .eq("owner_id", user.id);
  if (currentVersionError) throw currentVersionError;
}
