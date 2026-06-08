"use client";

import { Save, Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAppState } from "@/components/providers/app-state-provider";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import type { FeedbackPolicy, TutorSettings } from "@/lib/domain";

export default function TutorSettingsPage() {
  const { state, updateSettings } = useAppState();
  const settings = state.settings;

  function update<K extends keyof TutorSettings>(
    key: K,
    value: TutorSettings[K],
  ) {
    updateSettings({ [key]: value });
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Tutor settings"
        description="Control the public copy, tutor identity, and default assignment behavior."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-[var(--blue)]">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black">Branding and landing copy</h2>
              <p className="text-sm text-slate-500">
                These are safe to show outside the authenticated workspace.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5">
            <div>
              <FieldLabel htmlFor="settings-display-name">
                Tutor display name
              </FieldLabel>
              <Input
                id="settings-display-name"
                value={settings.displayName}
                onChange={(event) => update("displayName", event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="settings-headline">
                Landing headline
              </FieldLabel>
              <Textarea
                id="settings-headline"
                rows={2}
                value={settings.landingHeadline}
                onChange={(event) =>
                  update("landingHeadline", event.target.value)
                }
              />
            </div>
            <div>
              <FieldLabel htmlFor="settings-subheadline">
                Landing subheadline
              </FieldLabel>
              <Textarea
                id="settings-subheadline"
                rows={3}
                value={settings.landingSubheadline}
                onChange={(event) =>
                  update("landingSubheadline", event.target.value)
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FieldLabel htmlFor="settings-hero-eyebrow">
                  Hero eyebrow
                </FieldLabel>
                <Input
                  id="settings-hero-eyebrow"
                  value={settings.heroEyebrow}
                  onChange={(event) =>
                    update("heroEyebrow", event.target.value)
                  }
                />
              </div>
              <div>
                <FieldLabel htmlFor="settings-hero-title">
                  Hero title
                </FieldLabel>
                <Input
                  id="settings-hero-title"
                  value={settings.heroTitle}
                  onChange={(event) => update("heroTitle", event.target.value)}
                />
              </div>
              <div>
                <FieldLabel htmlFor="settings-hero-subtitle">
                  Hero subtitle
                </FieldLabel>
                <Input
                  id="settings-hero-subtitle"
                  value={settings.heroSubtitle}
                  onChange={(event) =>
                    update("heroSubtitle", event.target.value)
                  }
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-black">Assignment defaults</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            New assignments start with these values, then you can override them
            per assignment or per student.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <FieldLabel htmlFor="settings-timezone">Timezone</FieldLabel>
              <Input
                id="settings-timezone"
                value={settings.timezone}
                onChange={(event) => update("timezone", event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="settings-due-days">
                  Default due days
                </FieldLabel>
                <Input
                  id="settings-due-days"
                  type="number"
                  min={1}
                  max={120}
                  value={settings.defaultDueDays}
                  onChange={(event) =>
                    update("defaultDueDays", Number(event.target.value))
                  }
                />
              </div>
              <div>
                <FieldLabel htmlFor="settings-attempt-limit">
                  Attempt limit
                </FieldLabel>
                <Input
                  id="settings-attempt-limit"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.defaultAttemptLimit}
                  onChange={(event) =>
                    update("defaultAttemptLimit", Number(event.target.value))
                  }
                />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="settings-feedback-policy">
                Feedback policy
              </FieldLabel>
              <Select
                id="settings-feedback-policy"
                value={settings.defaultFeedbackPolicy}
                onChange={(event) =>
                  update(
                    "defaultFeedbackPolicy",
                    event.target.value as FeedbackPolicy,
                  )
                }
              >
                <option value="immediate">Immediate during practice</option>
                <option value="after_submission">After submission</option>
                <option value="tutor_release">Tutor release only</option>
              </Select>
            </div>
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={settings.defaultAllowResume}
                onChange={(event) =>
                  update("defaultAllowResume", event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 accent-[var(--navy)]"
              />
              Allow students to resume timed modules by default
            </label>
          </div>
          <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <Save className="mr-2 inline h-4 w-4" />
            Changes save automatically.
          </div>
        </Card>
      </div>
    </>
  );
}
