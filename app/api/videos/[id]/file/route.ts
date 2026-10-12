import fs from "fs";
import { Readable } from "stream";
import { requireUser } from "@/lib/http";
import { canAccessVideo, getVideo, videoPath } from "@/lib/db";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await context.params;
  const video = getVideo(id);
  if (!video || !canAccessVideo(user, video)) {
    return new Response("Not found", { status: 404 });
  }
  const file = videoPath(video);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const size = fs.statSync(file).size;
  const range = request.headers.get("range");
  if (!range) {
    const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private",
      },
    });
  }
  const match = /bytes=(\d+)-(\d*)/.exec(range);
  if (!match) return new Response("Bad range", { status: 416 });
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (start >= size || end >= size || start > end) {
    return new Response("Bad range", { status: 416 });
  }
  const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
  return new Response(stream, {
    status: 206,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private",
    },
  });
}
