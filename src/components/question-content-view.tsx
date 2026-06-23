"use client";

import { QuestionAssetImage } from "@/components/question-asset-image";
import type { Question } from "@/lib/domain";
import {
  CHOICE_LABELS,
  choiceTextForLabel,
  normalizeQuestionContent,
  questionHasTypedContent,
} from "@/lib/question-content";
import { cn } from "@/lib/utils";

export function QuestionContentView({
  question,
  imageAlt,
  showChoices = false,
  className,
}: {
  question: Question;
  imageAlt: string;
  showChoices?: boolean;
  className?: string;
}) {
  const content = normalizeQuestionContent(question.content);
  const hasText = questionHasTypedContent(question);

  return (
    <div className={cn("space-y-4", className)}>
      {hasText && (
        <div className="space-y-4 rounded-xl border bg-white p-5 text-slate-900">
          {content.passage && (
            <div className="whitespace-pre-wrap text-base leading-8">
              {content.passage}
            </div>
          )}
          {content.stem && (
            <p className="whitespace-pre-wrap text-lg font-bold leading-8">
              {content.stem}
            </p>
          )}
          {showChoices && question.responseType === "multiple_choice" && (
            <div className="grid gap-2">
              {CHOICE_LABELS.map((label) => {
                const text = choiceTextForLabel(question, label);
                if (!text) return null;
                return (
                  <div
                    key={label}
                    className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border bg-white text-xs font-black">
                      {label}
                    </span>
                    <span className="whitespace-pre-wrap">{text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {question.promptAssets.length > 0 && (
        <div className="space-y-3">
          {question.promptAssets.map((asset) => (
            <QuestionAssetImage
              key={asset.id}
              asset={asset}
              alt={imageAlt}
              className="rounded-lg border bg-white"
            />
          ))}
        </div>
      )}
    </div>
  );
}
