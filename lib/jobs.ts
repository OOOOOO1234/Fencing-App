import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { getVideo, replaceExchanges, setVideoStatus, videoPath, type Video } from "./db";

const running = new Set<string>();

type AnalyzerExchange = {
  start: number;
  end: number;
  action: string;
  result: "success" | "failed" | "neither";
  remark: string | null;
};

export function enqueueAnalysis(video: Video) {
  if (running.has(video.id) || video.status === "ready") return;
  running.add(video.id);
  const outPath = path.join(path.dirname(videoPath(video)), `${video.id}.json`);
  const child = spawn(
    "python3",
    [
      path.join(process.cwd(), "analyzer", "analyze.py"),
      "--video",
      videoPath(video),
      "--side",
      video.fencer_side,
      "--fencer",
      video.fencer_name,
      "--out",
      outPath,
    ],
    { cwd: process.cwd() },
  );
  let errorText = "";
  child.stderr.on("data", (chunk) => {
    errorText += String(chunk);
  });
  child.on("close", (code) => {
    running.delete(video.id);
    const current = getVideo(video.id);
    if (!current) return;
    if (code !== 0) {
      setVideoStatus(video.id, "failed", errorText.slice(-500) || "The video could not be read.");
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(outPath, "utf8")) as { exchanges: AnalyzerExchange[] };
      replaceExchanges(
        video.id,
        parsed.exchanges.map((exchange) => ({
          id: randomBytes(8).toString("hex"),
          start_sec: exchange.start,
          end_sec: exchange.end,
          action: exchange.action,
          result: exchange.result,
          remark: exchange.remark,
        })),
      );
      setVideoStatus(video.id, "ready", null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The stats could not be saved.";
      setVideoStatus(video.id, "failed", message);
    }
  });
}

export function ensureAnalysis(video: Video) {
  if (video.status === "processing") enqueueAnalysis(video);
}
