"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { QuestionAsset } from "@/lib/domain";
import { resolveQuestionAssetSource } from "@/lib/question-assets";
import { cn } from "@/lib/utils";

export function QuestionAssetImage({
  asset,
  alt,
  className,
}: {
  asset: QuestionAsset;
  alt: string;
  className?: string;
}) {
  const [source, setSource] = useState(asset.dataUrl ?? "");
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    resolveQuestionAssetSource(asset)
      .then((resolvedSource) => {
        if (active) setSource(resolvedSource);
      })
      .catch(() => {
        if (active) setStatus("failed");
      });

    return () => {
      active = false;
    };
  }, [asset]);

  if (status === "failed") {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed bg-slate-50 text-sm font-semibold text-slate-400">
        <ImageOff className="mr-2 h-5 w-5" />
        Image unavailable
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
    >
      {status === "loading" && (
        <div
          role="status"
          aria-label="Loading question image"
          className="absolute inset-0 animate-pulse bg-slate-100"
        />
      )}
      {source && (
        // Imported PDF crops need their native dimensions and cannot use a fixed Next Image loader.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={alt}
          draggable={false}
          decoding="async"
          fetchPriority="high"
          loading="eager"
          className={cn(
            "question-image h-auto w-full",
            status === "loading" && "invisible",
            className,
          )}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
        />
      )}
    </div>
  );
}
