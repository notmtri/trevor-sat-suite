// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuestionAsset } from "@/lib/domain";
import { preloadQuestionAssets } from "@/lib/question-assets";

function asset(id: string, dataUrl: string): QuestionAsset {
  return {
    id,
    kind: "prompt",
    order: 0,
    sourcePage: 1,
    dataUrl,
    width: 100,
    height: 50,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("question image preloading", () => {
  it("loads and decodes each unique image before reporting ready", async () => {
    const constructed: string[] = [];

    class MockImage {
      decoding = "";
      fetchPriority = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(value: string) {
        constructed.push(value);
        queueMicrotask(() => this.onload?.());
      }

      async decode() {}
    }

    vi.stubGlobal("Image", MockImage);
    const progress: Array<[number, number]> = [];
    const dataUrl = "data:image/png;base64,unique-preload-success";

    await preloadQuestionAssets(
      [asset("one", dataUrl), asset("duplicate", dataUrl)],
      (loaded, total) => progress.push([loaded, total]),
    );

    expect(constructed).toEqual([dataUrl]);
    expect(progress).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it("rejects when an image cannot be loaded", async () => {
    class BrokenImage {
      decoding = "";
      fetchPriority = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }

      async decode() {}
    }

    vi.stubGlobal("Image", BrokenImage);

    await expect(
      preloadQuestionAssets([
        asset("broken", "data:image/png;base64,unique-preload-failure"),
      ]),
    ).rejects.toThrow("1 question image could not be prepared.");
  });
});
