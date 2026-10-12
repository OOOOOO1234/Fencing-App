import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import {
  addVideoToPlaylist,
  findPlaylist,
  insertPlaylist,
  insertVideo,
  listExchanges,
  listOwnedVideos,
  listSharedVideos,
  videoDir,
} from "@/lib/db";
import { enqueueAnalysis } from "@/lib/jobs";
import { newId } from "@/lib/ids";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;
  const owned = listOwnedVideos(user.id).map((video) => ({
    ...video,
    exchanges: listExchanges(video.id),
  }));
  const shared = listSharedVideos(user.email);
  return NextResponse.json({ owned, shared });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const form = await request.formData();
  const file = form.get("video");
  const fencerName = String(form.get("fencerName") ?? "").trim();
  const side = String(form.get("side") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const competition = String(form.get("competition") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a video." }, { status: 400 });
  }
  if (!fencerName) {
    return NextResponse.json({ error: "Name the fencer." }, { status: 400 });
  }
  if (side !== "left" && side !== "right") {
    return NextResponse.json({ error: "Choose the fencer's side in the video." }, { status: 400 });
  }
  if (file.size > 250 * 1024 * 1024) {
    return NextResponse.json({ error: "Video must be under 250 MB." }, { status: 400 });
  }
  const id = newId();
  const filename = `${id}.mp4`;
  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(videoDir, filename), bytes);
  const video = {
    id,
    owner_id: user.id,
    title: title || file.name.replace(/\.[^.]+$/, "") || "Bout",
    fencer_name: fencerName,
    fencer_side: side as "left" | "right",
    filename,
    status: "processing" as const,
    error: null,
    created_at: new Date().toISOString(),
  };
  insertVideo(video);
  if (competition) {
    let playlist = findPlaylist(user.id, fencerName, competition);
    if (!playlist) {
      playlist = {
        id: newId(),
        owner_id: user.id,
        competition_name: competition,
        fencer_name: fencerName,
        created_at: new Date().toISOString(),
      };
      insertPlaylist(playlist);
    }
    addVideoToPlaylist(playlist.id, video.id);
  }
  enqueueAnalysis(video);
  return NextResponse.json({ id: video.id });
}
