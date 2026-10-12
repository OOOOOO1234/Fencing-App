"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm() {
  const router = useRouter();
  const [side, setSide] = useState<"left" | "right">("left");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("side", side);
    const response = await fetch("/api/videos", { method: "POST", body: form });
    const body = (await response.json()) as { id?: string; error?: string };
    setPending(false);
    if (!response.ok || !body.id) {
      setError(body.error ?? "Upload failed.");
      return;
    }
    router.push(`/videos/${body.id}`);
    router.refresh();
  }

  async function loadSample() {
    setError("");
    setPending(true);
    const response = await fetch("/api/sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fencerName: "Alex" }),
    });
    const body = (await response.json()) as { id?: string; error?: string };
    setPending(false);
    if (!response.ok || !body.id) {
      setError(body.error ?? "Sample failed.");
      return;
    }
    router.push(`/videos/${body.id}`);
    router.refresh();
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <label>
        Video
        <input name="video" type="file" accept="video/*" required />
      </label>
      <label>
        Fencer
        <input name="fencerName" placeholder="Who are the stats for?" required />
      </label>
      <div>
        <div className="muted">Which side are they on in the video?</div>
        <div className="choices" style={{ marginTop: 8 }}>
          <button className={side === "left" ? "on" : ""} type="button" onClick={() => setSide("left")}>
            Left
          </button>
          <button className={side === "right" ? "on" : ""} type="button" onClick={() => setSide("right")}>
            Right
          </button>
        </div>
      </div>
      <label>
        Title
        <input name="title" placeholder="Optional" />
      </label>
      <label>
        Competition playlist
        <input name="competition" placeholder="Optional, for example Summer Nationals" />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Upload and watch"}
      </button>
      <button className="btn" type="button" onClick={loadSample} disabled={pending}>
        Use a sample bout
      </button>
    </form>
  );
}
