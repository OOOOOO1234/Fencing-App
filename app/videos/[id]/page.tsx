import { redirect } from "next/navigation";
import { BoutView } from "@/components/BoutView";
import { SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth";
import { canAccessVideo, getVideo, listExchanges, listVideoInvites } from "@/lib/db";
import { ensureAnalysis } from "@/lib/jobs";
import { summarize } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const video = getVideo(id);
  if (!video || !canAccessVideo(user, video)) redirect("/library");
  if (video.owner_id === user.id) ensureAnalysis(video);
  const fresh = getVideo(id) ?? video;
  const exchanges = listExchanges(fresh.id);
  return (
    <>
      <SiteHeader name={user.name} />
      <BoutView
        initial={{
          video: fresh,
          exchanges,
          stats: summarize(exchanges),
          invites: fresh.owner_id === user.id ? listVideoInvites(fresh.id) : [],
          canInvite: fresh.owner_id === user.id,
        }}
      />
    </>
  );
}
