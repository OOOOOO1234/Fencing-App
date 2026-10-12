"use client";

import { useEffect, useRef, useState } from "react";
import { StatsTable } from "./StatsTable";
import { InviteForm } from "./InviteForm";
import { clock, type ActionStat } from "@/lib/stats";

type Exchange = {
  id: string;
  start_sec: number;
  end_sec: number;
  action: string;
  result: "success" | "failed" | "neither";
  remark: string | null;
};

type Payload = {
  video: {
    id: string;
    title: string;
    fencer_name: string;
    fencer_side: string;
    status: "processing" | "ready" | "failed";
    error: string | null;
  };
  exchanges: Exchange[];
  stats: ActionStat[];
  invites: Array<{ invitee_email: string }>;
  canInvite: boolean;
};

const resultLabel = {
  success: "Successful",
  failed: "Didn't work",
  neither: "No touch",
};

export function BoutView({ initial }: { initial: Payload }) {
  const [data, setData] = useState(initial);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (data.video.status !== "processing") return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/videos/${data.video.id}`);
      if (!response.ok) return;
      const next = (await response.json()) as Payload;
      setData(next);
      if (next.video.status !== "processing") clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [data.video.id, data.video.status]);

  function playFrom(start: number) {
    const player = videoRef.current;
    if (!player) return;
    player.currentTime = start;
    void player.play();
  }

  return (
    <>
      <h1>{data.video.title}</h1>
      <p className="lede">
        {data.video.fencer_name} · {data.video.fencer_side} side
      </p>
      <div className="bout">
        <div className="stack">
          <video ref={videoRef} controls src={`/api/videos/${data.video.id}/file`} />
          <p className="status-line">
            {data.video.status === "processing"
              ? "Watching the bout…"
              : data.video.status === "failed"
                ? data.video.error || "Could not read this video."
                : "Tap a row to play that moment."}
          </p>
          {data.video.status === "ready" ? <StatsTable stats={data.stats} /> : null}
        </div>
        <div className="card">
          <h2>Exchanges</h2>
          {data.exchanges.length === 0 ? <p className="muted">None yet.</p> : null}
          {data.exchanges.map((exchange) => (
            <button className="exchange" key={exchange.id} type="button" onClick={() => playFrom(exchange.start_sec)}>
              <strong>
                {clock(exchange.start_sec)} · {exchange.action}
              </strong>
              <span className={exchange.result === "success" ? "good" : exchange.result === "failed" ? "bad" : "quiet"}>
                {resultLabel[exchange.result]}
              </span>
              {exchange.remark ? <p className="remark">{exchange.remark}</p> : null}
            </button>
          ))}
        </div>
      </div>
      {data.canInvite ? (
        <div style={{ marginTop: 16 }}>
          <InviteForm url={`/api/videos/${data.video.id}/invite`} initialEmails={data.invites.map((invite) => invite.invitee_email)} />
        </div>
      ) : null}
    </>
  );
}
