"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export function ReferenceSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[140] bg-slate-950/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[141] max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-6 shadow-2xl">
          <Dialog.Close className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5" />
          </Dialog.Close>
          <Dialog.Title className="text-xl font-black">
            Math reference sheet
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Common formulas available throughout the Math section.
          </Dialog.Description>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["Circle", "A = πr²", "C = 2πr"],
              ["Rectangle", "A = lw", ""],
              ["Triangle", "A = ½bh", ""],
              ["Pythagorean theorem", "a² + b² = c²", ""],
              ["Rectangular solid", "V = lwh", ""],
              ["Cylinder", "V = πr²h", ""],
              ["Cone", "V = ⅓πr²h", ""],
              ["Sphere", "V = ⁴⁄₃πr³", "A = 4πr²"],
            ].map(([name, formula, second]) => (
              <div key={name} className="rounded-xl border bg-slate-50 p-5">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
                  {name}
                </p>
                <p className="mt-3 font-serif text-2xl">{formula}</p>
                {second && <p className="mt-2 font-serif text-xl">{second}</p>}
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            On the production app, replace this summary with the licensed,
            current College Board reference-sheet asset approved for your use.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
