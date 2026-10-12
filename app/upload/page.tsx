import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { UploadForm } from "@/components/UploadForm";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  return (
    <>
      <SiteHeader name={user.name} />
      <h1>Upload a bout</h1>
      <p className="lede">The site watches the video, then shows the stats. You do not have to name the actions.</p>
      <UploadForm />
    </>
  );
}
