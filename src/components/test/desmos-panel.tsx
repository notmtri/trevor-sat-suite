"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type DesmosInstance = {
  getState?: () => unknown;
  setState?: (state: unknown) => void;
  destroy?: () => void;
};

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        element: HTMLElement,
        options?: Record<string, unknown>,
      ) => DesmosInstance;
      ScientificCalculator: (
        element: HTMLElement,
        options?: Record<string, unknown>,
      ) => DesmosInstance;
    };
  }
}

export function DesmosPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<DesmosInstance | null>(null);
  const [mode, setMode] = useState<"graphing" | "scientific">("graphing");
  const [loadError, setLoadError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_DESMOS_API_KEY;

  useEffect(() => {
    if (!open || !apiKey) return;
    const initialize = () => {
      if (!containerRef.current || !window.Desmos) return;
      calculatorRef.current?.destroy?.();
      calculatorRef.current =
        mode === "graphing"
          ? window.Desmos.GraphingCalculator(containerRef.current, {
              expressions: true,
              settingsMenu: true,
              zoomButtons: true,
              expressionsTopbar: true,
            })
          : window.Desmos.ScientificCalculator(containerRef.current, {
              degreeMode: false,
            });
      try {
        const saved = localStorage.getItem(`desmos-state-${mode}`);
        if (saved && calculatorRef.current.setState) {
          calculatorRef.current.setState(JSON.parse(saved));
        }
      } catch {
        // A stale calculator state should never block the test.
      }
    };

    if (window.Desmos) {
      initialize();
      return () => calculatorRef.current?.destroy?.();
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-trevors-desmos="true"]',
    );
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
      script.async = true;
      script.dataset.trevorsDesmos = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", initialize);
    script.addEventListener("error", () =>
      setLoadError("The Desmos calculator could not be loaded."),
    );
    return () => {
      try {
        const state = calculatorRef.current?.getState?.();
        if (state) {
          localStorage.setItem(`desmos-state-${mode}`, JSON.stringify(state));
        }
      } catch {
        // Preserve the test even if calculator persistence fails.
      }
      calculatorRef.current?.destroy?.();
      script.removeEventListener("load", initialize);
    };
  }, [apiKey, mode, open]);

  if (!open) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-[130] flex w-full max-w-[600px] flex-col border-l bg-white shadow-2xl">
      <div className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-[var(--navy)]">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black">Desmos calculator</p>
            <p className="text-xs text-slate-500">
              State is preserved during the Math section
            </p>
          </div>
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100"
          aria-label="Close calculator"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex gap-2 border-b p-3">
        <Button
          size="sm"
          variant={mode === "graphing" ? "primary" : "secondary"}
          onClick={() => setMode("graphing")}
        >
          Graphing
        </Button>
        <Button
          size="sm"
          variant={mode === "scientific" ? "primary" : "secondary"}
          onClick={() => setMode("scientific")}
        >
          Scientific
        </Button>
      </div>
      {apiKey ? (
        <div ref={containerRef} className="min-h-0 flex-1" />
      ) : (
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div className="max-w-sm">
            <Calculator className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-4 font-black">Desmos API key required</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Add <code>NEXT_PUBLIC_DESMOS_API_KEY</code> to the environment to
              enable the embedded calculator in production.
            </p>
            <a
              href="https://www.desmos.com/api"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)]"
            >
              Desmos API information <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
      {loadError && (
        <p className="border-t bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {loadError}
        </p>
      )}
    </aside>
  );
}
