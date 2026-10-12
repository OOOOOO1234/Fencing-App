import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import {
  canAccessPlaylist,
  getPlaylist,
  listExchanges,
  listPlaylistInvites,
  listPlaylistVideos,
} from "@/lib/db";
import { summarize } from "@/lib/stats";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await context.params;
  const playlist = getPlaylist(id);
  if (!playlist || !canAccessPlaylist(user, playlist)) {
    return NextResponse.json({ error: "That playlist is not available." }, { status: 404 });
  }
  const videos = listPlaylistVideos(playlist.id);
  const exchanges = videos.flatMap((video) =>
    video.status === "ready"
      ? listExchanges(video.id).map((exchange) => ({ ...exchange, video_title: video.title }))
      : [],
  );
  return NextResponse.json({
    playlist,
    videos,
    exchanges,
    stats: summarize(exchanges),
    invites: playlist.owner_id === user.id ? listPlaylistInvites(playlist.id) : [],
    canInvite: playlist.owner_id === user.id,
  });
}
