import { redirect } from "next/navigation";
import { PlaylistView } from "@/components/PlaylistView";
import { SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth";
import {
  canAccessPlaylist,
  getPlaylist,
  listExchanges,
  listPlaylistInvites,
  listPlaylistVideos,
} from "@/lib/db";
import { summarize } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const playlist = getPlaylist(id);
  if (!playlist || !canAccessPlaylist(user, playlist)) redirect("/library");
  const videos = listPlaylistVideos(playlist.id);
  const exchanges = videos.flatMap((video) =>
    video.status === "ready"
      ? listExchanges(video.id).map((exchange) => ({ ...exchange, video_title: video.title }))
      : [],
  );
  return (
    <>
      <SiteHeader name={user.name} />
      <PlaylistView
        playlist={playlist}
        videos={videos}
        exchanges={exchanges}
        stats={summarize(exchanges)}
        invites={playlist.owner_id === user.id ? listPlaylistInvites(playlist.id) : []}
        canInvite={playlist.owner_id === user.id}
      />
    </>
  );
}
