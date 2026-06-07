"use client";

import type { QuestionAsset } from "@/lib/domain";
import { saveLocalAsset } from "@/lib/local-assets";
import { sha256 } from "@/lib/utils";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validateQuestionImage(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Question images must be PNG, JPEG, or WebP files.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name} is larger than the 10 MB image limit.`);
  }
}

async function imageDimensions(file: File) {
  validateQuestionImage(file);
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`${file.name} is not a valid image.`));
      image.src = source;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function createManualQuestionAsset(
  file: File,
  kind: QuestionAsset["kind"],
  order: number,
  questionId: string,
) {
  const { width, height } = await imageDimensions(file);
  const fileHash = await sha256(await file.arrayBuffer());
  const id = crypto.randomUUID();
  const storagePath = await saveLocalAsset(
    `manual-${questionId}-${kind}-${order}-${fileHash}`,
    file,
    file.type,
  );

  return {
    asset: {
      id,
      kind,
      order,
      sourcePage: 1,
      storagePath,
      width,
      height,
    } satisfies QuestionAsset,
    fileHash,
  };
}
