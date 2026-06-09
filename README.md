# Trevor's SAT Suite

A private SAT practice platform for one tutor and up to 50 students, built with
Next.js, TypeScript, Supabase, PDF.js, and Vercel.

It includes exact-image Question Bank PDF imports, tutor review and test
building, private student accounts, timed testing, Desmos, live heartbeats,
server-authoritative scoring, and released reports. The interface is original
and does not claim College Board affiliation.

## Local Demo

Requirements: Node.js 24 and npm.

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. With no `.env.local`, the app automatically uses
browser-local demo data. Useful routes:

- `/tutor`
- `/tutor/import`
- `/student`
- `/student/test/demo`

## Production Deployment

1. Create a Supabase project near the Vercel function region you plan to use.
2. Apply every SQL file in `supabase/migrations` in filename order.
3. Copy `.env.example` to `.env.local` for local production testing.
4. Fill every variable and keep `NEXT_PUBLIC_DEMO_MODE=false`.
5. Create the initial tutor:

```powershell
npm run setup:tutor -- --email tutor@example.com --password "a-long-private-password" --name "Trevor"
```

6. Run the deployment preflight and full verification:

```powershell
npm run deploy:check
npm run verify
npm run test:e2e
```

7. Import the repository into Vercel and add the same environment variables to
   Production and Preview as appropriate.
8. Deploy, then confirm `https://your-domain.example/api/health` returns HTTP
   200 with `"mode":"production"`.

Vercel uses Node.js 24 from `package.json`. The repository includes
`vercel.json`, security headers, health checks, explicit error pages, and
GitHub Actions for unit, build, Chromium, and WebKit coverage.

### Environment Variables

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | Browser | Must be `false` in production |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser | Supabase publishable key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Legacy fallback for older Supabase projects |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Account administration and trusted scoring |
| `NEXT_PUBLIC_DESMOS_API_KEY` | Browser | Desmos API access |
| `NEXT_PUBLIC_APP_URL` | Browser | Canonical HTTPS application URL |

Never expose the service-role key through a `NEXT_PUBLIC_*` variable.

## Supabase Security

- Tutor and student roles live in Auth app metadata.
- All public-schema tables use row-level security.
- Correct answers and source PDFs remain tutor-only.
- Students receive short-lived asset URLs after an RLS authorization check.
- Attempt deadlines and scores are written by server routes, not trusted from
  the browser.
- Student account disabling also bans the Auth user.
- Production hardening restricts sensitive table writes and storage paths.

Run security tests against a staging Supabase project before onboarding real
students. Keep database backups enabled and rotate the service-role key if it
is ever exposed.

## PDF Import Contract

The canonical fixture is
`tests/fixtures/questionbank-export-2026-6-6.pdf`.

The importer:

1. Divides records at `Question ID:` markers, not page boundaries.
2. Keeps continuation pages attached to the preceding question.
3. Crops student content between `Question` and `Correct Answer:`.
4. Crops explanation content after `Rationale`.
5. Renders each segment at 3x resolution as lossless PNG.
6. Parses A-D or explicit comma-separated SPR answers.
7. Requires tutor review before publication.
8. Deduplicates by source ID and version hash.
9. Retains the original PDF privately.
10. Rejects non-PDF files, files over 50 MB, and files over 250 pages.

Question `3f5a3602` intentionally spans pages 2 and 3 and is covered by tests.

## Scoring

MCQ and SPR scoring uses only the explicit imported answer key. SPR
normalization removes harmless formatting differences but does not invent
unlisted equivalents.

Scaled estimates require a versioned public-practice conversion model. The app
must label any SAT-scale result as an unofficial estimate and must not display
one when no matching model is configured.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

The suite verifies the eight-page fixture creates seven questions, preserves
the multi-page rationale, extracts every expected key, checks SPR behavior,
and exercises tutor and student workflows on desktop Chromium and iPad WebKit.

## Operational Checklist

- Set Supabase Auth site URL and redirect URLs to the deployed HTTPS domain.
- Keep the source PDF and question asset buckets private.
- Confirm the tutor account can create, disable, and reset a test student.
- Confirm a student cannot query `accepted_answers` or another student's data.
- Confirm `/api/health` and Vercel logs after each deployment.
- Use a staging project before applying future migrations to production.
- Review privacy, guardian consent, and permitted-content obligations before
  storing real student records.
