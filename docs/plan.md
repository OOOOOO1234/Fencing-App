# Fencing analytics plan (draft)

A website where a fencer uploads bout video and gets Moneyball-style numbers: how often they used each action, how often that action scored, and how often it gave the touch away.

This is a draft. The open questions at the bottom change the data model, the model we train, and which accounts you need to open. Nothing here assumes a generic video API already understands fencing. It does not.

## Decisions

- Audience: a service for everyone. Fencers, coaches, and clubs can each have an account. Video stays private to the uploader and to people they invite.
- Weapon: sabre only. Right of way decides who is awarded the touch. A light on the box is not enough.
- Footage: bouts only. Lessons are not recorded.
- Result: worked means the referee awarded you the touch. Didn't work means the referee awarded the touch to your opponent. If the call was wrong, the phrase keeps the awarded result and adds a side remark. The remark does not change the count.
- No award: when the referee awards the touch to nobody, including a simultaneous attack, the phrase is neither worked nor failed.
- Actions for version one: simple attack, attack on the preparation, compound attack, beat attack, counterattack, parry-riposte, remise, point in line, and preparation only.
- Camera: any setup. Phone beside the strip, a club camera, a tournament stream, or a mix of those can all be uploaded. The first model has to be trained across those setups, so it will need more labeled bouts than a single camera angle would.

## What the product is

Moneyball replaced "he looks like a ballplayer" with "this action produces runs." The fencing version replaces "nice bladework" with a count:

- You attempted this action N times.
- It scored for you on S of those.
- It ended in a touch against you on F of those.
- Net value is S minus F.
- The same numbers, split by the situation (ahead, tied, behind; early in the bout; when you started the phrase vs when they did).

The unit of analysis is a **phrase**: one exchange from "allez" (or the restart) to the halt. Each phrase has an action, an outcome, and optional context. Frames and poses are how we find the phrase. They are not the stat.

## What "worked" means until you say otherwise

Proposed outcome on each phrase:

| Outcome | Meaning |
| --- | --- |
| Point for | You were awarded the touch |
| Point against | Opponent was awarded the touch |
| Double | Both fencers scored (normal in epee; a referee call in foil and sabre) |
| No touch | Halt with no score |
| Unknown | Not labeled yet |

"Worked" is **point for**: the referee awarded you the touch. "Didn't work" is **point against**: the referee awarded the touch to your opponent. A phrase can also carry a side remark when that call was wrong. The remark is visible on the phrase and does not move the touch from one column to the other. When the referee awards the touch to nobody, including a simultaneous attack, the phrase is neither worked nor failed.

Foil and sabre need the **awarded** touch, not the light color alone. Right of way can give the point to the fencer whose light came on second, or to the fencer who attacked into the opponent's preparation. Epee can trust the lights, including doubles. If the score box or scoreboard is not readable in the video, a person confirms who received the point.

## Phases

### Phase 0 — Agree the stat dictionary

Lock the weapon, the action list, and the outcome labels before any model work. A wrong action list means relabeling every video later.

Proposed first action list, shared across weapons, stored with a `weapon` field so foil and sabre rules can be added without a rewrite:

1. Simple attack
2. Attack on the preparation
3. Compound attack (feint, disengage)
4. Beat attack
5. Counterattack / stop-hit
6. Parry-riposte
7. Remise or other second action in the same phrase
8. Point in line
9. Preparation only (footwork or blade setup that does not itself finish)

Fleche, flunge, and named parries (parry 4, parry 6, and so on) wait until the coarse list is producing stats you trust.

### Phase 1 — Upload, label, and compute stats

No custom model. You upload a video, mark phrases on a timeline, and the site computes the table.

For each action:

- Attempts
- Points for, points against, doubles, no-touch
- Success rate (points for / attempts)
- Cost rate (points against / attempts)
- Net touches (for minus against)
- Share of your points that came from that action
- The same split by score state, once score is labeled

This phase is the product. Later models exist to fill the same table with less clicking.

### Phase 2 — Automatic suggestions from a pretrained pose model

Run an existing person-pose model (no fencing training) on the video. Track both fencers. Use pose over time to **suggest** phrase boundaries and a coarse label such as "this looked like a lunge." You correct the suggestion. Corrections are stored as training rows.

Pose models see bodies. They do not see a foil tip, a parry, or a referee's right-of-way call. Phase 2 will be wrong often, on purpose, so your corrections become the dataset.

### Phase 3 — Train a small action model on those corrections

Train a classifier on top of pose sequences (and, if pose is not enough, a blade-tip detector). It predicts the action list from Phase 0. It does not replace outcome labels on foil and sabre until a scoreboard or a person supplies the awarded touch.

### Phase 4 — Situation splits and a written report

Once phrases have a running score, add the Moneyball cuts: efficiency when ahead vs behind, early vs late, your initiative vs theirs. A language-model report is optional and only restates numbers already on screen.

## API keys

Do not create accounts yet. Phase 1 can run locally with no keys. Keys below are the ones this plan would actually use.

### Phase 1 — none

Local web app. Videos stay on disk. Stats come from labels.

### Phase 2 — one hosted project, when you want to upload from another computer

Recommended bundle, so you open one account:

| Key | Where | Why |
| --- | --- | --- |
| Supabase project URL | Supabase project settings | App talks to the database |
| Supabase anon key | Same | Browser client, locked down by row rules |
| Supabase service role key | Same, server only | Trusted server writes (never in the browser) |

That covers accounts, the phrase database, and private video storage. Skip a separate auth vendor, a separate database host, and a separate bucket until Supabase is actually in the way.

### Phase 3 — GPU inference, only after labels exist

| Key | Where | Why |
| --- | --- | --- |
| Modal token | Modal | Run the pose model and, later, the trained classifier on a GPU |

Alternative if you would rather click through a training UI than keep training code in this repo: a Roboflow API key. Pick one of Modal or Roboflow, not both, when we get there.

### Optional later

| Key | When |
| --- | --- |
| OpenAI or Anthropic API key | You want a paragraph scouting report generated from the stat table |
| Stripe secret key and webhook secret | You charge for accounts |
| Sentry DSN | You want error reporting on a public site |

### Skip these

Generic video APIs (Google Cloud Video Intelligence, Amazon Rekognition, Twelve Labs) do not have fencing actions, right of way, or phrase outcomes. A key for one of them would not train the model this app needs.

There is no public fencing-stats API to plug in.

## Training

### What you train by labeling

The scarce input is labeled phrases, not a bigger base model.

Each training row:

- Video id, weapon, camera note
- Start and end time of the phrase
- Which fencer is "you"
- Action from the agreed list
- Outcome (point for, point against, double, no touch)
- Optional: score before the phrase, who started the phrase

A useful coarse classifier usually needs on the order of a few hundred corrected examples of each action you care about, filmed in conditions similar to the videos you will upload later. Named parries, second intention, and messy infighting need more. A consistent side-on camera reduces that number. Mixed phones, streams, and gym angles increase it.

Starter target before we call a model worth turning on: about 30 fully labeled bouts in one weapon, from the camera setup you actually use. If those 30 are short pool bouts, add more until each action in the list has at least a couple hundred examples. We measure that from the labels. We do not guess it is done.

### What we do not train

- The pose model. Use a pretrained one (MediaPipe Pose or RTMPose-class). It already finds bodies.
- A general video-understanding model. Fencing phrases are a small, specific label set.
- Outcome-from-pixels for foil and sabre, until we see that the score box or scoreboard is reliably in frame. Otherwise you keep confirming the touch.

### How training runs

1. You label in the Phase 1 timeline.
2. Pose features are cached per video.
3. A small sequence classifier trains on your labels.
4. The site shows its guess on the next video.
5. You fix the guess. The fix is a new training row.
6. Repeat. The stat table always prefers your label over the model's guess.

Labeling tool for the first batches can be the site's own timeline. A separate tool (CVAT or Label Studio) is only worth it if we have to draw blade-tip points by hand.

### Blade detection is a separate bet

If body pose cannot tell a parry-riposte from a simple attack, the next model is a blade-tip or weapon detector trained on frames you annotate. That is a second dataset (points on frames, not phrase labels). We start that only after Phase 2 shows pose is not enough.

## Suggested first screen

After a video is processed:

- Bout header: weapon, date, opponent (optional), final score
- Action table sorted by attempts, with for / against / net / success rate
- A strip of the bout you can scrub, with phrases marked
- Filters: all phrases, your initiative, their initiative, when the score was close

Comparison to other fencers waits until more than one person has labels. The first baseline is you against your earlier bouts.

## Privacy

Fencing video often includes minors. Default to private video, visible to the account that uploaded it and to a coach they explicitly invite. No public gallery in the first version.

## Open questions

Answer in any order. Where a default is listed, reply "default" to accept it.

1. Who is this for first: you reviewing your own bouts, a coach reviewing students, or a club? Answer: a service for everyone.
2. Which weapon is version one: foil, epee, or sabre? Answer: sabre only.
3. Are the videos bouts, lessons, or both? Default if you only say "bouts": competitive bouts, not lessons. Answer: bouts only. Lessons are not recorded.
4. Is the outcome definition above right (worked = touch awarded to you, didn't work = touch awarded to them)? How should doubles count? Answer: yes for awarded touches. A wrong referee call stays in the count and gets a side remark. A phrase with no awarded touch, including a simultaneous attack, is neither worked nor failed.
5. Is the nine-action list the one you want, or do you want named parries and fleche/flunge in version one? Answer: start with the nine actions above.
6. What camera will the videos come from: phone at the side of the strip, a club camera, a tournament stream, or a mix? Answer: any of those.
7. Is the scoring box or the scoreboard usually visible? For foil and sabre, who confirms right of way: you, a coach, or the video?
8. Do we stat one fencer (the account) or both fencers in the bout?
9. How much footage do you already have, and is any of it already tagged?
10. Who labels the first 30 bouts?
11. How wrong can the automatic labels be before they are annoying? Default: the table always shows confirmed labels, and guesses stay in a review queue.
12. Is upload-and-wait acceptable? Default: yes. Live sideline stats are a later product.
13. Do coaches need a login to see a student's video?
14. Will videos include minors?
15. Any stack you want (or want to avoid)? Default: a web app you can open in a browser, including a phone browser.
16. Should version one compare you only to your past bouts? Default: yes.
