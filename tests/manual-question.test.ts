// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { validateQuestionImage } from "@/lib/manual-question";

describe("manual question image validation", () => {
  it("accepts supported image formats", () => {
    expect(() =>
      validateQuestionImage(
        new File(["image"], "question.png", { type: "image/png" }),
      ),
    ).not.toThrow();
  });

  it("rejects unsupported files", () => {
    expect(() =>
      validateQuestionImage(
        new File(["document"], "question.pdf", {
          type: "application/pdf",
        }),
      ),
    ).toThrow("Question images must be PNG, JPEG, or WebP files.");
  });
});
