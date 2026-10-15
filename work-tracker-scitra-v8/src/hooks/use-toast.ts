"use client";
import { useEffect, useState } from "react";

export type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
  action?: { label: string; onClick: () => void };
};
type ToastItem = ToastInput & { id: string; open: boolean };

let items: ToastItem[] = [];
const listeners = new Set<(t: ToastItem[]) => void>();
let counter = 0;
const emit = () => listeners.forEach((l) => l(items));

function dismiss(id: string) {
  items = items.map((t) => (t.id === id ? { ...t, open: false } : t));
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 400);
}

function toast(input: ToastInput) {
  const id = String(++counter);
  items = [...items.slice(-2), { ...input, id, open: true }];
  emit();
  return { id, dismiss: () => dismiss(id) };
}

export function useToast() {
  const [state, setState] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return { toasts: state, toast, dismiss };
}
