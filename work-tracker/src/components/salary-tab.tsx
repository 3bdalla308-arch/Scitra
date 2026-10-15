"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HandCoins,
  Banknote,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AR_MONTHS, fmtDateShort, fmtMoney, fmtWorked } from "@/lib/arabic";
import { apiFetch } from "@/lib/local-api";

type EntryType = "advance" | "deduction" | "bonus";

type SalaryEntry = {
  id: string;
  date: string;
  type: EntryType;
  amount: number;
  note: string | null;
};

const TYPE_META: Record<
  EntryType,
  {
    label: string;
    icon: React.ReactNode;
    badge: string;
    amountColor: string;
    sign: string;
  }
> = {
  advance: {
    label: "سلفة",
    icon: <HandCoins className="size-4" aria-hidden="true" />,
    badge: "bg-amber-100 text-amber-800",
    amountColor: "text-amber-700",
    sign: "−",
  },
  deduction: {
    label: "خصم",
    icon: <TrendingDown className="size-4" aria-hidden="true" />,
    badge: "bg-rose-100 text-rose-700",
    amountColor: "text-rose-600",
    sign: "−",
  },
  bonus: {
    label: "حافز",
    icon: <TrendingUp className="size-4" aria-hidden="true" />,
    badge: "bg-emerald-100 text-emerald-700",
    amountColor: "text-emerald-600",
    sign: "+",
  },
};

type SalaryTabProps = {
  periodStartKey: string;
  periodEndKey: string;
  periodLabelText: string;
  worked: number;
  todayKey: string | null;
  paydayText: string;
  payday: number;
};

export function SalaryTab({
  periodStartKey,
  periodEndKey,
  periodLabelText,
  worked,
  todayKey,
  paydayText,
  payday,
}: SalaryTabProps) {
  const { toast } = useToast();

  // الأجر والإعدادات
  const [wageInput, setWageInput] = useState("");
  const [wage, setWage] = useState<number | null>(null);
  const [wageLoading, setWageLoading] = useState(true);
  const [savingWage, setSavingWage] = useState(false);

  // حركات الدورة
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // فورم الإضافة
  const [formType, setFormType] = useState<EntryType>("advance");
  const [formAmount, setFormAmount] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formDate, setFormDate] = useState(periodStartKey);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // تحميل الأجر مرة واحدة
  useEffect(() => {
    let alive = true;
    apiFetch("/api/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((data: { dailyWage: number | null }) => {
        if (!alive) return;
        setWage(data.dailyWage);
        if (data.dailyWage !== null) setWageInput(String(data.dailyWage));
      })
      .catch(() => {
        if (alive)
          toast({
            title: "مشكلة في التحميل",
            description: "مقدرتش نجيب الإعدادات، جرّب تاني.",
            variant: "destructive",
          });
      })
      .finally(() => {
        if (alive) setWageLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [toast]);

  // تحميل حركات الدورة عند تغيير الدورة
  useEffect(() => {
    const controller = new AbortController();
    setListLoading(true);
    apiFetch(`/api/salary?start=${periodStartKey}&end=${periodEndKey}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("bad");
        return r.json();
      })
      .then((data: { entries?: SalaryEntry[] }) => {
        setEntries(
          (data.entries ?? []).filter((e) =>
            (["advance", "deduction", "bonus"] as string[]).includes(e.type)
          )
        );
      })
      .catch((err: unknown) => {
        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name?: string }).name === "AbortError"
        )
          return;
        toast({
          title: "مشكلة في التحميل",
          description: "مقدرتش نجيب حركات المرتب، جرّب تاني.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });
    return () => controller.abort();
  }, [periodStartKey, periodEndKey, toast]);

  // التاريخ الافتراضي: النهاردة لو داخل الدورة، وإلا أول الدورة
  const defaultDate =
    todayKey && todayKey >= periodStartKey && todayKey <= periodEndKey
      ? todayKey
      : periodStartKey;

  useEffect(() => {
    setFormDate(defaultDate);
  }, [defaultDate]);

  // حسابات المرتب
  const sums = useMemo(() => {
    let advances = 0;
    let deductions = 0;
    let bonuses = 0;
    for (const e of entries) {
      if (e.type === "advance") advances += e.amount;
      else if (e.type === "deduction") deductions += e.amount;
      else bonuses += e.amount;
    }
    return { advances, deductions, bonuses };
  }, [entries]);

  const base = wage !== null ? worked * wage : null;
  const net = base !== null ? base + sums.bonuses - sums.advances - sums.deductions : null;

  const saveWage = async () => {
    const val = parseFloat(wageInput);
    if (!isFinite(val) || val < 0) {
      toast({
        title: "رقم غير صحيح",
        description: "اكتب الأجر اليومي كرقم أكبر من أو يساوي صفر.",
        variant: "destructive",
      });
      return;
    }
    setSavingWage(true);
    try {
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyWage: val }),
      });
      if (!res.ok) throw new Error();
      setWage(val);
      toast({ title: "اتسجل الأجر", description: `الأجر اليومي بقى ${fmtMoney(val)}.` });
    } catch {
      toast({
        title: "ما اتسجلش",
        description: "حصلت مشكلة وحفظ الأجر ما تمش، جرّب تاني.",
        variant: "destructive",
      });
    } finally {
      setSavingWage(false);
    }
  };

  const addEntry = async () => {
    const amount = parseFloat(formAmount);
    if (!isFinite(amount) || amount <= 0) {
      toast({
        title: "المبلغ ناقص",
        description: "اكتب مبلغ أكبر من صفر.",
        variant: "destructive",
      });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formDate)) {
      toast({
        title: "التاريخ غلط",
        description: "اختار تاريخ صحيح.",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    try {
      const res = await apiFetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: formDate,
          type: formType,
          amount,
          note: formNote.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const created: SalaryEntry = await res.json();
      setEntries((prev) => [created, ...prev]);
      setFormAmount("");
      setFormNote("");
      toast({
        title: `اتسجلت ${TYPE_META[formType].label}`,
        description: `${fmtMoney(amount)} بتاريخ ${fmtDateShort(formDate)}.`,
      });
    } catch {
      toast({
        title: "ما اتسجلش",
        description: "حصلت مشكلة وحفظ الحركة ما تمش، جرّب تاني.",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const deleteEntry = async (id: string) => {
    const rollback = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/salary?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setEntries(rollback);
      toast({
        title: "ما اتمسحش",
        description: "حصلت مشكلة وحذف الحركة ما تمش، جرّب تاني.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* صافي المرتب */}
      <Card className="border-emerald-100 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
              <Wallet className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold">صافي مرتب الدورة</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {periodLabelText}
              </p>
            </div>
          </div>

          {wageLoading ? (
            <Skeleton className="mt-3 h-9 w-40 rounded-lg" />
          ) : (
            <p
              className={cn(
                "mt-3 text-3xl font-extrabold tracking-tight",
                net === null && "text-base text-muted-foreground",
                net !== null && net < 0 && "text-rose-600",
                net !== null && net >= 0 && "text-emerald-600"
              )}
            >
              {net === null ? "حدد أجرك اليومي الأول" : fmtMoney(net)}
            </p>
          )}

          {base !== null && (
            <div className="mt-3 space-y-1.5 rounded-xl bg-muted/70 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  أيام الشغل ({fmtWorked(worked)} يوم × {fmtMoney(wage ?? 0)})
                </span>
                <span className="font-bold">{fmtMoney(base)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">الحوافز</span>
                <span className="font-bold text-emerald-600">
                  + {fmtMoney(sums.bonuses)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">السلف</span>
                <span className="font-bold text-amber-700">
                  − {fmtMoney(sums.advances)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">الخصومات</span>
                <span className="font-bold text-rose-600">
                  − {fmtMoney(sums.deductions)}
                </span>
              </div>
            </div>
          )}

          {/* يوم القبض */}
          {paydayText && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
                <Banknote className="size-4" aria-hidden="true" />
                القبض يوم {payday} من كل شهر
              </span>
              <span className="text-xs font-extrabold text-amber-700">
                {paydayText}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* إعدادات الأجر اليومي */}
      <Card className="shadow-sm">
        <CardContent className="space-y-2.5 p-4">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="daily-wage" className="text-sm font-bold">
              الأجر اليومي
            </Label>
            {wage !== null && !wageLoading && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                حاليًا: {fmtMoney(wage)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              id="daily-wage"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.25"
              placeholder="مثال: 150"
              value={wageInput}
              onChange={(e) => setWageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveWage();
              }}
              className="h-10"
            />
            <Button
              onClick={saveWage}
              disabled={savingWage || wageLoading}
              className="h-10 shrink-0 px-5"
            >
              حفظ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* إضافة حركة */}
      <Card className="shadow-sm">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-extrabold">إضافة حركة</p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="entry-type" className="text-xs">
                النوع
              </Label>
              <Select
                dir="rtl"
                value={formType}
                onValueChange={(v) => setFormType(v as EntryType)}
              >
                <SelectTrigger id="entry-type" className="h-10 w-full">
                  <SelectValue placeholder="اختار النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advance">سلفة</SelectItem>
                  <SelectItem value="deduction">خصم</SelectItem>
                  <SelectItem value="bonus">حافز</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="entry-amount" className="text-xs">
                المبلغ
              </Label>
              <Input
                id="entry-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.25"
                placeholder="0"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-date" className="text-xs">
                التاريخ
              </Label>
              <Input
                id="entry-date"
                type="date"
                value={formDate}
                min={periodStartKey}
                max={periodEndKey}
                onChange={(e) => setFormDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-note" className="text-xs">
                ملاحظة (اختياري)
              </Label>
              <Input
                id="entry-note"
                type="text"
                placeholder="مثال: سلفة الشهر"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <Button onClick={addEntry} disabled={adding} className="h-10 w-full">
            <Plus className="size-4" aria-hidden="true" />
            إضافة الحركة
          </Button>
        </CardContent>
      </Card>

      {/* حركات الدورة */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <p className="mb-2.5 text-sm font-extrabold">
            حركات الدورة ({entries.length})
          </p>
          {listLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              مفيش حركات في الدورة دي
            </p>
          ) : (
            <div className="custom-scrollbar max-h-72 space-y-2 overflow-y-auto pe-1">
              {entries.map((e) => {
                const meta = TYPE_META[e.type];
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-white/60 p-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          meta.badge
                        )}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {meta.label}
                          {e.note ? (
                            <span className="font-medium text-muted-foreground">
                              {" "}
                              — {e.note}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {fmtDateShort(e.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        className={cn(
                          "text-sm font-extrabold",
                          meta.amountColor
                        )}
                      >
                        {meta.sign} {fmtMoney(e.amount)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-rose-600"
                        onClick={() => deleteEntry(e.id)}
                        disabled={deletingId === e.id}
                        aria-label={`حذف ${meta.label} بتاريخ ${fmtDateShort(e.date)}`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
