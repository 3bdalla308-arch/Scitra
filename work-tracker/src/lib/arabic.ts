// ثوابت ومساعدات عربية مشتركة بين أجزاء التطبيق

export const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export const AR_MONTHS_SHORT = [
  "ينا", "فبر", "مار", "أبر", "ماي", "يون",
  "يول", "أغس", "سبت", "أكت", "نوف", "ديس",
];

export const AR_WEEKDAYS = ["سبت", "أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];

export const AR_WEEKDAYS_FULL = [
  "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];

// يوم القبض من كل شهر
export const PAYDAY = 28;

// عداد الأيام لحد يوم القبض
export function paydayCountdown(today: Date, payday: number = PAYDAY): {
  isToday: boolean;
  daysLeft: number;
} {
  const d = today.getDate();
  if (d === payday) return { isToday: true, daysLeft: 0 };
  if (d < payday) return { isToday: false, daysLeft: payday - d };
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();
  return { isToday: false, daysLeft: daysInMonth - d + payday };
}

// تحويل تاريخ لمفتاح YYYY-MM-DD بالتوقيت المحلي
export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "2026-10-13" → "13 أكتوبر"
export function fmtDateShort(key: string): string {
  const parts = key.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return key;
  return `${d} ${AR_MONTHS[m - 1]}`;
}

// تنسيق المبالغ بالجنيه المصري بأرقام لاتينية للقراءة السريعة
export function fmtMoney(n: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)} ج.م`;
}

// عرض عدد أيام الشغل مع كسور النصف يوم (12½)
export function fmtWorked(w: number): string {
  const i = Math.floor(w);
  return w % 1 === 0 ? `${i}` : `${i}½`;
}
