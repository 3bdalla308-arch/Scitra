// المكاتب: كل مكتب له نظامه (يوم قفل الشهر + يوم القبض)
export type OfficeId = "unica" | "masria";

export type Office = {
  id: OfficeId;
  name: string;
  cycleStartDay: number; // الدورة بتبدأ اليوم ده وبتخلص قبله بيوم في الشهر اللي بعده
  payday: number; // يوم القبض من كل شهر
};

export const OFFICES: Record<OfficeId, Office> = {
  unica: { id: "unica", name: "يونيكا", cycleStartDay: 20, payday: 28 },
  masria: { id: "masria", name: "المصرية", cycleStartDay: 15, payday: 28 },
};

export const OFFICE_LIST: Office[] = [OFFICES.unica, OFFICES.masria];

const OFFICE_KEY = "wt:office";

export function getStoredOffice(): OfficeId | null {
  try {
    const v = localStorage.getItem(OFFICE_KEY);
    return v === "unica" || v === "masria" ? v : null;
  } catch {
    return null;
  }
}

export function storeOffice(id: OfficeId) {
  try {
    localStorage.setItem(OFFICE_KEY, id);
  } catch {}
}

// بيانات النسخة القديمة (قبل المكاتب) تروح للمكتب اللي اتختار أول مرة
export function adoptLegacyData(id: OfficeId) {
  try {
    for (const name of ["days", "entries", "wage"]) {
      const legacy = localStorage.getItem(`wt:${name}`);
      const target = `wt:${id}:${name}`;
      if (legacy !== null && localStorage.getItem(target) === null) {
        localStorage.setItem(target, legacy);
      }
      // تروح لأول مكتب بس، ومتتكررش في المكتب التاني
      if (legacy !== null) localStorage.removeItem(`wt:${name}`);
    }
  } catch {}
}
