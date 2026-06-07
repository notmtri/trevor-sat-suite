import { expect, test } from "@playwright/test";
import path from "node:path";

async function openMobileNavigationIfNeeded(page: import("@playwright/test").Page) {
  const landingLink = page.getByRole("link", {
    name: "Landing page",
    exact: true,
  });
  if (!(await landingLink.isVisible())) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
}

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

test("authenticated navigation reaches the landing page and account settings", async ({
  page,
}) => {
  await page.goto("/tutor");
  await openMobileNavigationIfNeeded(page);
  await page
    .getByRole("link", { name: "Landing page", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Serious SAT practice, with realistic testing experience.",
    }),
  ).toBeVisible();

  await page.goto("/tutor");
  const accountLink = page.getByRole("link", { name: "Password & account" });
  if (!(await accountLink.isVisible())) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await accountLink.click();
  await expect(
    page.getByRole("heading", { name: "Change your password" }),
  ).toBeVisible();
  await page.getByLabel("New password").fill("private-password-2026");
  await page.getByLabel("Confirm password").fill("private-password-2026");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/tutor$/);
});

test("question library opens assisted test building and tests can be duplicated", async ({
  page,
}) => {
  await page.goto("/tutor/questions");
  await page.getByRole("button", { name: "Build test from library" }).click();
  await expect(
    page.getByRole("heading", { name: "Build an assisted draft" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: /Algebra Checkpoint/ }).click();
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(
    page.getByRole("heading", { name: "Algebra Checkpoint copy" }),
  ).toBeVisible();
});

test("student can launch the demo testing module", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/student");
  await expect(
    page.getByRole("heading", { name: /Welcome back, Minh Nguyen\./ }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(localStorage.getItem("trevors-sat-suite-state-v1")),
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    const key = "trevors-sat-suite-state-v1";
    const saved = localStorage.getItem(key);
    if (!saved) return;
    const state = JSON.parse(saved) as {
      attempts: Array<{ status: string }>;
    };
    state.attempts = state.attempts.filter(
      (attempt) => attempt.status !== "in_progress",
    );
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("link", { name: /Start assignment/ }).click();
  await expect(
    page.getByRole("heading", { name: "Math Practice", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "All 3 question images loaded and decoded. The timer has not started.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: /Start module/ }).click();
  await expect(page.getByText("Your answer"), pageErrors.join("\n")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Student-produced response" }),
  ).toBeVisible();
  const questionImage = page.getByAltText("Question 1");
  await expect(questionImage).toBeVisible();
  expect(
    await questionImage.evaluate(
      (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Notes" }).click();
  await expect(page.getByText("Question notes")).toBeVisible();
  await page.getByRole("button", { name: "Close question notes" }).last().click();

  await page.getByRole("button", { name: "Open question menu" }).click();
  await page.getByRole("button", { name: "Exit test" }).click();
  await expect(
    page.getByRole("heading", { name: "Exit this timed module?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep working" }).click();
  await expect(page.getByText("Your answer")).toBeVisible();

  await page.getByRole("button", { name: "Open question menu" }).click();
  await page.getByRole("button", { name: "Exit test" }).click();
  await page.getByRole("link", { name: "Exit to dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: /Welcome back, Minh Nguyen\./ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Resume assignment" }).click();
  await expect(page.getByText("Your answer")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start module" }),
  ).toHaveCount(0);
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
