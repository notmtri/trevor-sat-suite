"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center p-5">
      <Card className="max-w-lg p-8 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-2xl font-black">This page hit a problem</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your saved work has not been intentionally cleared. Retry the page,
          and contact the tutor if the problem continues.
        </p>
        <Button
          className="mt-6"
          icon={<RotateCcw className="h-4 w-4" />}
          onClick={reset}
        >
          Try again
        </Button>
      </Card>
    </main>
  );
}
