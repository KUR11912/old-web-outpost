import * as THREE from 'three';
import { PICKUPS, PICKUP_STYLE } from './pickup-data';

/** Decorative triggers only: these objects are never added to world colliders. */
export function createPickupObjects(scene: THREE.Scene, model: THREE.Group) {
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = PICKUP_STYLE.width / (bounds.max.x - bounds.min.x);
  return PICKUPS.map(definition => {
    const object = new THREE.Group();
    object.name = `Pickup_${definition.id}`;
    const body = model.clone(true);
    body.scale.setScalar(scale);
    // Rotate about the horizontal centre; retain a bottom-centre hover origin.
    body.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    object.add(body);
    const basePosition = { ...definition.position, y: PICKUP_STYLE.hoverHeight };
    object.position.set(basePosition.x, basePosition.y, basePosition.z);
    scene.add(object);
    return { definition, object, basePosition };
  });
}

export type PickupObjects = ReturnType<typeof createPickupObjects>;

/** Absolute elapsed seconds keep the orbit and bob independent of frame rate. */
export function updatePickupObjects(pickups: PickupObjects, elapsed: number, collected: readonly string[]) {
  for (const pickup of pickups) {
    const { object, basePosition, definition } = pickup;
    object.visible = !collected.includes(definition.id);
    object.position.set(basePosition.x,
      basePosition.y + Math.sin(elapsed * Math.PI * 2 / PICKUP_STYLE.bobPeriod) * PICKUP_STYLE.bobAmplitude,
      basePosition.z);
    object.rotation.y = (elapsed % PICKUP_STYLE.rotationPeriod) / PICKUP_STYLE.rotationPeriod * Math.PI * 2;
  }
}
