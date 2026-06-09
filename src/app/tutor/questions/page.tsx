"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
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

const PAGE_SIZE = 50;

type SortKey = "sourceId" | "section" | "skill" | "difficulty" | "status";

function statusTone(status: Question["status"]) {
  if (status === "published") return "green";
  if (status === "archived") return "rose";
  return "amber";
}

export default function QuestionLibraryPage() {
  const router = useRouter();
  const { state, updateQuestion, deleteQuestion } = useAppState();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("sourceId");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Question | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");

  const tags = useMemo(() => allQuestionTags(state.questions), [state.questions]);
  const filtered = useMemo(
    () =>
      filterQuestions(state.questions, {
        search,
        section,
        difficulty,
        status,
        tag,
      }).sort((a, b) => {
        const left = String(a[sortKey] ?? "").toLowerCase();
        const right = String(b[sortKey] ?? "").toLowerCase();
        return left.localeCompare(right);
      }),
    [state.questions, search, section, difficulty, status, tag, sortKey],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedQuestions = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const selectedUsage = selected ? questionUsage(state, selected.id) : null;
  const selectedSafeCount = selectedIds.filter(
    (questionId) => questionUsage(state, questionId).safeToDelete,
  ).length;

  function resetPaging() {
    setPage(1);
    setBulkMessage("");
  }

  function toggleSelected(questionId: string) {
    setBulkMessage("");
    setSelectedIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId],
    );
  }

  function selectPage() {
    const pageIds = pagedQuestions.map((question) => question.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])],
    );
    setBulkMessage("");
  }

  async function removeSelectedQuestion() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteQuestion(selected.id);
      setDeleteOpen(false);
      setSelected(null);
      setBulkMessage("Deleted 1 unused question.");
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

  async function deleteUnusedSelection() {
    const safeIds = selectedIds.filter(
      (questionId) => questionUsage(state, questionId).safeToDelete,
    );
    let deleted = 0;
    for (const questionId of safeIds) {
      await deleteQuestion(questionId);
      deleted += 1;
    }
    const skipped = selectedIds.length - deleted;
    setSelectedIds([]);
    setBulkMessage(
      `${deleted} unused question${deleted === 1 ? "" : "s"} deleted. ${skipped} used question${skipped === 1 ? "" : "s"} skipped; archive them instead.`,
    );
  }

  function bulkUpdateStatus(nextStatus: Question["status"]) {
    for (const questionId of selectedIds) {
      updateQuestion(questionId, { status: nextStatus });
    }
    setBulkMessage(
      `${selectedIds.length} question${selectedIds.length === 1 ? "" : "s"} marked ${nextStatus}.`,
    );
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
        description="Search, review, and organize questions at table scale. Images load only when you open a question."
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
        <div className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_200px_160px_160px_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPaging();
              }}
              placeholder="Search ID, domain, skill, tags, or text"
              className="pl-10"
            />
          </div>
          <Select
            value={section}
            onChange={(event) => {
              setSection(event.target.value);
              resetPaging();
            }}
          >
            <option value="all">All sections</option>
            <option>Math</option>
            <option>Reading and Writing</option>
          </Select>
          <Select
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value);
              resetPaging();
            }}
          >
            <option value="all">All difficulties</option>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </Select>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetPaging();
            }}
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </Select>
          <Select
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
              resetPaging();
            }}
          >
            <option value="all">All tags</option>
            {tags.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            aria-label="Sort questions"
          >
            <option value="sourceId">Sort by ID</option>
            <option value="section">Sort by section</option>
            <option value="skill">Sort by skill</option>
            <option value="difficulty">Sort by difficulty</option>
            <option value="status">Sort by status</option>
          </Select>
        </div>
      </Card>

      {(selectedIds.length > 0 || bulkMessage) && (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-bold text-slate-600">
              {selectedIds.length
                ? `${selectedIds.length} selected (${selectedSafeCount} unused)`
                : "Bulk action complete"}
            </p>
            {bulkMessage && (
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {bulkMessage}
              </p>
            )}
          </div>
          {selectedIds.length > 0 && (
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
                disabled={selectedSafeCount === 0}
                onClick={() => void deleteUnusedSelection()}
              >
                Delete unused
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
              >
                Clear
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-600">
          {filtered.length} question{filtered.length === 1 ? "" : "s"} · showing{" "}
          {pagedQuestions.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-
          {(currentPage - 1) * PAGE_SIZE + pagedQuestions.length}
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Filter className="h-3.5 w-3.5" /> Archived questions stay out of new
          test building unless you republish them.
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="border-b bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      pagedQuestions.length > 0 &&
                      pagedQuestions.every((question) =>
                        selectedIds.includes(question.id),
                      )
                    }
                    onChange={selectPage}
                    aria-label="Select page"
                    className="h-4 w-4 accent-[var(--navy)]"
                  />
                </th>
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagedQuestions.map((question) => {
                const usage = questionUsage(state, question.id);
                return (
                  <tr key={question.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(question.id)}
                        onChange={() => toggleSelected(question.id)}
                        aria-label={`Select ${question.sourceId}`}
                        className="h-4 w-4 accent-[var(--navy)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setSelected(question)}
                      >
                        <span className="font-black text-[var(--navy)]">
                          {question.sourceId}
                        </span>
                        <span className="mt-1 block max-w-80 truncate text-xs font-semibold text-slate-500">
                          {question.domain}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="blue">{question.section}</Badge>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="truncate text-sm font-bold">
                        {question.skill}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {(question.tags ?? []).join(", ") || "No tags"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{question.difficulty}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-500">
                      {usage.testCount || usage.responseCount ? (
                        <>
                          {usage.testCount} test
                          {usage.testCount === 1 ? "" : "s"} ·{" "}
                          {usage.responseCount} response
                          {usage.responseCount === 1 ? "" : "s"}
                        </>
                      ) : (
                        "Unused"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(question.status)}>
                        {question.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelected(question)}
                        >
                          Preview
                        </Button>
                        {question.status !== "archived" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Archive className="h-4 w-4" />}
                            onClick={() =>
                              updateQuestion(question.id, { status: "archived" })
                            }
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!pagedQuestions.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    No questions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">
          Page {currentPage} of {pageCount}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog.Root
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-50 mx-auto max-h-[92vh] max-w-5xl -translate-y-1/2 overflow-hidden rounded-2xl border bg-white shadow-2xl">
            {selected && (
              <div className="grid max-h-[92vh] md:grid-cols-[1fr_310px]">
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
                    {!selected.promptAssets.length && (
                      <div className="grid min-h-56 place-items-center rounded-xl border bg-white text-slate-400">
                        <BookOpenCheck className="h-8 w-8" />
                      </div>
                    )}
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
                  <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                    {selectedUsage?.safeToDelete ? (
                      "Unused. This question can be permanently deleted."
                    ) : (
                      <>
                        Used in {selectedUsage?.testCount} test
                        {selectedUsage?.testCount === 1 ? "" : "s"} and{" "}
                        {selectedUsage?.responseCount} response
                        {selectedUsage?.responseCount === 1 ? "" : "s"}. Archive
                        it to hide it from new tests. Remove it from tests before
                        deleting it. Remove it from those tests before deleting it.
                      </>
                    )}
                  </div>
                  <div className="mt-5 space-y-4 text-sm">
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
