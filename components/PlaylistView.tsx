"use client";

import { useRef, useState } from "react";
import { InviteForm } from "./InviteForm";
import { StatsTable } from "./StatsTable";
import { clock, type ActionStat } from "@/lib/stats";

type Exchange = {
  id: string;
  video_id: string;
  start_sec: number;
  action: string;
  result: "success" | "failed" | "neither";
  remark: string | null;
  video_title?: string;
};

type Video = { id: string; title: string; status: string };

const resultLabel = {
  success: "Successful",
  failed: "Didn't work",
  neither: "No touch",
};

export function PlaylistView({
  playlist,
  videos,
  exchanges,
  stats,
  invites,
  canInvite,
}: {
  playlist: { id: string; competition_name: string; fencer_name: string };
  videos: Video[];
  exchanges: Exchange[];
  stats: ActionStat[];
  invites: Array<{ invitee_email: string }>;
  canInvite: boolean;
}) {
  const player = useRef<HTMLVideoElement>(null);
  const [videoId, setVideoId] = useState(videos[0]?.id ?? "");
  const pendingSeek = useRef<number | null>(null);

  function play(exchange: Exchange) {
    const element = player.current;
    if (!element) return;
    if (exchange.video_id !== videoId) {
      pendingSeek.current = exchange.start_sec;
      setVideoId(exchange.video_id);
      return;
    }
    element.currentTime = exchange.start_sec;
    void element.play();
  }

  return (
    <>
      <h1>{playlist.competition_name}</h1>
      <p className="lede">{playlist.fencer_name} · combined stats for every bout in this playlist</p>
      <div className="bout">
        <div className="stack">
          {videoId ? (
            <video
              ref={player}
              controls
              src={`/api/videos/${videoId}/file`}
              onLoadedMetadata={(event) => {
                if (pendingSeek.current == null) return;
                event.currentTarget.currentTime = pendingSeek.current;
                pendingSeek.current = null;
                void event.currentTarget.play();
              }}
            />
          ) : (
            <p className="muted">No videos in this playlist.</p>
          )}
          <StatsTable stats={stats} />
        </div>
        <div className="card">
          <h2>Exchanges</h2>
          {videos.some((video) => video.status === "processing") ? <p className="muted">One bout is still being watched.</p> : null}
          {exchanges.map((exchange) => (
            <button className="exchange" key={exchange.id} type="button" onClick={() => play(exchange)}>
              <strong>
                {clock(exchange.start_sec)} · {exchange.action}
              </strong>
              <span className="muted">{exchange.video_title}</span>
              <span className={exchange.result === "success" ? "good" : exchange.result === "failed" ? "bad" : "quiet"}>
                {" "}
                {resultLabel[exchange.result]}
              </span>
              {exchange.remark ? <p className="remark">{exchange.remark}</p> : null}
            </button>
          ))}
        </div>
      </div>
      {canInvite ? (
        <div style={{ marginTop: 16 }}>
          <InviteForm
            url={`/api/playlists/${playlist.id}/invite`}
            initialEmails={invites.map((invite) => invite.invitee_email)}
          />
        </div>
      ) : null}
    </>
  );
}
