"use client";

import type { QuestionAsset } from "@/lib/domain";
import { loadLocalAsset } from "@/lib/local-assets";

const sourceCache = new Map<string, Promise<string>>();
const preloadCache = new Map<string, Promise<HTMLImageElement>>();

function assetKey(asset: QuestionAsset) {
  return asset.storagePath ?? asset.dataUrl ?? asset.id;
}

export async function resolveQuestionAssetSource(asset: QuestionAsset) {
  const key = assetKey(asset);
  const cached = sourceCache.get(key);
  if (cached) return cached;

  const sourcePromise = (async () => {
    if (asset.dataUrl) return asset.dataUrl;
    if (asset.storagePath?.startsWith("idb://")) {
      const blob = await loadLocalAsset(asset.storagePath);
      if (!blob) throw new Error("The saved question image is unavailable.");
      return URL.createObjectURL(blob);
    }
    throw new Error("The question image has no source.");
  })();

  sourceCache.set(key, sourcePromise);
  sourcePromise.catch(() => sourceCache.delete(key));
  return sourcePromise;
}

async function preloadQuestionAsset(asset: QuestionAsset) {
  const key = assetKey(asset);
  const cached = preloadCache.get(key);
  if (cached) return cached;

  const preloadPromise = (async () => {
    if (typeof Image === "undefined") {
      throw new Error("Image preloading is only available in the browser.");
    }
    const source = await resolveQuestionAssetSource(asset);
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "high";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error(`Question image ${asset.id} could not be loaded.`));
      image.src = source;
    });

    await image.decode().catch(() => undefined);
    return image;
  })();

  preloadCache.set(key, preloadPromise);
  preloadPromise.catch(() => preloadCache.delete(key));
  return preloadPromise;
}

export async function preloadQuestionAssets(
  assets: QuestionAsset[],
  onProgress?: (loaded: number, total: number) => void,
) {
  const uniqueAssets = Array.from(
    new Map(assets.map((asset) => [assetKey(asset), asset])).values(),
  );
  const total = uniqueAssets.length;
  let loaded = 0;
  let cursor = 0;
  const failures: Error[] = [];

  onProgress?.(loaded, total);
  if (!total) return;

  const worker = async () => {
    while (cursor < total) {
      const asset = uniqueAssets[cursor];
      cursor += 1;
      try {
        await preloadQuestionAsset(asset);
      } catch (error) {
        failures.push(
          error instanceof Error ? error : new Error("Image preload failed."),
        );
      } finally {
        loaded += 1;
        onProgress?.(loaded, total);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(4, total) }, () => worker()),
  );

  if (failures.length) {
    throw new Error(
      `${failures.length} question image${failures.length === 1 ? "" : "s"} could not be prepared.`,
    );
  }
}
