import { describe, expect, it } from "vitest";
import { defaultTutorSettings, normalizeTutorSettings } from "@/lib/settings";

describe("tutor settings", () => {
  it("fills missing values with safe defaults", () => {
    expect(normalizeTutorSettings(undefined)).toEqual(defaultTutorSettings);
  });

  it("trims text and clamps numeric defaults", () => {
    expect(
      normalizeTutorSettings({
        displayName: "  Trevor  ",
        defaultDueDays: 999,
        defaultAttemptLimit: 0,
      }),
    ).toMatchObject({
      displayName: "Trevor",
      defaultDueDays: 120,
      defaultAttemptLimit: 1,
    });
  });
});
