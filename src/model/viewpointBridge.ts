import type { Viewpoint } from '../core'

/**
 * A bridge from the 3D scene (inside the react-three-fiber Canvas) to the editor
 * outside it. ModelView registers a function that reads the live camera pose; the
 * statement editor calls it to save a viewpoint. It resets to a null-returning
 * stub when the scene unmounts, so a stale camera is never read. Kept free of any
 * three.js import so the editor can use it without pulling the 3D bundle.
 */
export const viewpointBridge: { capture: () => Viewpoint | null } = {
  capture: () => null,
}
