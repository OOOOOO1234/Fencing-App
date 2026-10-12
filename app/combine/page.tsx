import { redirect } from "next/navigation";
import { CombineForm } from "@/components/CombineForm";
import { SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth";
import { listExchanges, listOwnedVideos } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CombinePage() {
  const user = await currentUser();
  if (!user) redirect("/");
  const videos = listOwnedVideos(user.id).map((video) => ({
    id: video.id,
    title: video.title,
    fencer_name: video.fencer_name,
    status: video.status,
    exchanges: listExchanges(video.id).map((exchange) => ({
      action: exchange.action,
      result: exchange.result,
    })),
  }));
  return (
    <>
      <SiteHeader name={user.name} />
      <h1>Combine bouts</h1>
      <p className="lede">Pick videos for one fencer. Saving them makes a competition playlist with one combined table.</p>
      {videos.length === 0 ? <p className="muted">Upload a bout first.</p> : <CombineForm videos={videos} />}
    </>
  );
}
