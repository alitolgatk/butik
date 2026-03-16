"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback } from "react";
import { Lock, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GirisPage() {
  const [digits, setDigits] = useState<number[]>([]);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const addDigit = useCallback(
    async (d: number) => {
      if (submitting || digits.length >= 6) return;

      const next = [...digits, d];
      setDigits(next);

      if (next.length === 6) {
        setSubmitting(true);
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin: next.join("") }),
          });

          if (res.ok) {
            window.location.href = "/";
            return;
          }

          setShaking(true);
          setError(true);
          setTimeout(() => {
            setDigits([]);
            setShaking(false);
            setSubmitting(false);
          }, 500);
          setTimeout(() => setError(false), 2000);
        } catch {
          setDigits([]);
          setSubmitting(false);
        }
      }
    },
    [digits, submitting]
  );

  const removeDigit = () => {
    if (submitting) return;
    setDigits((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background px-6">
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes pin-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-10px)}40%,80%{transform:translateX(10px)}}`,
        }}
      />

      {/* Header */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Başak Butik</h1>
      </div>

      {/* Dots */}
      <div
        className="mb-2 flex items-center gap-3"
        style={{
          animation: shaking ? "pin-shake 0.4s ease-in-out" : "none",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 w-4 rounded-full transition-all duration-150",
              i < digits.length
                ? error
                  ? "scale-110 bg-destructive"
                  : "scale-110 bg-primary"
                : "border-2 border-muted-foreground/30 bg-transparent"
            )}
          />
        ))}
      </div>

      {/* Error message */}
      <div className="mb-6 h-6">
        {error && (
          <p className="text-sm font-medium text-destructive">Hatalı PIN</p>
        )}
      </div>

      {/* Numpad */}
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => addDigit(n)}
            className="flex h-16 items-center justify-center rounded-2xl bg-secondary text-xl font-semibold transition-colors active:bg-secondary/70"
          >
            {n}
          </button>
        ))}

        {/* Bottom row: empty, 0, backspace */}
        <div />
        <button
          onClick={() => addDigit(0)}
          className="flex h-16 items-center justify-center rounded-2xl bg-secondary text-xl font-semibold transition-colors active:bg-secondary/70"
        >
          0
        </button>
        <button
          onClick={removeDigit}
          className="flex h-16 items-center justify-center rounded-2xl text-muted-foreground transition-colors active:text-foreground"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
