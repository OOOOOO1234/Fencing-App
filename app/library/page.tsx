import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth";
import { listOwnedPlaylists, listOwnedVideos, listSharedPlaylists, listSharedVideos } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  const videos = listOwnedVideos(user.id);
  const shared = listSharedVideos(user.email);
  const playlists = listOwnedPlaylists(user.id);
  const sharedPlaylists = listSharedPlaylists(user.email);
  return (
    <>
      <SiteHeader name={user.name} />
      <h1>Your bouts</h1>
      <p className="lede">Each video gets its own stats. Group one fencer’s bouts into a competition playlist to add them together.</p>
      <p>
        <Link className="btn primary" href="/upload">Upload a bout</Link>
      </p>
      <div className="grid">
        {videos.map((video) => (
          <Link className="card list-card" key={video.id} href={`/videos/${video.id}`}>
            <h2>{video.title}</h2>
            <p className="muted">{video.fencer_name} · {video.fencer_side} side</p>
            <p>{video.status === "processing" ? "Watching the bout…" : video.status === "failed" ? "Could not read this video" : "Stats ready"}</p>
          </Link>
        ))}
        {videos.length === 0 ? <p className="muted">No videos yet.</p> : null}
      </div>
      <h2 className="section-title">Competitions</h2>
      <div className="grid">
        {playlists.map((playlist) => (
          <Link className="card list-card" key={playlist.id} href={`/playlists/${playlist.id}`}>
            <h2>{playlist.competition_name}</h2>
            <p className="muted">{playlist.fencer_name}</p>
          </Link>
        ))}
        {playlists.length === 0 ? <p className="muted">No playlists yet.</p> : null}
      </div>
      {shared.length || sharedPlaylists.length ? <h2 className="section-title">Shared with you</h2> : null}
      <div className="grid">
        {shared.map((video) => (
          <Link className="card list-card" key={video.id} href={`/videos/${video.id}`}>
            <h2>{video.title}</h2>
            <p className="muted">{video.fencer_name}</p>
          </Link>
        ))}
        {sharedPlaylists.map((playlist) => (
          <Link className="card list-card" key={playlist.id} href={`/playlists/${playlist.id}`}>
            <h2>{playlist.competition_name}</h2>
            <p className="muted">{playlist.fencer_name}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
