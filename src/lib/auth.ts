export function studentUsernameToEmail(username: string) {
  const normalized = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  return `${normalized}@students.trevors-sat.local`;
}
