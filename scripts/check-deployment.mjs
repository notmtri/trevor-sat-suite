import { existsSync } from "node:fs";
import process from "node:process";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_DESMOS_API_KEY",
  "NEXT_PUBLIC_APP_URL",
];
const errors = [];

for (const name of required) {
  if (!process.env[name]?.trim()) errors.push(`${name} is missing.`);
}
if (process.env.NEXT_PUBLIC_DEMO_MODE !== "false") {
  errors.push("NEXT_PUBLIC_DEMO_MODE must be false.");
}
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_APP_URL"]) {
  const value = process.env[name];
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors.push(`${name} must use HTTPS.`);
  } catch {
    errors.push(`${name} must be a valid URL.`);
  }
}
if (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ===
    process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  errors.push("The anon key and service-role key must be different.");
}

if (errors.length) {
  console.error("Deployment preflight failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Deployment environment looks ready.");
