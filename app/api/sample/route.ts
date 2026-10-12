import path from "path";
import { spawn } from "child_process";
import { NextResponse } from "next/server";
import { insertVideo, videoDir } from "@/lib/db";
import { requireUser } from "@/lib/http";
import { enqueueAnalysis } from "@/lib/jobs";
import { newId } from "@/lib/ids";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const body = (await request.json().catch(() => ({}))) as { fencerName?: string };
  const fencerName = body.fencerName?.trim() || "Alex";
  const id = newId();
  const filename = `${id}.mp4`;
  const destination = path.join(videoDir, filename);
  const code = await new Promise<number>((resolve) => {
    const child = spawn("python3", [path.join(process.cwd(), "analyzer", "sample_bout.py"), destination]);
    child.on("close", (status) => resolve(status ?? 1));
  });
  if (code !== 0) {
    return NextResponse.json({ error: "The sample bout could not be made." }, { status: 500 });
  }
  const video = {
    id,
    owner_id: user.id,
    title: "Sample bout",
    fencer_name: fencerName,
    fencer_side: "left" as const,
    filename,
    status: "processing" as const,
    error: null,
    created_at: new Date().toISOString(),
  };
  insertVideo(video);
  enqueueAnalysis(video);
  return NextResponse.json({ id });
}
