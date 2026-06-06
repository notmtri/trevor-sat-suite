import { expect, test } from "@playwright/test";
import path from "node:path";

test("tutor can reach import and question library workflows", async ({ page }) => {
  await page.goto("/tutor");
  await expect(
    page.getByRole("heading", { name: "Good afternoon, Trevor." }),
  ).toBeVisible();
  const importLink = page.getByRole("link", { name: "Import questions" });
  if (!(await importLink.isVisible())) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await importLink.click();
  await expect(
    page.getByRole("heading", { name: "Import Question Bank PDF" }),
  ).toBeVisible();
  await expect(page.getByText("Drop an export here")).toBeVisible();
});

test("student can launch the demo testing module", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/student");
  await expect(
    page.getByRole("heading", { name: /Welcome back, Minh Nguyen\./ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Start assignment/ }).click();
  await expect(page.getByText("Math Practice")).toBeVisible();
  await page.getByRole("button", { name: /Start module/ }).click();
  await expect(page.getByText("Your answer"), pageErrors.join("\n")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Student-produced response" }),
  ).toBeVisible();
});

test("canonical PDF imports seven exact-image questions", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/tutor/import");
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      path.resolve(
        process.cwd(),
        "tests/fixtures/questionbank-export-2026-6-6.pdf",
      ),
    );

  await expect(page.getByText("Question 1 of 7")).toBeVisible({
    timeout: 90_000,
  });
  const prompt = page.getByAltText("Prompt for question ac472881").first();
  await expect(prompt).toBeVisible();
  expect(
    await prompt.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(1000);

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("ID 3f5a3602")).toBeVisible();
  await expect(page.getByText("Source page 3")).toBeVisible();
});
