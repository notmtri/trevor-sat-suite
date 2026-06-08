import type { TutorSettings } from "@/lib/domain";

export const defaultTutorSettings: TutorSettings = {
  displayName: "Trevor",
  landingHeadline: "Serious SAT practice, with realistic testing experience.",
  landingSubheadline:
    "Practice tutor-approved SAT questions from College Board's official question bank. Experience a carefully designed testing interface.",
  heroEyebrow: "Your SAT tutor",
  heroTitle: "Hi, I'm Trevor.",
  heroSubtitle: "CompSci Undergraduate | 1550 SAT | 8.5 IELTS",
  timezone: "Asia/Saigon",
  defaultDueDays: 7,
  defaultAttemptLimit: 1,
  defaultFeedbackPolicy: "after_submission",
  defaultAllowResume: true,
};

export function normalizeTutorSettings(
  value: Partial<TutorSettings> | undefined,
): TutorSettings {
  return {
    ...defaultTutorSettings,
    ...value,
    displayName: value?.displayName?.trim() || defaultTutorSettings.displayName,
    landingHeadline:
      value?.landingHeadline?.trim() || defaultTutorSettings.landingHeadline,
    landingSubheadline:
      value?.landingSubheadline?.trim() ||
      defaultTutorSettings.landingSubheadline,
    heroEyebrow: value?.heroEyebrow?.trim() || defaultTutorSettings.heroEyebrow,
    heroTitle: value?.heroTitle?.trim() || defaultTutorSettings.heroTitle,
    heroSubtitle:
      value?.heroSubtitle?.trim() || defaultTutorSettings.heroSubtitle,
    timezone: value?.timezone?.trim() || defaultTutorSettings.timezone,
    defaultDueDays: clampInteger(
      value?.defaultDueDays,
      1,
      120,
      defaultTutorSettings.defaultDueDays,
    ),
    defaultAttemptLimit: clampInteger(
      value?.defaultAttemptLimit,
      1,
      20,
      defaultTutorSettings.defaultAttemptLimit,
    ),
    defaultFeedbackPolicy:
      value?.defaultFeedbackPolicy ?? defaultTutorSettings.defaultFeedbackPolicy,
    defaultAllowResume:
      value?.defaultAllowResume ?? defaultTutorSettings.defaultAllowResume,
  };
}

function clampInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}
