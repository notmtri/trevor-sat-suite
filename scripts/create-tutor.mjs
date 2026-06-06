import { existsSync } from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = readArg("email");
const password = readArg("password");
const displayName = readArg("name") ?? "Trevor";

if (!url || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}
if (!email || !password || password.length < 10) {
  console.error(
    "Usage: npm run setup:tutor -- --email tutor@example.com --password 'at-least-10-characters' --name Trevor",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: "tutor" },
  user_metadata: {
    display_name: displayName,
    must_change_password: false,
  },
});

if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(`Tutor created: ${data.user.email} (${data.user.id})`);
