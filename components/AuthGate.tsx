"use client";

import { useEffect, useState } from "react";

const authStorageKey = "videoproduk_auth_ok";
const lastActiveStorageKey = "videoproduk_last_active";
const idleTimeoutMs = 15 * 60 * 1000;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(authStorageKey);
    const lastActive = Number(localStorage.getItem(lastActiveStorageKey) || 0);
    const stillFresh = Date.now() - lastActive < idleTimeoutMs;
    const isAllowed = stored === "true" && stillFresh;

    if (!isAllowed) {
      localStorage.removeItem(authStorageKey);
      localStorage.removeItem(lastActiveStorageKey);
    }

    setAllowed(isAllowed);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    function refreshActivity() {
      localStorage.setItem(lastActiveStorageKey, String(Date.now()));
    }

    function expireIfIdle() {
      const lastActive = Number(localStorage.getItem(lastActiveStorageKey) || 0);

      if (Date.now() - lastActive >= idleTimeoutMs) {
        localStorage.removeItem(authStorageKey);
        localStorage.removeItem(lastActiveStorageKey);
        setAllowed(false);
        setPassword("");
      }
    }

    refreshActivity();

    const events = ["click", "keydown", "mousemove", "touchstart", "scroll"];
    events.forEach((eventName) =>
      window.addEventListener(eventName, refreshActivity, { passive: true })
    );
    const timer = window.setInterval(expireIfIdle, 30_000);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, refreshActivity)
      );
      window.clearInterval(timer);
    };
  }, [allowed]);

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        setError(data?.error || "Password salah.");
        return;
      }

      localStorage.setItem(authStorageKey, "true");
      localStorage.setItem(lastActiveStorageKey, String(Date.now()));
      setAllowed(true);

      if (window.location.pathname === "/") {
        window.location.href = "/upload";
      }
      return;
    } catch {
      setError("Login gagal. Cuba lagi.");
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <p className="text-sm font-black text-white">Sila tunggu</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <form
          onSubmit={submitPassword}
          className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-glow"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Login
          </p>
          <h1 className="mt-2 text-2xl font-black text-white">
            Masukkan password.
          </h1>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="mt-5 min-h-12 w-full rounded-2xl border border-border bg-black/30 px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-primary"
          />
          {error ? (
            <p className="mt-3 text-sm font-bold text-red-200">{error}</p>
          ) : null}
          <button
            type="submit"
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow"
          >
            Masuk
          </button>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
