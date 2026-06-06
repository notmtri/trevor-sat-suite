"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { QuestionAsset } from "@/lib/domain";
import { loadLocalAsset } from "@/lib/local-assets";
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    let active = true;
    if (!asset.storagePath?.startsWith("idb://")) return;

    loadLocalAsset(asset.storagePath)
      .then((blob) => {
        if (!active || !blob) {
          if (active) setFailed(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => setFailed(true));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.storagePath]);

  if (!source || failed) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed bg-slate-50 text-sm font-semibold text-slate-400">
        <ImageOff className="mr-2 h-5 w-5" />
        Image unavailable
      </div>
    );
  }

  return (
    // Imported PDF crops need their native dimensions and cannot use a fixed Next Image loader.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source}
      alt={alt}
      draggable={false}
      className={cn("question-image h-auto w-full", className)}
      onError={() => setFailed(true)}
    />
  );
}
