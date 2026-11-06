/**
 * A statement's standing at the publication boundary, in words, so the
 * outline, the transcript, and the status bar all agree with publicClone.
 */

import { hasRestrictingLabel, type Statement } from '../core'

export interface PublishState {
  /** True when the statement would cross the consent boundary as it stands. */
  publishes: boolean
  /** The first reason it would not, or "Public". */
  word: string
}

export function publishState(st: Statement): PublishState {
  if (st.consent === 'embargoed') return { publishes: false, word: 'Embargoed' }
  if (st.consent === 'restricted') return { publishes: false, word: 'Restricted' }
  if (hasRestrictingLabel(st.sovereignty)) return { publishes: false, word: 'Label' }
  const status = st.review?.status ?? 'unreviewed'
  if (status === 'withdrawn') return { publishes: false, word: 'Withdrawn' }
  if (status === 'unreviewed') return { publishes: false, word: 'Not reviewed' }
  return { publishes: true, word: 'Public' }
}

export const REVIEW_WORD: Record<string, string> = {
  unreviewed: 'not yet reviewed',
  agreed: 'agreed by the narrator',
  'agreed-with-changes': 'agreed with changes',
  withdrawn: 'withdrawn by the narrator',
}

export const BASIS_WORD: Record<string, string> = {
  perceived: 'perceived',
  inferred: 'inferred',
  hearsay: 'heard from others',
}
