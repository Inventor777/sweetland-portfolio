import RAPIER from "@dimforge/rapier3d-compat";
import { Emitter } from "../core/Emitter";

export type ColliderKind = "coin" | "portal" | "npc" | "other";

export type ColliderTag = {
  kind: ColliderKind;
  id: string; // unique id per object
};

type Events = {
  collision: { a: ColliderTag; b: ColliderTag; started: boolean };
};

export class Physics {
  R!: typeof RAPIER;
  world!: RAPIER.World;
  eventQueue!: RAPIER.EventQueue;

  // Map collider handles -> gameplay tags.
  private tags = new Map<number, ColliderTag>();

  events = new Emitter<Events>();

  async init(): Promise<void> {
    await RAPIER.init();
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.eventQueue = new RAPIER.EventQueue(true);
  }

  step(): void {
    this.world.step(this.eventQueue);

    // NOTE:
    // In @dimforge/rapier3d-compat, sensor intersections are delivered through
    // drainCollisionEvents as long as the colliders set ActiveEvents.COLLISION_EVENTS.
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      const t1 = this.tags.get(h1);
      const t2 = this.tags.get(h2);
      if (!t1 || !t2) return;
      this.events.emit("collision", { a: t1, b: t2, started });
    });
  }

  tagCollider(collider: RAPIER.Collider, tag: ColliderTag): void {
    this.tags.set(collider.handle, tag);
  }

  untagCollider(collider: RAPIER.Collider): void {
    this.tags.delete(collider.handle);
  }

  dispose(): void {
    this.eventQueue?.free();
    this.world?.free();
  }
}
