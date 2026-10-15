"use client";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <ToastPrimitive.Provider duration={3500} swipeDirection="right">
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          open={t.open}
          duration={t.duration}
          onOpenChange={(o) => !o && dismiss(t.id)}
          className={cn(
            "pointer-events-auto relative flex w-full flex-col gap-1 rounded-lg border p-4 pe-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full",
            t.variant === "destructive"
              ? "border-destructive bg-destructive text-white"
              : "border bg-background text-foreground"
          )}
        >
          {t.title && <ToastPrimitive.Title className="text-sm font-semibold">{t.title}</ToastPrimitive.Title>}
          {t.description && (
            <ToastPrimitive.Description className="text-sm opacity-90">{t.description}</ToastPrimitive.Description>
          )}
          {t.action && (
            <ToastPrimitive.Action
              altText={t.action.label}
              onClick={t.action.onClick}
              className="mt-1 self-start rounded-md border border-current/30 bg-black/5 px-3 py-1 text-sm font-bold transition active:scale-95"
            >
              {t.action.label}
            </ToastPrimitive.Action>
          )}
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed top-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:top-auto sm:bottom-0 sm:end-0 sm:max-w-[420px]" />
    </ToastPrimitive.Provider>
  );
}
