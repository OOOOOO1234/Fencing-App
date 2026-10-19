/**
 * FIE-style rules checker (t.100–106 spirit).
 * Hands win for outcome; speech/vision propose actions; contradictions → needsReview.
 */

import type { ActionName, FencerSide, Outcome, Phrase, RefGesture } from '../../types'

function isRenewal(action: ActionName | undefined): boolean {
  return action === 'Remise' || action === 'Redoublement' || action === 'Reprise'
}

/** Map clear hand award to outcome relative to the user's side. */
export function outcomeFromGesture(
  gesture: RefGesture | undefined,
  _side: FencerSide,
): Outcome | null {
  if (!gesture || gesture === 'unknown' || gesture === 'attack' || gesture === 'parry') {
    return null
  }
  if (gesture === 'hand_you') return 'point_for'
  if (gesture === 'hand_them') return 'point_against'
  if (gesture === 'simultaneous' || gesture === 'nothing' || gesture === 'incorrect') {
    return 'no_touch'
  }
  return null
}

/**
 * Apply deterministic checks. Does not invent awards when hands are unclear.
 */
export function applyPhraseRules(phrases: Phrase[], side: FencerSide): Phrase[] {
  return phrases.map((phrase) => {
    const sources = new Set(phrase.sources ?? [])
    let outcome = phrase.outcome
    let action = phrase.action
    let opponentAction = phrase.opponentAction
    let needsReview = phrase.needsReview ?? false
    const flags: string[] = []

    const fromHands = outcomeFromGesture(phrase.refGesture, side)
    if (fromHands) {
      if (outcome !== fromHands) {
        flags.push(`outcome→${fromHands} (hands)`)
        outcome = fromHands
      }
      sources.add('hands')
      sources.add('rules')
    }

    // Simultaneous / nothing should not stay as scored doubles unless edited.
    if (
      (phrase.refGesture === 'simultaneous' || phrase.refGesture === 'nothing') &&
      (outcome === 'point_for' || outcome === 'point_against' || outcome === 'double') &&
      !phrase.edited
    ) {
      outcome = 'no_touch'
      sources.add('rules')
      flags.push('simul/nothing→no_touch')
    }

    // Remise/redouble vs awarded riposte side: flag, don't silently invent.
    if (
      outcome === 'point_against' &&
      isRenewal(action) &&
      (opponentAction === 'Riposte' ||
        opponentAction === 'Parry-riposte' ||
        opponentAction === 'Counter-riposte')
    ) {
      needsReview = true
      flags.push('renewal vs riposte award')
      sources.add('rules')
    }

    if (
      outcome === 'point_for' &&
      isRenewal(opponentAction) &&
      (action === 'Riposte' || action === 'Parry-riposte' || action === 'Counter-riposte')
    ) {
      // Consistent with immediate riposte beating renewal — ok
      sources.add('rules')
    }

    // Speech said Simultaneous but scored — flag
    if (
      phrase.refWords &&
      /\bsimultaneous\b/i.test(phrase.refWords) &&
      outcome !== 'no_touch' &&
      !phrase.edited
    ) {
      needsReview = true
      flags.push('speech simul vs score')
      sources.add('rules')
    }

    const remarkExtra = flags.length ? `Rules: ${flags.join('; ')}` : undefined
    return {
      ...phrase,
      action,
      opponentAction,
      outcome,
      needsReview,
      sources: [...sources],
      remark: remarkExtra
        ? phrase.remark
          ? `${phrase.remark} · ${remarkExtra}`
          : remarkExtra
        : phrase.remark,
    }
  })
}
