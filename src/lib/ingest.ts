/** Bring a file into the project: hash its bytes, store the Blob, describe it. */

import { newId, putMedia, sha256Hex, type HeldFile } from '../core'

/** Read the duration (seconds) of an audio or video blob, best effort. */
function mediaDuration(file: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const isVideo = file.type.startsWith('video/')
    const el = document.createElement(isVideo ? 'video' : 'audio')
    const url = URL.createObjectURL(file)
    const done = (d: number | undefined) => {
      URL.revokeObjectURL(url)
      resolve(d)
    }
    el.preload = 'metadata'
    el.onloadedmetadata = () =>
      done(Number.isFinite(el.duration) ? el.duration : undefined)
    el.onerror = () => done(undefined)
    el.src = url
  })
}

export async function ingestFile(file: File): Promise<HeldFile> {
  const buf = await file.arrayBuffer()
  const sha256 = await sha256Hex(buf)
  const blobKey = newId('media')
  await putMedia(blobKey, file)

  let w: number | undefined
  let h: number | undefined
  let durationSec: number | undefined

  if (file.type.startsWith('image/')) {
    try {
      const bmp = await createImageBitmap(file)
      w = bmp.width
      h = bmp.height
      bmp.close()
    } catch {
      // SVG and some formats cannot be decoded this way; dimensions stay unset.
    }
  } else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
    durationSec = await mediaDuration(file)
  }

  return {
    name: file.name,
    mime: file.type || 'application/octet-stream',
    bytes: file.size,
    sha256,
    w,
    h,
    durationSec,
    blobKey,
  }
}
