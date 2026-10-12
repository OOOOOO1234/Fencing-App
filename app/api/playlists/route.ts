import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import { addVideoToPlaylist, getVideo, insertPlaylist, listOwnedPlaylists, listSharedPlaylists } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;
  return NextResponse.json({
    owned: listOwnedPlaylists(user.id),
    shared: listSharedPlaylists(user.email),
  });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = (await request.json()) as {
    competitionName?: string;
    fencerName?: string;
    videoIds?: string[];
  };
  const competitionName = body.competitionName?.trim() ?? "";
  const fencerName = body.fencerName?.trim() ?? "";
  const videoIds = body.videoIds ?? [];
  if (!competitionName || !fencerName || videoIds.length === 0) {
    return NextResponse.json({ error: "Name the competition and pick at least one video." }, { status: 400 });
  }
  for (const videoId of videoIds) {
    const video = getVideo(videoId);
    if (!video || video.owner_id !== user.id) {
      return NextResponse.json({ error: "One of those videos is not yours." }, { status: 400 });
    }
    if (video.fencer_name !== fencerName) {
      return NextResponse.json({ error: "A playlist is for one fencer." }, { status: 400 });
    }
  }
  const playlist = {
    id: newId(),
    owner_id: user.id,
    competition_name: competitionName,
    fencer_name: fencerName,
    created_at: new Date().toISOString(),
  };
  insertPlaylist(playlist);
  for (const videoId of videoIds) addVideoToPlaylist(playlist.id, videoId);
  return NextResponse.json({ id: playlist.id });
}
