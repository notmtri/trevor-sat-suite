"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  Archive,
  CheckCircle2,
  Filter,
  ImagePlus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { QuestionAssetImage } from "@/components/question-asset-image";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import type { Question } from "@/lib/domain";
import {
  allQuestionTags,
  filterQuestions,
  questionUsage,
} from "@/lib/question-library";

export default function QuestionLibraryPage() {
  const router = useRouter();
  const { state, updateQuestion, deleteQuestion } = useAppState();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Question | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const tags = useMemo(() => allQuestionTags(state.questions), [state.questions]);
  const filtered = useMemo(
    () =>
      filterQuestions(state.questions, {
        search,
        section,
        difficulty,
        status,
        tag,
      }),
    [state.questions, search, section, difficulty, status, tag],
  );
  const selectedUsage = selected ? questionUsage(state, selected.id) : null;

  async function removeSelectedQuestion() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteQuestion(selected.id);
      setDeleteOpen(false);
      setSelected(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "The question could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelected(questionId: string) {
    setSelectedIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId],
    );
  }

  async function deleteSelectedQuestions() {
    const safeIds = selectedIds.filter(
      (questionId) => questionUsage(state, questionId).safeToDelete,
    );
    for (const questionId of safeIds) {
      await deleteQuestion(questionId);
    }
    setSelectedIds([]);
  }

  function bulkUpdateStatus(nextStatus: Question["status"]) {
    for (const questionId of selectedIds) {
      updateQuestion(questionId, { status: nextStatus });
    }
    setSelectedIds([]);
  }

  function updateSelectedQuestion(changes: Partial<Question>) {
    if (!selected) return;
    updateQuestion(selected.id, changes);
    setSelected({ ...selected, ...changes });
  }

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Question library"
        description="Search, review, and organize the exact-image questions available for tests and practice."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<ImagePlus className="h-4 w-4" />}
              onClick={() => router.push("/tutor/import/manual")}
            >
              Add manually
            </Button>
            <Button
              variant="secondary"
              icon={<SlidersHorizontal className="h-4 w-4" />}
              disabled={!state.questions.some(
                (question) => question.status === "published",
              )}
              onClick={() => router.push("/tutor/tests?build=1")}
            >
              Build test from library
            </Button>
          </div>
        }
      />

      <Card className="mb-5 p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_200px_160px_160px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID, domain, skill, or extracted text"
              className="pl-10"
            />
          </div>
          <Select
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            <option value="all">All sections</option>
            <option>Math</option>
            <option>Reading and Writing</option>
          </Select>
          <Select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            <option value="all">All difficulties</option>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </Select>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </Select>
          <Select value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="all">All tags</option>
            {tags.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </div>
      </Card>

      {selectedIds.length > 0 && (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm font-bold text-slate-600">
            {selectedIds.length} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkUpdateStatus("published")}
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Archive className="h-4 w-4" />}
              onClick={() => bulkUpdateStatus("archived")}
            >
              Archive
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => void deleteSelectedQuestions()}
            >
              Delete safe
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-600">
          {filtered.length} question{filtered.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Filter className="h-3.5 w-3.5" /> Drafts are excluded from student tests
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((question) => (
          <Card
            key={question.id}
            className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <label className="absolute right-3 top-3 z-10 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold shadow-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(question.id)}
                onChange={() => toggleSelected(question.id)}
                className="mr-1.5 h-3.5 w-3.5 accent-[var(--navy)]"
                aria-label={`Select ${question.sourceId}`}
              />
              Select
            </label>
            <button
              type="button"
              className="block w-full text-left"
              onClick={() => setSelected(question)}
            >
              <div className="h-52 overflow-hidden bg-slate-100 p-4">
                {question.promptAssets[0] ? (
                  <QuestionAssetImage
                    asset={question.promptAssets[0]}
                    alt={`Question ${question.sourceId}`}
                    className="rounded-lg border bg-white"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-slate-400">
                    <BookOpenCheck className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-[var(--navy)]">
                    {question.sourceId}
                  </span>
                  <Badge
                    tone={question.status === "published" ? "green" : "amber"}
                  >
                    {question.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm font-extrabold">{question.skill}</p>
                <p className="mt-1 text-xs text-slate-500">{question.domain}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="blue">{question.section}</Badge>
                  <Badge>{question.difficulty}</Badge>
                  <Badge>
                    {question.responseType === "multiple_choice" ? "A-D" : "SPR"}
                  </Badge>
                </div>
              </div>
            </button>
          </Card>
        ))}
      </div>

      <Dialog.Root
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-50 mx-auto max-h-[92vh] max-w-5xl -translate-y-1/2 overflow-hidden rounded-2xl border bg-white shadow-2xl">
            {selected && (
              <div className="grid max-h-[92vh] md:grid-cols-[1fr_290px]">
                <div className="scrollbar-thin overflow-y-auto bg-slate-100 p-5">
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Student prompt
                  </p>
                  <div className="space-y-3">
                    {selected.promptAssets.map((asset) => (
                      <div key={asset.id} className="rounded-xl border bg-white p-3">
                        <QuestionAssetImage
                          asset={asset}
                          alt={`Question ${selected.sourceId}`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mb-3 mt-7 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Rationale
                  </p>
                  <div className="space-y-3">
                    {selected.rationaleAssets.map((asset) => (
                      <div key={asset.id} className="rounded-xl border bg-white p-3">
                        <QuestionAssetImage
                          asset={asset}
                          alt={`Rationale ${selected.sourceId}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col border-l p-5">
                  <Dialog.Title className="text-xl font-black">
                    {selected.sourceId}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-slate-500">
                    {selected.sourceFileName}
                  </Dialog.Description>
                  <div className="mt-6 space-y-4 text-sm">
                    <div>
                      <FieldLabel htmlFor="selected-section">Section</FieldLabel>
                      <Select
                        id="selected-section"
                        value={selected.section}
                        onChange={(event) =>
                          updateSelectedQuestion({
                            section: event.target.value as Question["section"],
                          })
                        }
                      >
                        <option>Math</option>
                        <option>Reading and Writing</option>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="selected-domain">Domain</FieldLabel>
                      <Input
                        id="selected-domain"
                        value={selected.domain}
                        onChange={(event) =>
                          updateSelectedQuestion({ domain: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="selected-skill">Skill</FieldLabel>
                      <Input
                        id="selected-skill"
                        value={selected.skill}
                        onChange={(event) =>
                          updateSelectedQuestion({ skill: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="selected-difficulty">
                        Difficulty
                      </FieldLabel>
                      <Select
                        id="selected-difficulty"
                        value={selected.difficulty}
                        onChange={(event) =>
                          updateSelectedQuestion({
                            difficulty:
                              event.target.value as Question["difficulty"],
                          })
                        }
                      >
                        <option>Easy</option>
                        <option>Medium</option>
                        <option>Hard</option>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="selected-tags">
                        Tags, comma separated
                      </FieldLabel>
                      <Input
                        id="selected-tags"
                        value={(selected.tags ?? []).join(", ")}
                        onChange={(event) =>
                          updateSelectedQuestion({
                            tags: event.target.value
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="algebra, week-1"
                      />
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Answer
                      </p>
                      <p className="mt-1 font-semibold">
                        {selected.acceptedAnswers
                          .map((answer) => answer.value)
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto space-y-2 pt-8">
                    {selected.status !== "published" && (
                      <Button
                        className="w-full"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        onClick={() => {
                          updateSelectedQuestion({ status: "published" });
                        }}
                      >
                        Publish question
                      </Button>
                    )}
                    {selected.status !== "archived" && (
                      <Button
                        variant="secondary"
                        className="w-full"
                        icon={<Archive className="h-4 w-4" />}
                        onClick={() =>
                          updateSelectedQuestion({ status: "archived" })
                        }
                      >
                        Archive question
                      </Button>
                    )}
                    {(selectedUsage?.testCount ?? 0) > 0 && (
                      <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                        Used in {selectedUsage?.testCount} test
                        {selectedUsage?.testCount === 1 ? "" : "s"}. Remove it
                        from those tests before deleting it.
                      </p>
                    )}
                    <Button
                      variant="danger"
                      className="w-full"
                      icon={<Trash2 className="h-4 w-4" />}
                      disabled={!selectedUsage?.safeToDelete}
                      onClick={() => {
                        setDeleteError("");
                        setDeleteOpen(true);
                      }}
                    >
                      Delete question
                    </Button>
                    <Dialog.Close asChild>
                      <Button variant="secondary" className="w-full">
                        Close
                      </Button>
                    </Dialog.Close>
                  </div>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-2xl">
            <Dialog.Title className="text-xl font-black">
              Delete {selected?.sourceId}?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">
              This permanently removes the question, its answer key, prompt
              images, and rationale images. This cannot be undone.
            </Dialog.Description>
            {deleteError && (
              <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="secondary">Cancel</Button>
              </Dialog.Close>
              <Button
                variant="danger"
                icon={<Trash2 className="h-4 w-4" />}
                loading={deleting}
                onClick={() => void removeSelectedQuestion()}
              >
                Delete permanently
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
