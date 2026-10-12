"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StatsTable } from "./StatsTable";
import { summarize } from "@/lib/stats";

type Video = {
  id: string;
  title: string;
  fencer_name: string;
  status: string;
  exchanges: Array<{ action: string; result: string }>;
};

export function CombineForm({ videos }: { videos: Video[] }) {
  const router = useRouter();
  const names = Array.from(new Set(videos.map((video) => video.fencer_name)));
  const [fencer, setFencer] = useState(names[0] ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [competition, setCompetition] = useState("");
  const [error, setError] = useState("");
  const visible = videos.filter((video) => video.fencer_name === fencer && video.status === "ready");
  const selected = visible.filter((video) => picked.includes(video.id));
  const stats = useMemo(
    () => summarize(selected.flatMap((video) => video.exchanges)),
    [selected],
  );

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function savePlaylist() {
    setError("");
    const response = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionName: competition, fencerName: fencer, videoIds: picked }),
    });
    const body = (await response.json()) as { id?: string; error?: string };
    if (!response.ok || !body.id) {
      setError(body.error ?? "Could not save the playlist.");
      return;
    }
    router.push(`/playlists/${body.id}`);
    router.refresh();
  }

  return (
    <div className="stack">
      <label>
        Fencer
        <select
          value={fencer}
          onChange={(event) => {
            setFencer(event.target.value);
            setPicked([]);
          }}
        >
          {names.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <div className="card stack">
        {visible.length === 0 ? <p className="muted">No finished bouts for this fencer.</p> : null}
        {visible.map((video) => (
          <label key={video.id}>
            <span>
              <input type="checkbox" checked={picked.includes(video.id)} onChange={() => toggle(video.id)} /> {video.title}
            </span>
          </label>
        ))}
      </div>
      {picked.length ? <StatsTable stats={stats} /> : null}
      <label>
        Competition name
        <input value={competition} onChange={(event) => setCompetition(event.target.value)} placeholder="Summer Nationals" />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn primary" type="button" onClick={savePlaylist} disabled={picked.length === 0 || !competition.trim()}>
        Save playlist
      </button>
    </div>
  );
}
