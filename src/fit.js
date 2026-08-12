// Fitting imported character models to the world.
//
// Two things bite here, and both produced visible bugs:
//  1. A skinned mesh's bounding box describes the BIND pose, not what is on screen. Mewtwo's
//     bind box is 2.4 units tall while he actually renders 1.72 and sits 0.71 ABOVE its bottom,
//     so planting the bind box on the ground left him floating. Measuring with the skeleton
//     applied fixes both the height and the foot offset.
//  2. The GLB files carry no usable scale: authored heights range from 0.01x to 57x the real
//     height (magnemite ships 17.3 units tall, wigglytuff 0.012), so relative sizes have to come
//     from a canonical height table instead of the files.

/** World-space bounds of `root` with the CURRENT animated pose applied. */
export function posedBounds(root) {
  root.computeWorldMatrix(true);
  for (const m of root.getChildMeshes()) {
    m.computeWorldMatrix(true);
    try { m.refreshBoundingInfo({ applySkeleton: true, applyMorph: true }); } catch (e) { /* unskinned mesh */ }
  }
  return root.getHierarchyBoundingVectors(true);
}

/**
 * Scale `root` so its on-screen height is `targetH` (metres; the world is 1 unit = 1 m).
 * Returns the offset of its lowest point below the root origin, so the caller can plant it
 * exactly on the terrain, plus its horizontal footprint for sizing the shadow decal.
 *
 * Must be called BEFORE any animation is started on the model. After animation starts the
 * skeleton bobs and the measured foot offset becomes unstable.
 */
export function fitToHeight(root, targetH) {
  const keep = root.position.clone();
  root.position.set(0, 0, 0);
  let bb = posedBounds(root);
  const hNow = bb.max.y - bb.min.y;
  if (isFinite(hNow) && hNow > 1e-4) {
    const k = targetH / hNow;
    if (isFinite(k) && k > 1e-4 && k < 1e4) {
      root.scaling.scaleInPlace(k);
      bb = posedBounds(root);
    }
  }
  const footOff = bb.min.y;
  const width = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
  root.position.copyFrom(keep);
  root.computeWorldMatrix(true);
  return { footOff: isFinite(footOff) ? footOff : 0, width: isFinite(width) && width > 0 ? width : 1 };
}
