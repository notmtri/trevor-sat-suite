"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  CheckCircle2,
  Filter,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { QuestionAssetImage } from "@/components/question-asset-image";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import type { Question } from "@/lib/domain";

export default function QuestionLibraryPage() {
  const router = useRouter();
  const { state, updateQuestion } = useAppState();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [selected, setSelected] = useState<Question | null>(null);

  const filtered = useMemo(
    () =>
      state.questions.filter((question) => {
        const haystack =
          `${question.sourceId} ${question.domain} ${question.skill} ${question.extractedText}`.toLowerCase();
        return (
          haystack.includes(search.toLowerCase()) &&
          (section === "all" || question.section === section) &&
          (difficulty === "all" || question.difficulty === difficulty)
        );
      }),
    [state.questions, search, section, difficulty],
  );

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Question library"
        description="Search, review, and organize the exact-image questions available for tests and practice."
        actions={
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
        }
      />

      <Card className="mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_220px_170px]">
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
        </div>
      </Card>

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
            className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
          >
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
                    {question.responseType === "multiple_choice" ? "A–D" : "SPR"}
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
                  <dl className="mt-6 space-y-4 text-sm">
                    {[
                      ["Section", selected.section],
                      ["Domain", selected.domain],
                      ["Skill", selected.skill],
                      ["Difficulty", selected.difficulty],
                      [
                        "Answer",
                        selected.acceptedAnswers
                          .map((answer) => answer.value)
                          .join(", "),
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          {label}
                        </dt>
                        <dd className="mt-1 font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-auto space-y-2 pt-8">
                    {selected.status !== "published" && (
                      <Button
                        className="w-full"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        onClick={() => {
                          updateQuestion(selected.id, { status: "published" });
                          setSelected({ ...selected, status: "published" });
                        }}
                      >
                        Publish question
                      </Button>
                    )}
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
    </>
  );
}
