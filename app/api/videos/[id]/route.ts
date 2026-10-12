import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import { canAccessVideo, getVideo, listExchanges, listVideoInvites } from "@/lib/db";
import { ensureAnalysis } from "@/lib/jobs";
import { summarize } from "@/lib/stats";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await context.params;
  const video = getVideo(id);
  if (!video || !canAccessVideo(user, video)) {
    return NextResponse.json({ error: "That bout is not available." }, { status: 404 });
  }
  if (video.owner_id === user.id) ensureAnalysis(video);
  const exchanges = listExchanges(video.id);
  return NextResponse.json({
    video,
    exchanges,
    stats: summarize(exchanges),
    invites: video.owner_id === user.id ? listVideoInvites(video.id) : [],
    canInvite: video.owner_id === user.id,
  });
}
