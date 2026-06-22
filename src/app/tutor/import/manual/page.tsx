"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileImage,
  ImagePlus,
  Upload,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import type { Difficulty, Question, ResponseType, Section } from "@/lib/domain";
import {
  createManualQuestionAsset,
  validateQuestionImage,
} from "@/lib/manual-question";
import { makeAcceptedAnswers } from "@/lib/scoring";
import {
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { persistManualQuestion } from "@/lib/supabase/question-import";
import { sha256 } from "@/lib/utils";

function ImageUploadField({
  id,
  label,
  description,
  file,
  required,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  file: File | null;
  required?: boolean;
  onChange: (file: File | null) => void;
}) {
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file],
  );

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <FieldLabel htmlFor={id}>
            {label} {required && <span className="text-rose-600">*</span>}
          </FieldLabel>
          <p className="-mt-1 text-xs text-slate-500">{description}</p>
        </div>
        {file && (
          <button
            type="button"
            className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50"
            onClick={() => onChange(null)}
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
      <label
        htmlFor={id}
        className="focus-within:ring-3 focus-within:ring-blue-200 block cursor-pointer overflow-hidden rounded-xl border-2 border-dashed bg-slate-50 transition hover:border-slate-400"
      >
        {preview ? (
          // This is a temporary local preview before the asset enters the question library.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={`${label} preview`}
            className="max-h-72 w-full object-contain"
          />
        ) : (
          <div className="grid min-h-36 place-items-center p-5 text-center">
            <div>
              <Upload className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-2 text-sm font-bold text-slate-700">
                Choose an image
              </p>
              <p className="mt-1 text-xs text-slate-400">
                PNG, JPEG, or WebP up to 10 MB
              </p>
            </div>
          </div>
        )}
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <p className="mt-2 truncate text-xs font-semibold text-slate-500">
          {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      )}
    </div>
  );
}

export default function ManualQuestionImportPage() {
  const router = useRouter();
  const { state, addQuestions } = useAppState();
  const [sourceId, setSourceId] = useState("");
  const [section, setSection] = useState<Section>("Math");
  const [domain, setDomain] = useState("");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [responseType, setResponseType] =
    useState<ResponseType>("multiple_choice");
  const [acceptedAnswer, setAcceptedAnswer] = useState("A");
  const [searchableText, setSearchableText] = useState("");
  const [promptFile, setPromptFile] = useState<File | null>(null);
  const [choicesFile, setChoicesFile] = useState<File | null>(null);
  const [rationaleFile, setRationaleFile] = useState<File | null>(null);
  const [saving, setSaving] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState("");
  const normalizedSourceId = sourceId.trim();
  const duplicateSourceId = state.questions.some(
    (question) =>
      question.sourceId.toLowerCase() === normalizedSourceId.toLowerCase(),
  );

  function validateForm() {
    if (!normalizedSourceId || !domain.trim() || !skill.trim()) {
      throw new Error("Question ID, domain, and skill are required.");
    }
    if (duplicateSourceId) {
      throw new Error("A question with this ID already exists.");
    }
    if (!promptFile) {
      throw new Error("Add a question image.");
    }
    validateQuestionImage(promptFile);
    if (rationaleFile) validateQuestionImage(rationaleFile);
    if (choicesFile) validateQuestionImage(choicesFile);
    if (
      responseType === "multiple_choice" &&
      !/^[A-D]$/i.test(acceptedAnswer.trim())
    ) {
      throw new Error("Multiple-choice answers must be A, B, C, or D.");
    }
    if (!makeAcceptedAnswers(acceptedAnswer.split(",")).length) {
      throw new Error("Add at least one accepted answer.");
    }
  }

  async function saveQuestion(status: "draft" | "published") {
    setError("");
    try {
      validateForm();
      setSaving(status);
      const id = crypto.randomUUID();
      const prompt = await createManualQuestionAsset(
        promptFile!,
        "prompt",
        0,
        id,
      );
      const choices = choicesFile
        ? await createManualQuestionAsset(choicesFile, "prompt", 1, id)
        : null;
      const rationale = rationaleFile
        ? await createManualQuestionAsset(rationaleFile, "rationale", 0, id)
        : null;
      const acceptedAnswers = makeAcceptedAnswers(
        responseType === "multiple_choice"
          ? [acceptedAnswer.toUpperCase()]
          : acceptedAnswer.split(","),
      );
      const versionHash = await sha256(
        JSON.stringify({
          sourceId: normalizedSourceId,
          section,
          domain: domain.trim(),
          skill: skill.trim(),
          difficulty,
          responseType,
          answers: acceptedAnswers.map((answer) => answer.normalizedValue),
          files: [
            prompt.fileHash,
            choices?.fileHash ?? "",
            rationale?.fileHash ?? "",
          ],
        }),
      );
      const question: Question = {
        id,
        sourceId: normalizedSourceId,
        versionHash,
        assessment: "SAT",
        section,
        domain: domain.trim(),
        skill: skill.trim(),
        difficulty,
        responseType,
        acceptedAnswers,
        promptAssets: [
          prompt.asset,
          ...(choices ? [choices.asset] : []),
        ],
        rationaleAssets: rationale ? [rationale.asset] : [],
        extractedText: searchableText.trim(),
        sourceFileName: "Manual image import",
        sourceDocumentPath: `manual://${id}`,
        importedAt: new Date().toISOString(),
        status,
      };

      if (isSupabaseConfigured() && !isDemoMode()) {
        await persistManualQuestion(question);
      }
      addQuestions([question]);
      router.push("/tutor/tests");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The manual question could not be saved.",
      );
      setSaving(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Test authoring"
        title="Add a question"
        description="Add the question, answer key, and the details needed to find it while building a test."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-[var(--blue)]">
              <FileImage className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black">Question details</h2>
              <p className="text-sm text-slate-500">
                These fields power search, test building, and scoring.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="manual-source-id">Question ID</FieldLabel>
                <Input
                  id="manual-source-id"
                  value={sourceId}
                  onChange={(event) => setSourceId(event.target.value)}
                  placeholder="e.g. algebra-linear-001"
                  aria-invalid={duplicateSourceId}
                />
                {duplicateSourceId && (
                  <p className="mt-1 text-xs font-semibold text-rose-700">
                    This ID is already in the library.
                  </p>
                )}
              </div>
              <div>
                <FieldLabel htmlFor="manual-section">Section</FieldLabel>
                <Select
                  id="manual-section"
                  value={section}
                  onChange={(event) =>
                    setSection(event.target.value as Section)
                  }
                >
                  <option>Math</option>
                  <option>Reading and Writing</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="manual-domain">Domain</FieldLabel>
                <Input
                  id="manual-domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="e.g. Algebra"
                />
              </div>
              <div>
                <FieldLabel htmlFor="manual-skill">Skill</FieldLabel>
                <Input
                  id="manual-skill"
                  value={skill}
                  onChange={(event) => setSkill(event.target.value)}
                  placeholder="e.g. Linear equations"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FieldLabel htmlFor="manual-difficulty">Difficulty</FieldLabel>
                <Select
                  id="manual-difficulty"
                  value={difficulty}
                  onChange={(event) =>
                    setDifficulty(event.target.value as Difficulty)
                  }
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </Select>
              </div>
              <div>
                <FieldLabel htmlFor="manual-response-type">
                  Response type
                </FieldLabel>
                <Select
                  id="manual-response-type"
                  value={responseType}
                  onChange={(event) => {
                    const next = event.target.value as ResponseType;
                    setResponseType(next);
                    setAcceptedAnswer(next === "multiple_choice" ? "A" : "");
                  }}
                >
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="student_produced">Student produced</option>
                </Select>
              </div>
              <div>
                <FieldLabel htmlFor="manual-answer">
                  {responseType === "multiple_choice"
                    ? "Correct choice"
                    : "Accepted answers"}
                </FieldLabel>
                {responseType === "multiple_choice" ? (
                  <Select
                    id="manual-answer"
                    value={acceptedAnswer}
                    onChange={(event) => setAcceptedAnswer(event.target.value)}
                  >
                    {["A", "B", "C", "D"].map((choice) => (
                      <option key={choice}>{choice}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id="manual-answer"
                    value={acceptedAnswer}
                    onChange={(event) => setAcceptedAnswer(event.target.value)}
                    placeholder="403, 403.0"
                  />
                )}
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="manual-search-text">
                Searchable text or notes
              </FieldLabel>
              <Textarea
                id="manual-search-text"
                rows={3}
                value={searchableText}
                onChange={(event) => setSearchableText(event.target.value)}
                placeholder="Optional text that helps you find this question later"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black">Image assets</h2>
              <p className="mt-1 text-sm text-slate-500">
                Images retain their original resolution.
              </p>
            </div>
            <Badge tone="blue">Private rationale</Badge>
          </div>
          <div className="mt-6 space-y-6">
            <ImageUploadField
              id="manual-prompt-image"
              label="Question image"
              description="Stem, passage, graph, table, or equation."
              file={promptFile}
              required
              onChange={setPromptFile}
            />
            <ImageUploadField
              id="manual-choices-image"
              label="Choices image"
              description="Optional if the answer choices are already in the question image."
              file={choicesFile}
              onChange={setChoicesFile}
            />
            <ImageUploadField
              id="manual-rationale-image"
              label="Rationale image"
              description="Optional explanation image for future use."
              file={rationaleFile}
              onChange={setRationaleFile}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {error ? (
            <div className="flex items-start gap-2 text-sm font-semibold text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <ImagePlus className="h-4 w-4" />
              The question will be available in the test builder immediately.
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Check className="h-4 w-4" />}
            loading={saving === "published"}
            disabled={Boolean(saving)}
            onClick={() => void saveQuestion("published")}
          >
            Save question
          </Button>
        </div>
      </Card>
    </>
  );
}
