#!/usr/bin/env python3
"""Read a sabre bout video and write one exchange list for the chosen fencer."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

ACTIONS = [
    "simple attack",
    "attack on the preparation",
    "compound attack",
    "beat attack",
    "counterattack",
    "parry-riposte",
    "remise",
    "point in line",
    "preparation only",
]

SCOREBOARD_ROWS = 0.16


def read_frames(path: str, target_fps: float = 8.0, width: int = 320):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {path}")
    src_fps = cap.get(cv2.CAP_PROP_FPS) or target_fps
    step = max(int(round(src_fps / target_fps)), 1)
    frames = []
    index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if index % step == 0:
            h, w = frame.shape[:2]
            scaled_h = max(int(h * (width / w)), 48)
            frames.append(cv2.resize(frame, (width, scaled_h)))
        index += 1
    cap.release()
    if not frames:
        raise RuntimeError("Video has no frames")
    fps = src_fps / step
    return frames, fps


def bright_mask(frame: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return gray > 150


def track(frames):
    height, width = frames[0].shape[:2]
    board_h = max(int(height * SCOREBOARD_ROWS), 8)
    left_x = []
    right_x = []
    motion = []
    left_board = []
    right_board = []
    prev = None
    for frame in frames:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mask = bright_mask(frame)
        mask[:board_h, :] = False
        mid = width // 2
        left_x.append(_centroid_x(mask[:, :mid], 0))
        right_x.append(_centroid_x(mask[:, mid:], mid))
        board = gray[:board_h]
        left_board.append(float(board[:, : width // 3].mean()))
        right_board.append(float(board[:, -width // 3 :].mean()))
        if prev is None:
            motion.append(0.0)
        else:
            motion.append(float(np.mean(cv2.absdiff(gray, prev))))
        prev = gray
    return {
        "fps": None,
        "left_x": np.array(left_x, dtype=float),
        "right_x": np.array(right_x, dtype=float),
        "motion": np.array(motion, dtype=float),
        "left_board": np.array(left_board, dtype=float),
        "right_board": np.array(right_board, dtype=float),
    }


def _centroid_x(mask: np.ndarray, offset: int):
    ys, xs = np.nonzero(mask)
    if len(xs) < 8:
        return np.nan
    return float(xs.mean() + offset)


def fill_gaps(values: np.ndarray) -> np.ndarray:
    out = values.copy()
    idx = np.arange(len(out))
    good = np.isfinite(out)
    if good.sum() == 0:
        return np.zeros_like(out)
    if good.sum() == 1:
        out[:] = out[good][0]
        return out
    out[~good] = np.interp(idx[~good], idx[good], out[good])
    return out


def segments(track_data, fps: float):
    left = fill_gaps(track_data["left_x"])
    right = fill_gaps(track_data["right_x"])
    body = np.abs(np.diff(left, prepend=left[0])) + np.abs(np.diff(right, prepend=right[0]))
    # A one-frame jump back to en garde is a cut, not part of the exchange.
    body = np.where(body > 25, 0, body)
    speed = body + track_data["motion"] * 0.05
    moving = speed[speed > 0.6]
    if len(moving) < 3:
        return []
    # The fastest frame is often a cut back to en garde, not the exchange itself.
    thresh = max(float(np.median(moving)) * 0.45, 0.7)
    active = speed > thresh
    gap_frames = max(int(0.5 * fps), 1)
    min_frames = max(int(0.4 * fps), 2)
    # Fill short holes inside an exchange.
    i = 0
    while i < len(active):
        if active[i]:
            i += 1
            continue
        j = i
        while j < len(active) and not active[j]:
            j += 1
        left_on = i > 0 and active[i - 1]
        right_on = j < len(active) and active[j]
        if left_on and right_on and (j - i) <= gap_frames:
            active[i:j] = True
        i = j
    spans = []
    i = 0
    while i < len(active):
        if not active[i]:
            i += 1
            continue
        j = i
        while j < len(active) and active[j]:
            j += 1
        if j - i >= min_frames:
            spans.append((i, j))
        i = j
    return spans


def _pulses(speed: np.ndarray) -> int:
    if len(speed) < 3:
        return 1 if np.nanmax(speed) > 0.4 else 0
    positive = speed[speed > 0.4]
    if len(positive) == 0:
        return 0
    thresh = max(float(np.median(positive)) * 0.55, 0.35)
    on = speed > thresh
    count = 0
    prev = False
    for flag in on:
        if flag and not prev:
            count += 1
        prev = bool(flag)
    return count


def classify(feat: dict) -> str:
    chosen = feat["chosen_close"]
    opp = feat["opp_close"]
    early_chosen = feat["early_chosen"]
    early_opp = feat["early_opp"]
    pulses = feat["pulses"]
    if feat["retreat_first"] and feat["late_chosen"] > 0.8:
        return "counterattack"
    if early_opp > 1.2 and early_chosen < early_opp and chosen > 1.0:
        return "attack on the preparation"
    if feat["opponent_led"] and chosen > 0.8 and opp > 0.8:
        return "parry-riposte"
    if pulses >= 2 and chosen > 1.0:
        if feat["first_pulse_small"]:
            return "beat attack"
        if feat["second_pulse_late"] and feat["second_pulse_small"]:
            return "remise"
        return "compound attack"
    if chosen < 6 and opp < 6 and feat["energy"] > 1.5:
        return "point in line"
    if chosen > 1.5:
        return "simple attack"
    return "preparation only"


def features_for(track_data, start, end, side: str) -> dict:
    left_x = fill_gaps(track_data["left_x"][start:end])
    right_x = fill_gaps(track_data["right_x"][start:end])
    if side == "left":
        chosen_x = left_x
        opp_x = right_x
        chosen_sign = 1.0
        opp_sign = -1.0
    else:
        chosen_x = right_x
        opp_x = left_x
        chosen_sign = -1.0
        opp_sign = 1.0
    chosen_step = np.diff(chosen_x, prepend=chosen_x[0]) * chosen_sign
    opp_step = np.diff(opp_x, prepend=opp_x[0]) * opp_sign
    chosen_step = np.where(np.abs(chosen_step) > 25, 0, chosen_step)
    opp_step = np.where(np.abs(opp_step) > 25, 0, opp_step)
    third = max(len(chosen_step) // 3, 1)
    half = max(len(chosen_step) // 2, 1)
    pulses = _pulses(chosen_step)
    first_pulse_small = False
    second_pulse_late = False
    second_pulse_small = False
    if pulses >= 2:
        on = chosen_step > max(float(np.percentile(chosen_step, 70)), 0.35)
        runs = []
        i = 0
        while i < len(on):
            if not on[i]:
                i += 1
                continue
            j = i
            while j < len(on) and on[j]:
                j += 1
            runs.append((i, j, float(chosen_step[i:j].sum())))
            i = j
        if len(runs) >= 2:
            first_pulse_small = runs[0][2] < runs[1][2] * 0.55
            second_pulse_late = runs[1][0] > len(chosen_step) * 0.55
            second_pulse_small = runs[1][2] < runs[0][2] * 0.7
        else:
            second_pulse_small = False
    travel = abs(float(chosen_x[-1] - chosen_x[0]))
    return {
        "chosen_close": float(np.maximum(chosen_step, 0).sum()),
        "opp_close": float(np.maximum(opp_step, 0).sum()),
        "early_chosen": float(np.maximum(chosen_step[:third], 0).sum()),
        "early_opp": float(np.maximum(opp_step[:third], 0).sum()),
        "late_chosen": float(np.maximum(chosen_step[half:], 0).sum()),
        "retreat_first": float(chosen_step[:half].sum()) < -0.8,
        "opponent_led": float(opp_step[:half].sum()) > float(chosen_step[:half].sum()) + 0.8,
        "pulses": pulses,
        "first_pulse_small": first_pulse_small,
        "second_pulse_late": second_pulse_late,
        "second_pulse_small": second_pulse_small,
        "low_travel": travel < 4,
        "energy": float(track_data["motion"][start:end].mean()),
    }


def scoreboard_winner(track_data, start, end):
    before = max(start - 1, 0)
    left_delta = float(track_data["left_board"][start:end].max() - track_data["left_board"][before])
    right_delta = float(track_data["right_board"][start:end].max() - track_data["right_board"][before])
    # A real scoreboard tick is a jump, not a slow lighting change.
    if max(left_delta, right_delta) < 8:
        return None
    if left_delta > right_delta + 6:
        return "left"
    if right_delta > left_delta + 6:
        return "right"
    return None


def visual_winner(feat, side: str):
    chosen = feat["chosen_close"]
    opp = feat["opp_close"]
    if chosen > opp * 1.45 and chosen > 2:
        return side
    other = "right" if side == "left" else "left"
    if opp > chosen * 1.45 and opp > 2:
        return other
    return None


def analyze(video_path: str, side: str, fencer_name: str):
    if side not in ("left", "right"):
        raise RuntimeError("Side must be left or right")
    frames, fps = read_frames(video_path)
    tracked = track(frames)
    spans = segments(tracked, fps)
    other = "the other fencer"
    exchanges = []
    for index, (start, end) in enumerate(spans):
        feat = features_for(tracked, start, end, side)
        action = classify(feat)
        board = scoreboard_winner(tracked, start, end)
        visual = visual_winner(feat, side)
        remark = None
        if board is None:
            if visual == side:
                result = "success"
            elif visual is None:
                result = "neither"
            else:
                result = "failed"
        else:
            result = "success" if board == side else "failed"
            if visual is not None and visual != board:
                who = fencer_name if visual == side else other
                remark = f"This looks like {who}'s point."
        exchanges.append(
            {
                "start": round(start / fps, 2),
                "end": round(end / fps, 2),
                "action": action,
                "result": result,
                "remark": remark,
            }
        )
    return {"exchanges": exchanges, "actions": ACTIONS}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--side", required=True)
    parser.add_argument("--fencer", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = analyze(args.video, args.side, args.fencer)
    Path(args.out).write_text(json.dumps(result), encoding="utf-8")


if __name__ == "__main__":
    main()
