"use client";

import { Building2 } from "lucide-react";
import { Copyright } from "@/components/copyright";
import { OFFICE_LIST, officeLogoSrc, type OfficeId } from "@/lib/offices";

type Props = {
  current?: OfficeId | null;
  onPick: (id: OfficeId) => void;
  onCancel?: () => void;
};

// شاشة اختيار المكتب
export function OfficePicker({ current, onPick, onCancel }: Props) {
  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-5 py-10"
    >
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
          <Building2 className="size-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">اختار مكتبك</h1>
        <p className="text-sm text-muted-foreground">
          هتشوف نظام مكتبك وحسابك الخاص بيه
        </p>
      </div>

      <div className="grid gap-3">
        {OFFICE_LIST.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className={`rounded-2xl border-2 p-5 text-right transition active:scale-[0.98] ${
              current === o.id
                ? "border-emerald-500 bg-emerald-50"
                : "border-border bg-card hover:border-emerald-400"
            }`}
          >
            <span className="flex items-center justify-between gap-4">
              <span className="text-lg font-extrabold">{o.name}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={officeLogoSrc(o)}
                alt={`لوجو ${o.name}`}
                className="h-10 w-auto max-w-[45%] rounded-md object-contain"
              />
            </span>
          </button>
        ))}
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          رجوع
        </button>
      )}

      <Copyright />
    </main>
  );
}
