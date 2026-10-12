import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  if (user) redirect("/library");
  return (
    <>
      <SiteHeader />
      <section className="hero">
        <div>
          <h1>How often the action worked.</h1>
          <p className="lede">
            Upload a sabre bout. The site watches it, then shows how many times each action was attempted and how many times it scored.
          </p>
        </div>
        <AuthForm />
      </section>
    </>
  );
}
