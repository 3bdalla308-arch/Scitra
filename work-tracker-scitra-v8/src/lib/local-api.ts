// API محلي: كل البيانات بتتحفظ في المتصفح (localStorage) فالتطبيق يشتغل بدون إنترنت.
// نفس شكل الردود بتاعة /api/* القديمة، فباقي الكود ما اتغيرش.

// كل مكتب له بياناته المنفصلة: wt:<المكتب>:days / entries / wage
const DAYS_KEY = "days"; // { "2026-10-13": "full" }
const ENTRIES_KEY = "entries"; // حركات المرتب
const WAGE_KEY = "wage"; // الأجر اليومي

const fullKey = (name: string) => {
  let office = "default";
  try {
    office = localStorage.getItem("wt:office") || "default";
  } catch {}
  return `wt:${office}:${name}`;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ["advance", "deduction", "bonus"];

type StoredEntry = {
  id: string;
  date: string;
  type: string;
  amount: number;
  note: string | null;
  createdAt: number;
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(fullKey(key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(fullKey(key), JSON.stringify(value));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// ---------- بديل fetch للـ /api/* ----------
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input, "http://local");
  const method = (init.method ?? "GET").toUpperCase();
  const q = url.searchParams;
  let body: Record<string, unknown> = {};
  if (typeof init.body === "string") {
    try {
      body = JSON.parse(init.body);
    } catch {
      return json({ error: "bad body" }, 400);
    }
  }

  try {
    switch (url.pathname) {
      case "/api/days": {
        const days = read<Record<string, string>>(DAYS_KEY, {});
        if (method === "GET") {
          const start = q.get("start");
          const end = q.get("end");
          if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
            return json({ error: "bad range" }, 400);
          }
          const rows = Object.keys(days)
            .filter((d) => d >= start && d <= end)
            .sort()
            .map((date) => ({ date, status: days[date] }));
          return json({ days: rows });
        }
        if (method === "POST") {
          const date = body.date;
          const status = body.status;
          if (typeof date !== "string" || !DATE_RE.test(date)) return json({ error: "bad date" }, 400);
          if (status !== "full" && status !== "none") return json({ error: "bad status" }, 400);
          if (status === "none") delete days[date];
          else days[date] = "full";
          write(DAYS_KEY, days);
          return json({ date, status });
        }
        break;
      }

      case "/api/settings": {
        if (method === "GET") {
          return json({ dailyWage: read<number | null>(WAGE_KEY, null) });
        }
        if (method === "PUT") {
          const wage = body.dailyWage;
          if (typeof wage !== "number" || !isFinite(wage) || wage < 0 || wage > 1_000_000) {
            return json({ error: "bad wage" }, 400);
          }
          write(WAGE_KEY, wage);
          return json({ dailyWage: wage });
        }
        break;
      }

      case "/api/salary": {
        const all = read<StoredEntry[]>(ENTRIES_KEY, []);
        if (method === "GET") {
          const start = q.get("start");
          const end = q.get("end");
          if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
            return json({ error: "bad range" }, 400);
          }
          const rows = all
            .filter((x) => x.date >= start && x.date <= end)
            .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
            .map(({ id, date, type, amount, note }) => ({ id, date, type, amount, note }));
          return json({ entries: rows });
        }
        if (method === "POST") {
          const { date, type, amount } = body;
          const note =
            typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 200) : null;
          if (typeof date !== "string" || !DATE_RE.test(date)) return json({ error: "bad date" }, 400);
          if (typeof type !== "string" || !TYPES.includes(type)) return json({ error: "bad type" }, 400);
          if (typeof amount !== "number" || !isFinite(amount) || amount <= 0 || amount > 10_000_000) {
            return json({ error: "bad amount" }, 400);
          }
          const entry: StoredEntry = { id: newId(), date, type, amount, note, createdAt: Date.now() };
          all.push(entry);
          write(ENTRIES_KEY, all);
          return json({ id: entry.id, date, type, amount, note });
        }
        if (method === "DELETE") {
          const id = q.get("id");
          if (!id) return json({ error: "bad id" }, 400);
          write(ENTRIES_KEY, all.filter((x) => x.id !== id));
          return json({ ok: true });
        }
        break;
      }
    }
    return json({ error: "not found" }, 404);
  } catch {
    return json({ error: "storage failed" }, 500);
  }
}
