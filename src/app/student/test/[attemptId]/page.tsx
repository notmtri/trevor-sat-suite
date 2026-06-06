import { TestRunner } from "@/components/test/test-runner";

export default async function StudentTestPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <TestRunner attemptId={attemptId} />;
}
