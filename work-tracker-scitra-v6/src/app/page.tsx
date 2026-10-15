"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Percent,
  TimerReset,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SalaryTab } from "@/components/salary-tab";
import { apiFetch } from "@/lib/local-api";
import { OfficePicker } from "@/components/office-picker";
import { Copyright } from "@/components/copyright";
import {
  OFFICES,
  officeLogoSrc,
  adoptLegacyData,
  getStoredOffice,
  storeOffice,
  type Office,
  type OfficeId,
} from "@/lib/offices";
import {
  AR_MONTHS,
  AR_MONTHS_SHORT,
  AR_WEEKDAYS,
  AR_WEEKDAYS_FULL,
  fmtDateShort,
  fmtDays,
  fmtWorked,
  paydayCountdown,
  toKey,
} from "@/lib/arabic";

type Status = "full";

// ---------- أدوات التاريخ (كلها بالتوقيت المحلي وتخزين YYYY-MM-DD) ----------

// الدورة الشهرية: بتبدأ يوم startDay وبتخلص قبله بيوم في الشهر اللي بعده
function getPeriod(offset: number, today: Date, startDay: number) {
  let y = today.getFullYear();
  let m = today.getMonth();
  if (today.getDate() < startDay) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  m += offset;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  const start = new Date(y, m, startDay, 0, 0, 0, 0);
  const endYear = m === 11 ? y + 1 : y;
  const end = new Date(endYear, (m + 1) % 12, startDay - 1, 0, 0, 0, 0);
  return { start, end };
}

type Cell = {
  key: string;
  dayNum: number;
  isFriday: boolean;
  isToday: boolean;
  isFuture: boolean;
  showMonth: string | null;
};

function buildCells(
  start: Date,
  end: Date,
  todayKey: string | null,
  startDay: number
): (Cell | null)[] {
  const cells: (Cell | null)[] = [];
  // الأسبوع في مصر بيبدأ السبت: عمود السبت = (getDay + 1) % 7
  const lead = (start.getDay() + 1) % 7;
  for (let i = 0; i < lead; i++) cells.push(null);
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = toKey(cursor);
    const dayNum = cursor.getDate();
    cells.push({
      key,
      dayNum,
      isFriday: cursor.getDay() === 5,
      isToday: todayKey ? key === todayKey : false,
      isFuture: todayKey ? key > todayKey : false,
      showMonth: dayNum === startDay || dayNum === 1 ? AR_MONTHS_SHORT[cursor.getMonth()] : null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

// الدورة من يوم startDay لحد نفس اليوم في الشهر اللي بعده (آخر يوم فعلي قبله بيوم)
function periodLabel(start: Date, end: Date, startDay: number): string {
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  if (startYear === endYear) {
    return `${startDay} ${AR_MONTHS[start.getMonth()]} – ${startDay} ${AR_MONTHS[end.getMonth()]} ${endYear}`;
  }
  return `${startDay} ${AR_MONTHS[start.getMonth()]} ${startYear} – ${startDay} ${AR_MONTHS[end.getMonth()]} ${endYear}`;
}

// ---------- الصفحة ----------

function Tracker({ office, onSwitch }: { office: Office; onSwitch: () => void }) {
  const { toast } = useToast();
  const startDay = office.cycleStartDay;
  const [today, setToday] = useState<Date | null>(null);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [days, setDays] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // "النهاردة" بتتحسب في المتصفح بعد التحميل عشان نتجنب اختلاف التوقيت مع السيرفر
  useEffect(() => {
    setToday(new Date());
  }, []);

  const period = useMemo(
    () => (today ? getPeriod(periodOffset, today, startDay) : null),
    [today, periodOffset, startDay]
  );

  const todayKey = today ? toKey(today) : null;

  const cells = useMemo(
    () =>
      period
        ? buildCells(period.start, period.end, todayKey, startDay)
        : [],
    [period, todayKey, startDay]
  );

  // جلب بيانات الدورة
  useEffect(() => {
    if (!period) return;
    const controller = new AbortController();
    setLoading(true);
    const start = toKey(period.start);
    const end = toKey(period.end);
    apiFetch(`/api/days?start=${start}&end=${end}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then((data: { days?: { date: string; status: string }[] }) => {
        const map: Record<string, Status> = {};
        for (const d of data.days ?? []) {
          if (d.status === "full") map[d.date] = d.status;
        }
        setDays(map);
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
          description: "مقدرتش نجيب سجل الدورة، جرّب تاني.",
          variant: "destructive",
        });
        setLoading(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period, toast]);

  // تسجيل / تعديل يوم مع تحديث فوري وتراجع عند الفشل
  const setStatus = useCallback(
    async (dateKey: string, next: Status | null) => {
      let rollback: Status | null = null;
      setDays((prev) => {
        rollback = prev[dateKey] ?? null;
        const copy = { ...prev };
        if (next === null) delete copy[dateKey];
        else copy[dateKey] = next;
        return copy;
      });
      setSaving((prev) => ({ ...prev, [dateKey]: true }));
      try {
        const res = await apiFetch("/api/days", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateKey, status: next ?? "none" }),
        });
        if (!res.ok) throw new Error("save failed");
      } catch {
        setDays((prev) => {
          const copy = { ...prev };
          if (rollback === null) delete copy[dateKey];
          else copy[dateKey] = rollback;
          return copy;
        });
        toast({
          title: "ما اتسجلش",
          description: "حصلت مشكلة والحفظ ما تمش، جرّب تاني.",
          variant: "destructive",
        });
      } finally {
        setSaving((prev) => {
          const copy = { ...prev };
          delete copy[dateKey];
          return copy;
        });
      }
    },
    [toast]
  );

  // تسجيل يوم مع زرار "تراجع" يرجّع الحالة اللي قبله
  const markDay = useCallback(
    (dateKey: string, next: Status | null) => {
      const prev = days[dateKey] ?? null;
      if (prev === next) return;
      setStatus(dateKey, next);
      toast({
        title: next ? "اتسجل يوم شغل" : "اتمسح التسجيل",
        description: fmtDateShort(dateKey),
        duration: 6000,
        action: { label: "تراجع", onClick: () => setStatus(dateKey, prev) },
      });
    },
    [days, setStatus, toast]
  );

  const cycleDay = useCallback(
    (dateKey: string) => {
      const cur = days[dateKey] ?? null;
      // ضغطة = يوم كامل، وضغطة تانية = مسح
      const next: Status | null = cur === null ? "full" : null;
      markDay(dateKey, next);
    },
    [days, markDay]
  );

  // تنبيهات: قرب يوم القبض أو قفل الدورة (في الدورة الحالية بس)
  const reminders = useMemo(() => {
    if (!today || !period || periodOffset !== 0) return [];
    const list: string[] = [];
    const pd = paydayCountdown(today, office.payday);
    if (pd.isToday) list.push("النهاردة يوم القبض 🎉");
    else if (pd.daysLeft <= 3) list.push(`باقي ${fmtDays(pd.daysLeft)} على القبض`);
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const toEnd = Math.round((period.end.getTime() - t0) / 86_400_000);
    if (toEnd === 0) list.push("النهاردة آخر يوم في الدورة، راجع أيامك وسلفك قبل القفل");
    else if (toEnd > 0 && toEnd <= 2) list.push(`الدورة بتقفل بعد ${fmtDays(toEnd)}، راجع أيامك وسلفك`);
    return list;
  }, [today, period, periodOffset, office.payday]);

  const stats = useMemo(() => {
    if (!period) return null;
    let full = 0;
    for (const c of cells) {
      if (!c) continue;
      if (days[c.key] === "full") full++;
    }
    const worked = full;
    const totalDays = cells.filter(Boolean).length;
    let elapsed: number;
    const startMs = period.start.getTime();
    const endMs = period.end.getTime();
    const nowMs = today ? today.getTime() : startMs;
    if (nowMs > endMs) elapsed = totalDays;
    else if (nowMs < startMs) elapsed = 0;
    else elapsed = Math.floor((nowMs - startMs) / 86_400_000) + 1;
    const remaining = Math.max(totalDays - elapsed, 0);
    const rate = elapsed > 0 ? Math.round((worked / elapsed) * 100) : null;
    return { full, worked, totalDays, elapsed, remaining, rate };
  }, [period, cells, days, today]);

  const todayStatus = todayKey ? (days[todayKey] ?? null) : null;
  const isCurrent = periodOffset === 0;
  const isPastPeriod = period && today ? period.end.getTime() < today.getTime() : false;
  const isFuturePeriod = period && today ? period.start.getTime() > today.getTime() : false;

  const badgeText = isCurrent
    ? "الدورة الحالية"
    : isPastPeriod
      ? "دورة عدّت"
      : "دورة جاية";
  const badgeClass = isCurrent
    ? "bg-emerald-500 hover:bg-emerald-500 text-white border-transparent"
    : isPastPeriod
      ? "bg-muted text-muted-foreground border-transparent"
      : "bg-amber-100 text-amber-800 border-transparent hover:bg-amber-100";

  return (
    <div className="min-h-svh bg-gradient-to-b from-emerald-50 via-background to-emerald-50/60">
      <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col gap-4 px-3 pb-10 pt-6 sm:gap-5 sm:pt-10">
        {/* الهيدر */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-3 px-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon-192.png`}
            alt="Scitra"
            className="size-12 shrink-0 rounded-2xl bg-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-100"
          />
          <div className="min-w-0 flex-1">
            <h1 className="sr-only">Scitra</h1>
          </div>
          <button
            type="button"
            onClick={onSwitch}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-bold text-emerald-700 shadow-sm transition active:scale-95"
            aria-label="تغيير المكتب"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={officeLogoSrc(office)}
              alt=""
              className="h-5 w-auto max-w-14 rounded-sm object-contain"
            />
            {office.name}
          </button>
        </motion.header>

        {/* تنبيهات القبض وقفل الدورة */}
        {reminders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-900"
          >
            <Bell className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="space-y-0.5 text-sm font-bold">
              {reminders.map((r) => (
                <p key={r}>{r}</p>
              ))}
            </div>
          </motion.div>
        )}

        {/* التابات: متابعة الشغل / المرتب */}
        <Tabs dir="rtl" defaultValue="attendance" className="flex flex-1 flex-col">
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl">
            <TabsTrigger
              value="attendance"
              className="gap-1.5 rounded-lg text-sm font-bold"
            >
              <CalendarCheck2 className="size-4" aria-hidden="true" />
              متابعة الشغل
            </TabsTrigger>
            <TabsTrigger
              value="salary"
              className="gap-1.5 rounded-lg text-sm font-bold"
            >
              <Wallet className="size-4" aria-hidden="true" />
              المرتب
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="attendance"
            className="mt-4 flex flex-col gap-4 focus-visible:outline-none sm:mt-5 sm:gap-5"
          >

        {/* النهاردة + أزرار سريعة */}
        {today ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
          >
            <Card className="border-emerald-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-emerald-600">النهاردة</p>
                    <p className="text-lg font-bold leading-snug">
                      {AR_WEEKDAYS_FULL[today.getDay()]} {today.getDate()}{" "}
                      {AR_MONTHS[today.getMonth()]} {today.getFullYear()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold",
                      todayStatus === "full" &&
                        "bg-emerald-100 text-emerald-700",
                      !todayStatus && "bg-muted text-muted-foreground"
                    )}
                  >
                    {todayStatus === "full" ? "شغلت يوم كامل" : "لسه مسجلش"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    onClick={() => todayKey && markDay(todayKey, "full")}
                    variant={todayStatus === "full" ? "default" : "outline"}
                    className="h-10"
                    aria-label="سجل النهاردة يوم كامل"
                  >
                    شغلت النهاردة
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => todayKey && markDay(todayKey, null)}
                    variant={todayStatus ? "outline" : "secondary"}
                    className="h-10"
                    aria-label="امسح تسجيل النهاردة"
                  >
                    مش شغال
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <Skeleton className="h-[132px] w-full rounded-2xl" />
        )}

        {/* الإحصائيات */}
        {stats && !loading ? (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="grid grid-cols-3 gap-2 sm:gap-3"
            aria-label="إحصائيات الدورة"
          >
            <StatCard
              icon={<BriefcaseBusiness className="size-4" aria-hidden="true" />}
              label="أيام الشغل"
              value={fmtWorked(stats.worked)}
            />
            <StatCard
              icon={<CalendarDays className="size-4" aria-hidden="true" />}
              label="عدّيت"
              value={`${stats.elapsed}`}
            />
            <StatCard
              icon={<TimerReset className="size-4" aria-hidden="true" />}
              label="المتبقي"
              value={`${stats.remaining}`}
            />
          </motion.section>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        )}

        {/* نسبة الحضور */}
        {stats && !loading ? (
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Percent className="size-4" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-bold">نسبة الحضور</p>
                </div>
                <p className="text-lg font-extrabold text-emerald-600">
                  {stats.rate === null ? "—" : `${stats.rate}%`}
                </p>
              </div>
              <Progress
                value={stats.rate ?? 0}
                className="h-2.5 bg-emerald-100"
                aria-label="نسبة الحضور"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {stats.rate === null
                  ? "الدورة دي لسه ما بدأتش"
                  : `حضرت ${fmtWorked(stats.worked)} يوم من ${stats.elapsed} يوم عدّوا`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Skeleton className="h-24 w-full rounded-2xl" />
        )}

        {/* التنقل بين الدورات */}
        <PeriodNav
          badgeText={badgeText}
          badgeClass={badgeClass}
          label={period ? periodLabel(period.start, period.end, startDay) : "..."}
          onPrev={() => setPeriodOffset((o) => o - 1)}
          onNext={() => setPeriodOffset((o) => Math.min(o + 1, 12))}
          nextDisabled={periodOffset >= 12}
        />

        {/* التقويم */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <Card className="shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="mb-2 grid grid-cols-7 gap-1.5 text-center">
                {AR_WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    className="py-1 text-[11px] font-bold text-muted-foreground sm:text-xs"
                  >
                    {w}
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1.5" aria-label="تقويم الدورة">
                  {cells.map((c, idx) =>
                    c === null ? (
                      <div key={`empty-${idx}`} aria-hidden="true" />
                    ) : (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => cycleDay(c.key)}
                        aria-label={`يوم ${c.dayNum} — ${days[c.key] === "full" ? "شغال يوم كامل" : "غير مسجل"}`}
                        aria-pressed={!!days[c.key]}
                        className={cn(
                          "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-bold transition-all active:scale-95",
                          !days[c.key] &&
                            cn(
                              "border border-border bg-white/70 hover:bg-emerald-50",
                              c.isFriday ? "text-rose-400" : "text-foreground"
                            ),
                          days[c.key] === "full" &&
                            "bg-emerald-500 text-white shadow-sm shadow-emerald-500/40",
                          c.isToday && "ring-2 ring-emerald-600 ring-offset-2",
                          c.isFuture && !days[c.key] && "opacity-55",
                          saving[c.key] && "animate-pulse"
                        )}
                      >
                        {days[c.key] === "full" && (
                          <Check
                            className="absolute end-1 top-1 size-3 text-white/90"
                            aria-hidden="true"
                          />
                        )}
                        <span className="leading-none">{c.dayNum}</span>
                        {c.showMonth && (
                          <span className="mt-0.5 text-[9px] font-semibold opacity-70">
                            {c.showMonth}
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}

              {/* المفتاح */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] bg-emerald-500" aria-hidden="true" />
                  يوم شغل
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-3 rounded-[4px] border border-border bg-white"
                    aria-hidden="true"
                  />
                  مش متسجل
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

          </TabsContent>

          {/* تاب المرتب */}
          <TabsContent
            value="salary"
            className="mt-4 focus-visible:outline-none sm:mt-5"
          >
            <div className="flex flex-col gap-4 sm:gap-5">
              <PeriodNav
                badgeText={badgeText}
                badgeClass={badgeClass}
                label={period ? periodLabel(period.start, period.end, startDay) : "..."}
                onPrev={() => setPeriodOffset((o) => o - 1)}
                onNext={() => setPeriodOffset((o) => Math.min(o + 1, 12))}
                nextDisabled={periodOffset >= 12}
              />
              <SalaryTab
                periodStartKey={period ? toKey(period.start) : ""}
                periodEndKey={period ? toKey(period.end) : ""}
                periodLabelText={
                  period ? periodLabel(period.start, period.end, startDay) : "..."
                }
                worked={stats?.worked ?? 0}
                todayKey={todayKey}
                payday={office.payday}
                officeName={office.name}
                paydayText={
                  today
                    ? paydayCountdown(today, office.payday).isToday
                      ? "النهاردة يوم القبض"
                      : `باقي ${paydayCountdown(today, office.payday).daysLeft} يوم على القبض`
                    : ""
                }
              />
            </div>
          </TabsContent>
        </Tabs>
        <Copyright />
      </main>
    </div>
  );
}

// ---------- شريط التنقل بين الدورات (مشترك بين التابين) ----------

// ---------- الصفحة: اختيار المكتب الأول ----------

export default function Home() {
  // undefined = لسه بنقرا من المتصفح، null = لسه ما اختارش مكتب
  const [officeId, setOfficeId] = useState<OfficeId | null | undefined>(undefined);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    setOfficeId(getStoredOffice());
  }, []);

  if (officeId === undefined) return null;

  if (officeId === null || switching) {
    return (
      <OfficePicker
        current={officeId}
        onCancel={officeId ? () => setSwitching(false) : undefined}
        onPick={(id) => {
          adoptLegacyData(id);
          storeOffice(id);
          setOfficeId(id);
          setSwitching(false);
        }}
      />
    );
  }

  // key بيخلي الصفحة تتحمّل من الأول لما المكتب يتغير
  return (
    <Tracker
      key={officeId}
      office={OFFICES[officeId]}
      onSwitch={() => setSwitching(true)}
    />
  );
}

function PeriodNav({
  badgeText,
  badgeClass,
  label,
  onPrev,
  onNext,
  nextDisabled,
}: {
  badgeText: string;
  badgeClass: string;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
    >
      <Card className="shadow-sm">
        <CardContent className="flex items-center justify-between gap-2 p-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 shrink-0"
            onClick={onPrev}
            aria-label="الدورة اللي فاتت"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0 text-center">
            <Badge className={cn("mb-1", badgeClass)} variant="outline">
              {badgeText}
            </Badge>
            <p className="truncate text-base font-extrabold">{label}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 shrink-0"
            onClick={onNext}
            disabled={nextDisabled}
            aria-label="الدورة الجاية"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------- كارت إحصائية صغير ----------

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            {icon}
          </span>
          <p className="text-xs font-bold text-muted-foreground">{label}</p>
        </div>
        <p className="text-2xl font-extrabold leading-none">{value}</p>
      </CardContent>
    </Card>
  );
}
