"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileImage,
  ImagePlus,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import type {
  ChoiceLabel,
  Difficulty,
  Question,
  QuestionContent,
  ResponseType,
  Section,
  TestModule,
} from "@/lib/domain";
import {
  createManualQuestionAsset,
  validateQuestionImage,
} from "@/lib/manual-question";
import {
  CHOICE_LABELS,
  compactQuestionContent,
  normalizeQuestionContent,
  validateQuestionContent,
} from "@/lib/question-content";
import { makeAcceptedAnswers } from "@/lib/scoring";
import {
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { persistManualQuestion } from "@/lib/supabase/question-import";
import { sha256 } from "@/lib/utils";

type ReturnTarget = {
  testId: string;
  moduleId: string;
};

function sortModuleQuestions(module: TestModule) {
  return [...module.questions].sort((a, b) => a.order - b.order);
}

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
          // Local preview before the asset enters the question library.
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
          {file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      )}
    </div>
  );
}

export default function ManualQuestionImportPage() {
  const router = useRouter();
  const { state, addQuestions, updateTest } = useAppState();
  const [returnTarget, setReturnTarget] = useState<ReturnTarget | null>(null);
  const [targetSectionApplied, setTargetSectionApplied] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [section, setSection] = useState<Section>("Reading and Writing");
  const [domain, setDomain] = useState("");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [responseType, setResponseType] =
    useState<ResponseType>("multiple_choice");
  const [acceptedAnswer, setAcceptedAnswer] = useState("A");
  const [passage, setPassage] = useState("");
  const [stem, setStem] = useState("");
  const [choiceTexts, setChoiceTexts] = useState<Record<ChoiceLabel, string>>({
    A: "",
    B: "",
    C: "",
    D: "",
  });
  const [searchableText, setSearchableText] = useState("");
  const [promptFile, setPromptFile] = useState<File | null>(null);
  const [choicesFile, setChoicesFile] = useState<File | null>(null);
  const [rationaleFile, setRationaleFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const normalizedSourceId = sourceId.trim();
  const duplicateSourceId = state.questions.some(
    (question) =>
      question.sourceId.toLowerCase() === normalizedSourceId.toLowerCase(),
  );
  const targetTest = state.tests.find((test) => test.id === returnTarget?.testId);
  const targetModule = targetTest?.modules.find(
    (module) => module.id === returnTarget?.moduleId,
  );
  const targetLocked = state.assignments.some(
    (assignment) => assignment.testId === targetTest?.id,
  );
  const isVerbal = section === "Reading and Writing";
  const verbalContent = compactQuestionContent({
    passage,
    stem,
    choices: CHOICE_LABELS.map((label) => ({
      label,
      text: choiceTexts[label],
    })),
  });
  const previewContent = normalizeQuestionContent(verbalContent);

  useEffect(() => {
    const url = new URL(window.location.href);
    const testId = url.searchParams.get("testId");
    const moduleId = url.searchParams.get("moduleId");
    if (testId && moduleId) setReturnTarget({ testId, moduleId });
  }, []);

  useEffect(() => {
    if (!targetModule || targetSectionApplied) return;
    setSection(targetModule.section);
    setTargetSectionApplied(true);
  }, [targetModule, targetSectionApplied]);

  useEffect(() => {
    if (!isVerbal) return;
    setResponseType("multiple_choice");
    setAcceptedAnswer((current) =>
      /^[A-D]$/i.test(current.trim()) ? current.toUpperCase() : "A",
    );
  }, [isVerbal]);

  function updateChoice(label: ChoiceLabel, text: string) {
    setChoiceTexts((current) => ({ ...current, [label]: text }));
  }

  function buildContent(): QuestionContent {
    return isVerbal ? verbalContent : {};
  }

  function validateForm() {
    if (!normalizedSourceId || !domain.trim() || !skill.trim()) {
      throw new Error("Question ID, domain, and skill are required.");
    }
    if (duplicateSourceId) {
      throw new Error("A question with this ID already exists.");
    }
    if (isVerbal) {
      const contentErrors = validateQuestionContent({
        section,
        responseType,
        content: verbalContent,
      });
      if (contentErrors.length) throw new Error(contentErrors[0]);
      if (promptFile) validateQuestionImage(promptFile);
    } else if (!promptFile) {
      throw new Error("Add a math question image.");
    } else {
      validateQuestionImage(promptFile);
    }
    if (rationaleFile) validateQuestionImage(rationaleFile);
    if (!isVerbal && choicesFile) validateQuestionImage(choicesFile);
    if (
      responseType === "multiple_choice" &&
      !/^[A-D]$/i.test(acceptedAnswer.trim())
    ) {
      throw new Error("Multiple-choice answers must be A, B, C, or D.");
    }
    if (!makeAcceptedAnswers(answerValues()).length) {
      throw new Error("Add at least one accepted answer.");
    }
  }

  function answerValues() {
    return responseType === "multiple_choice"
      ? [acceptedAnswer.toUpperCase()]
      : acceptedAnswer.split(",");
  }

  function attachToTargetModule(questionId: string) {
    if (!targetTest || !targetModule || targetLocked) return;
    if (targetModule.section !== section) return;
    if (
      targetTest.modules.some((module) =>
        module.questions.some((question) => question.questionId === questionId),
      )
    ) {
      return;
    }
    updateTest(targetTest.id, {
      modules: targetTest.modules.map((module) =>
        module.id === targetModule.id
          ? {
              ...module,
              questions: [
                ...sortModuleQuestions(module),
                { questionId, order: module.questions.length + 1 },
              ],
            }
          : module,
      ),
    });
  }

  async function saveQuestion() {
    setError("");
    try {
      validateForm();
      setSaving(true);
      const id = crypto.randomUUID();
      const prompt = promptFile
        ? await createManualQuestionAsset(promptFile, "prompt", 0, id)
        : null;
      const choices =
        !isVerbal && choicesFile
          ? await createManualQuestionAsset(choicesFile, "prompt", 1, id)
          : null;
      const rationale = rationaleFile
        ? await createManualQuestionAsset(rationaleFile, "rationale", 0, id)
        : null;
      const acceptedAnswers = makeAcceptedAnswers(answerValues());
      const content = buildContent();
      const extractedText = [
        searchableText.trim(),
        content.passage,
        content.stem,
        ...(content.choices?.map((choice) => choice.text) ?? []),
      ]
        .filter(Boolean)
        .join("\n\n");
      const versionHash = await sha256(
        JSON.stringify({
          sourceId: normalizedSourceId,
          section,
          domain: domain.trim(),
          skill: skill.trim(),
          difficulty,
          responseType,
          answers: acceptedAnswers.map((answer) => answer.normalizedValue),
          content,
          files: [
            prompt?.fileHash ?? "",
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
        content,
        promptAssets: [
          ...(prompt ? [prompt.asset] : []),
          ...(choices ? [choices.asset] : []),
        ],
        rationaleAssets: rationale ? [rationale.asset] : [],
        extractedText,
        sourceFileName: isVerbal
          ? "Manual typed question"
          : "Manual image import",
        sourceDocumentPath: `manual://${id}`,
        importedAt: new Date().toISOString(),
        status: "published",
      };

      if (isSupabaseConfigured() && !isDemoMode()) {
        await persistManualQuestion(question);
      }
      addQuestions([question]);
      attachToTargetModule(question.id);
      router.push("/tutor/tests");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The manual question could not be saved.",
      );
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Test authoring"
        title="Add a question"
        description="Create a typed verbal question or import a math question as images."
      />

      {targetModule && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-black">
              Creating for {targetModule.title}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Saved questions return to the test builder
              {targetLocked ? "; this assigned test is locked" : " and are added to this module"}.
            </p>
          </div>
          <Badge tone={targetLocked ? "amber" : "blue"}>
            {targetModule.section}
          </Badge>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
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
                  placeholder="e.g. words-context-001"
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
                  disabled={Boolean(targetModule)}
                  onChange={(event) =>
                    setSection(event.target.value as Section)
                  }
                >
                  <option>Reading and Writing</option>
                  <option>Math</option>
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
                  placeholder={isVerbal ? "e.g. Craft and Structure" : "e.g. Algebra"}
                />
              </div>
              <div>
                <FieldLabel htmlFor="manual-skill">Skill</FieldLabel>
                <Input
                  id="manual-skill"
                  value={skill}
                  onChange={(event) => setSkill(event.target.value)}
                  placeholder={isVerbal ? "e.g. Words in context" : "e.g. Linear equations"}
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
                  disabled={isVerbal}
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
                    {CHOICE_LABELS.map((choice) => (
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

            {isVerbal ? (
              <div className="space-y-4 rounded-xl border bg-slate-50 p-4">
                <div>
                  <FieldLabel htmlFor="manual-passage">
                    Passage or context
                  </FieldLabel>
                  <Textarea
                    id="manual-passage"
                    rows={5}
                    value={passage}
                    onChange={(event) => setPassage(event.target.value)}
                    placeholder="Optional passage, note, poem excerpt, or context."
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="manual-stem">
                    Question stem <span className="text-rose-600">*</span>
                  </FieldLabel>
                  <Textarea
                    id="manual-stem"
                    rows={3}
                    value={stem}
                    onChange={(event) => setStem(event.target.value)}
                    placeholder="Type the question students should answer."
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CHOICE_LABELS.map((choice) => (
                    <div key={choice}>
                      <FieldLabel htmlFor={`manual-choice-${choice}`}>
                        Choice {choice} <span className="text-rose-600">*</span>
                      </FieldLabel>
                      <Textarea
                        id={`manual-choice-${choice}`}
                        rows={3}
                        value={choiceTexts[choice]}
                        onChange={(event) =>
                          updateChoice(choice, event.target.value)
                        }
                        placeholder={`Answer choice ${choice}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Math content is imported as images. Use the image panel for the
                problem, graph, equations, and answer choices.
              </div>
            )}

            <div>
              <FieldLabel htmlFor="manual-search-text">
                Searchable notes
              </FieldLabel>
              <Textarea
                id="manual-search-text"
                rows={3}
                value={searchableText}
                onChange={(event) => setSearchableText(event.target.value)}
                placeholder="Optional notes that help you find this question later"
              />
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black">Image assets</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Images retain their original resolution.
                </p>
              </div>
              <Badge tone="blue">{isVerbal ? "Optional" : "Required"}</Badge>
            </div>
            <div className="mt-6 space-y-6">
              <ImageUploadField
                id="manual-prompt-image"
                label={isVerbal ? "Graph or table image" : "Question image"}
                description={
                  isVerbal
                    ? "Optional support image for graph/table verbal questions."
                    : "Problem statement, graph, table, equation, or combined prompt."
                }
                file={promptFile}
                required={!isVerbal}
                onChange={setPromptFile}
              />
              {!isVerbal && (
                <ImageUploadField
                  id="manual-choices-image"
                  label="Choices image"
                  description="Optional if answer choices are already in the question image."
                  file={choicesFile}
                  onChange={setChoicesFile}
                />
              )}
              <ImageUploadField
                id="manual-rationale-image"
                label="Rationale image"
                description="Optional explanation image for future use."
                file={rationaleFile}
                onChange={setRationaleFile}
              />
            </div>
          </Card>

          {isVerbal && (
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-[var(--blue)]" />
                <h2 className="font-black">Live preview</h2>
              </div>
              <div className="mt-4 space-y-4 rounded-xl border bg-white p-4">
                {previewContent.passage && (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {previewContent.passage}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-base font-bold leading-7">
                  {previewContent.stem || "Question stem will appear here."}
                </p>
                <div className="grid gap-2">
                  {CHOICE_LABELS.map((choice) => (
                    <div
                      key={choice}
                      className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border bg-white text-xs font-black">
                        {choice}
                      </span>
                      <span className="whitespace-pre-wrap">
                        {choiceTexts[choice] || `Choice ${choice}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
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
              <Plus className="h-4 w-4" />
              The question will be available in the test builder immediately.
            </div>
          )}
        </div>
        <Button
          icon={<Check className="h-4 w-4" />}
          loading={saving}
          disabled={saving}
          onClick={() => void saveQuestion()}
        >
          Save question
        </Button>
      </Card>
    </>
  );
}
