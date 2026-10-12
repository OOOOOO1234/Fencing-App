import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth";
import { getPlaylist, insertInvite, listPlaylistInvites } from "@/lib/db";
import { requireUser } from "@/lib/http";
import { newId } from "@/lib/ids";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await context.params;
  const playlist = getPlaylist(id);
  if (!playlist || playlist.owner_id !== user.id) {
    return NextResponse.json({ error: "That playlist is not available." }, { status: 404 });
  }
  const body = (await request.json()) as { email?: string };
  const email = normalizeEmail(body.email ?? "");
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Enter the coach's email." }, { status: 400 });
  }
  const already = listPlaylistInvites(playlist.id).some((invite) => invite.invitee_email === email);
  if (!already) {
    insertInvite({
      id: newId(),
      owner_id: user.id,
      video_id: null,
      playlist_id: playlist.id,
      invitee_email: email,
    });
  }
  return NextResponse.json({ invites: listPlaylistInvites(playlist.id) });
}
