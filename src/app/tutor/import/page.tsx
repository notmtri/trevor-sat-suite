"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileUp,
  Image as ImageIcon,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { QuestionAssetImage } from "@/components/question-asset-image";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import type { Question } from "@/lib/domain";
import {
  importQuestionBankPdf,
  type ImportProgress,
} from "@/lib/pdf/question-bank-parser";
import { makeAcceptedAnswers } from "@/lib/scoring";
import {
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { persistQuestionImport } from "@/lib/supabase/question-import";

type Stage = "upload" | "processing" | "review" | "saved";

export default function ImportQuestionsPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { addQuestions } = useAppState();
  const [stage, setStage] = useState<Stage>("upload");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sourcePageCount, setSourcePageCount] = useState(0);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const activeQuestion = questions[activeIndex];

  async function handleFile(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setError("Choose a PDF exported from the SAT Suite Question Bank.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("PDF imports are limited to 50 MB.");
      return;
    }
    setError("");
    setStage("processing");
    try {
      const result = await importQuestionBankPdf(file, setProgress);
      if (!result.questions.length) {
        throw new Error("No Question ID markers were found in this PDF.");
      }
      setQuestions(result.questions);
      setSourceFile(file);
      setSourcePageCount(result.pages.length);
      setActiveIndex(0);
      setStage("review");
    } catch (importError) {
      const message =
        importError instanceof Error
          ? importError.message
          : typeof importError === "object" &&
              importError !== null &&
              "message" in importError
            ? String(importError.message)
            : String(importError);
      setError(
        message && message !== "[object Object]"
          ? message
          : "The PDF could not be imported.",
      );
      setStage("upload");
    }
  }

  function updateActive(changes: Partial<Question>) {
    setQuestions((current) =>
      current.map((question, index) =>
        index === activeIndex ? { ...question, ...changes } : question,
      ),
    );
  }

  async function saveImport() {
    const reviewed = questions.map((question) => ({
      ...question,
      status: "published" as const,
      reviewNotes: "",
    }));
    setSaving(true);
    setError("");
    try {
      if (sourceFile && isSupabaseConfigured() && !isDemoMode()) {
        await persistQuestionImport(sourceFile, reviewed);
      }
      addQuestions(reviewed);
      setStage("saved");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The reviewed import could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Question library"
        title="Import Question Bank PDF"
        description="Prompts, equations, graphs, choices, and rationales are rendered directly from the PDF as lossless 3× images."
      />

      {stage === "upload" && (
        <div className="mx-auto max-w-4xl">
          <Card className="p-6 sm:p-10">
            <button
              type="button"
              className={`focus-ring flex min-h-[360px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                dragging
                  ? "border-[var(--blue)] bg-blue-50/60"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/70"
              }`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void handleFile(event.dataTransfer.files[0]);
              }}
            >
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-[var(--navy)] shadow-sm">
                <FileUp className="h-7 w-7" />
              </div>
              <h2 className="mt-6 text-xl font-black">Drop an export here</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
                Supported format: Question Bank exports containing Question ID,
                Correct Answer, and Rationale markers.
              </p>
              <span className="mt-6 rounded-xl bg-[var(--navy)] px-5 py-3 text-sm font-bold text-white">
                Choose PDF
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </button>
            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                {error}
              </div>
            )}
          </Card>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              [
                ShieldCheck,
                "Private source",
                "The original PDF and answer keys are never exposed to students.",
              ],
              [
                ImageIcon,
                "Exact rendering",
                "No OCR reconstruction means mathematical formatting stays intact.",
              ],
              [
                FileCheck2,
                "Required review",
                "Every crop and answer is checked before it can be published.",
              ],
            ].map(([Icon, title, copy]) => {
              const ItemIcon = Icon as typeof ShieldCheck;
              return (
                <div key={title as string} className="rounded-2xl border bg-white p-5">
                  <ItemIcon className="h-5 w-5 text-[var(--green)]" />
                  <p className="mt-3 text-sm font-extrabold">{title as string}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {copy as string}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stage === "processing" && (
        <Card className="mx-auto max-w-2xl p-10 text-center">
          <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-[var(--blue)]" />
          <h2 className="mt-5 text-xl font-black">Preparing exact question images</h2>
          <p className="mt-2 text-sm text-slate-500">{progress?.message}</p>
          <div className="mx-auto mt-6 h-2 max-w-md overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[var(--blue)] transition-all"
              style={{
                width: `${progress?.total ? Math.max(8, (progress.current / progress.total) * 100) : 8}%`,
              }}
            />
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-400">
            Rendering at 3× resolution. Large exports may take a moment.
          </p>
        </Card>
      )}

      {stage === "review" && activeQuestion && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <Badge tone="blue">
                  Question {activeIndex + 1} of {questions.length}
                </Badge>
                <span className="text-sm font-bold text-slate-500">
                  ID {activeQuestion.sourceId}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={activeIndex === 0}
                  icon={<ChevronLeft className="h-4 w-4" />}
                  onClick={() => setActiveIndex((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={activeIndex === questions.length - 1}
                  onClick={() => setActiveIndex((value) => value + 1)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="scrollbar-thin max-h-[calc(100vh-220px)] overflow-y-auto bg-slate-100 p-4 sm:p-7">
              <div className="space-y-4">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Student-visible prompt
                </p>
                {activeQuestion.promptAssets.map((asset) => (
                  <div key={asset.id} className="rounded-xl border bg-white p-3">
                    <QuestionAssetImage
                      asset={asset}
                      alt={`Prompt for question ${activeQuestion.sourceId}`}
                    />
                    <p className="mt-2 text-right text-[11px] font-semibold text-slate-400">
                      Source page {asset.sourcePage} · {asset.width}×{asset.height}px
                    </p>
                  </div>
                ))}
                <p className="pt-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Released rationale
                </p>
                {activeQuestion.rationaleAssets.map((asset) => (
                  <div key={asset.id} className="rounded-xl border bg-white p-3">
                    <QuestionAssetImage
                      asset={asset}
                      alt={`Rationale for question ${activeQuestion.sourceId}`}
                    />
                    <p className="mt-2 text-right text-[11px] font-semibold text-slate-400">
                      Source page {asset.sourcePage}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold">Review details</h2>
                {activeQuestion.reviewNotes ? (
                  <Badge tone="amber">Check required</Badge>
                ) : (
                  <Badge tone="green">Markers found</Badge>
                )}
              </div>
              {activeQuestion.reviewNotes && (
                <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                  {activeQuestion.reviewNotes}
                </div>
              )}
              <div className="mt-5 grid gap-4">
                <div>
                  <FieldLabel>Section</FieldLabel>
                  <Select
                    value={activeQuestion.section}
                    onChange={(event) =>
                      updateActive({
                        section: event.target.value as Question["section"],
                      })
                    }
                  >
                    <option>Math</option>
                    <option>Reading and Writing</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Domain</FieldLabel>
                  <Input
                    value={activeQuestion.domain}
                    onChange={(event) =>
                      updateActive({ domain: event.target.value })
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Skill</FieldLabel>
                  <Input
                    value={activeQuestion.skill}
                    onChange={(event) =>
                      updateActive({ skill: event.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Difficulty</FieldLabel>
                    <Select
                      value={activeQuestion.difficulty}
                      onChange={(event) =>
                        updateActive({
                          difficulty: event.target
                            .value as Question["difficulty"],
                        })
                      }
                    >
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>Response type</FieldLabel>
                    <Select
                      value={activeQuestion.responseType}
                      onChange={(event) =>
                        updateActive({
                          responseType: event.target
                            .value as Question["responseType"],
                        })
                      }
                    >
                      <option value="multiple_choice">A–D</option>
                      <option value="student_produced">SPR</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <FieldLabel>
                    Accepted answer
                    {activeQuestion.responseType === "student_produced"
                      ? "s (comma separated)"
                      : ""}
                  </FieldLabel>
                  <Input
                    value={activeQuestion.acceptedAnswers
                      .map((answer) => answer.value)
                      .join(", ")}
                    onChange={(event) =>
                      updateActive({
                        acceptedAnswers: makeAcceptedAnswers(
                          event.target.value.split(","),
                        ),
                      })
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Review notes</FieldLabel>
                  <Textarea
                    rows={3}
                    placeholder="Optional note for this version"
                    value={activeQuestion.reviewNotes ?? ""}
                    onChange={(event) =>
                      updateActive({ reviewNotes: event.target.value })
                    }
                  />
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-500">Source</span>
                <span className="font-bold">{activeQuestion.sourceFileName}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-500">PDF pages</span>
                <span className="font-bold">{sourcePageCount}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-500">Questions</span>
                <span className="font-bold">{questions.length}</span>
              </div>
              {error && (
                <div className="mt-5 rounded-xl bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-700">
                  {error}
                </div>
              )}
              <Button
                className="mt-5 w-full"
                icon={<Check className="h-4 w-4" />}
                loading={saving}
                onClick={() => void saveImport()}
              >
                Approve and publish all
              </Button>
              <Button
                className="mt-2 w-full"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => {
                  setStage("upload");
                  setQuestions([]);
                }}
              >
                Start over
              </Button>
            </Card>
          </div>
        </div>
      )}

      {stage === "saved" && (
        <Card className="mx-auto max-w-xl p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            <Check className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-2xl font-black">
            {questions.length} questions published
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The exact prompt and rationale images are now available in your
            private question library.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => setStage("upload")}>
              Import another
            </Button>
            <Button onClick={() => router.push("/tutor/questions")}>
              Open library
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
