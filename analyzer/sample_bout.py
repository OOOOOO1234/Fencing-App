#!/usr/bin/env python3
"""Write a short side-on sabre bout the site can analyze and a browser can play."""

import subprocess
import sys
from pathlib import Path

import numpy as np


def write_bout(path: Path):
    width, height, fps = 320, 180, 8
    seconds = 14
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-s",
        f"{width}x{height}",
        "-r",
        str(fps),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(path),
    ]
    process = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    assert process.stdin is not None
    for n in range(seconds * fps):
        t = n / fps
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:, :] = (30, 50, 30)
        frame[:28, :] = (10, 10, 10)
        left_x = 70
        right_x = 230
        left_score = False
        right_score = False
        if 0.4 <= t < 2.2:
            left_x = int(70 + (t - 0.4) / 1.8 * 70)
            left_score = t >= 1.8
        elif 3.2 <= t < 5.6:
            local = t - 3.2
            if local < 0.8:
                left_x = int(70 + local / 0.8 * 30)
            elif local < 1.05:
                left_x = 100
            else:
                left_x = int(100 + (local - 1.05) / 1.35 * 50)
            left_score = t >= 5.2
        elif 6.6 <= t < 8.8:
            local = t - 6.6
            if local < 0.8:
                left_x = int(90 - local / 0.8 * 25)
                right_x = int(230 - local / 0.8 * 20)
            else:
                left_x = int(65 + (local - 0.8) / 1.4 * 55)
            right_score = t >= 8.4
        elif 9.8 <= t < 11.6:
            local = t - 9.8
            if local < 0.7:
                right_x = int(240 - local / 0.7 * 40)
                left_x = 75
            else:
                left_x = int(75 + (local - 0.7) / 1.1 * 60)
                right_x = 200
            left_score = t >= 11.2
        elif 12.9 <= t < 13.8:
            local = t - 12.9
            left_x = int(80 + min(local, 0.7) / 0.7 * 28)
            right_x = int(230 - min(local, 0.7) / 0.7 * 28)
        if left_score:
            frame[6:22, 16:36] = (255, 255, 255)
        if right_score:
            frame[6:22, 284:304] = (255, 255, 255)
        frame[70:150, left_x : left_x + 28] = (230, 230, 230)
        frame[70:150, right_x : right_x + 28] = (230, 230, 230)
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    error = process.stderr.read().decode() if process.stderr else ""
    if process.stderr:
        process.stderr.close()
    code = process.wait()
    if code != 0:
        raise RuntimeError(error[-500:])


if __name__ == "__main__":
    write_bout(Path(sys.argv[1]))
