import { describe, expect, it } from "vitest";
import { roleHome, safeInternalPath } from "../src/lib/navigation";

describe("navigation helpers", () => {
  it("returns the correct workspace for each role", () => {
    expect(roleHome("tutor")).toBe("/tutor");
    expect(roleHome("student")).toBe("/student");
    expect(roleHome(undefined)).toBe("/student");
  });

  it("accepts internal paths and rejects external redirects", () => {
    expect(safeInternalPath("/tutor/questions", "/")).toBe(
      "/tutor/questions",
    );
    expect(safeInternalPath("https://example.com", "/student")).toBe(
      "/student",
    );
    expect(safeInternalPath("//example.com", "/student")).toBe("/student");
    expect(safeInternalPath("/\\example.com", "/student")).toBe("/student");
    expect(safeInternalPath(null, "/student")).toBe("/student");
  });
});
