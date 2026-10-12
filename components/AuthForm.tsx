"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "Could not sign in.");
      return;
    }
    router.push("/library");
    router.refresh();
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <div className="choices">
        <button className={mode === "signup" ? "on" : ""} type="button" onClick={() => setMode("signup")}>
          Create account
        </button>
        <button className={mode === "login" ? "on" : ""} type="button" onClick={() => setMode("login")}>
          Log in
        </button>
      </div>
      {mode === "signup" ? (
        <label>
          Name
          <input name="name" autoComplete="name" required />
        </label>
      ) : null}
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
