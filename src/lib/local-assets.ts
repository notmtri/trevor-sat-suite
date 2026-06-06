"use client";

import { get, set } from "idb-keyval";

const PREFIX = "trevors-sat-asset:";

type StoredAsset = {
  bytes: ArrayBuffer;
  type: string;
};

export async function saveLocalAsset(
  key: string,
  value: Blob | ArrayBuffer,
  type = "application/octet-stream",
) {
  const storageKey = `${PREFIX}${key}`;
  try {
    const asset: StoredAsset =
      value instanceof Blob
        ? { bytes: await value.arrayBuffer(), type: value.type || type }
        : { bytes: value, type };
    await set(storageKey, asset);
  } catch (error) {
    const detail =
      error instanceof Error && error.message ? ` ${error.message}` : "";
    throw new Error(`Local asset storage failed.${detail}`);
  }
  return `idb://${storageKey}`;
}

export async function loadLocalAsset(path: string) {
  if (!path.startsWith("idb://")) return null;
  const value = await get<Blob | StoredAsset>(path.slice("idb://".length));
  if (!value) return null;
  if (value instanceof Blob) return value;
  return new Blob([value.bytes], { type: value.type });
}
