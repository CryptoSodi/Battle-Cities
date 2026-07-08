import { BoxCollider, Collision, CollisionSystem, GameObject } from '../core';
import { GameUpdateArgs, Rotation, Tag } from '../game';
import { TankBulletWallDamage } from '../tank';
import * as config from '../config';

import { TerrainTile } from './TerrainTile';

// How far in front of a candidate tile (toward the shooter) another wall tile
// still counts as covering it. One tank-width keeps the cover rule local to
// the impact surface, so far-away structures can't suppress destruction.
const COVER_WINDOW = config.TILE_SIZE_LARGE;

export class TerrainTileDestroyer extends GameObject {
  public readonly collider: BoxCollider;
  public readonly damage: number;
  private collisionSystem: CollisionSystem;

  constructor(argDamage: number) {
    const damage = Math.min(argDamage, TankBulletWallDamage.High);

    const width = config.TILE_SIZE_LARGE;
    const depth = config.TILE_SIZE_SMALL;

    super(width, depth);

    this.damage = damage;
    this.collider = new BoxCollider(this, true);
    this.collisionSystem = null;
  }

  protected setup({ collisionSystem }: GameUpdateArgs): void {
    this.collisionSystem = collisionSystem;
    collisionSystem.register(this.collider);
  }

  protected collide(collision: Collision): void {
    const { contacts } = collision;

    const tileContacts = contacts.filter((contact) => {
      return contact.collider.object.tags.includes(Tag.Wall);
    });

    // If for some reason there is no tiles left for contact, remove the
    // destroyer, because it has nothing to destroy
    if (tileContacts.length === 0) {
      this.destroy();
      return;
    }

    const frontContacts = this.getFrontRowContacts(tileContacts);

    frontContacts.forEach((contact) => {
      const tile = contact.collider.object as TerrainTile;

      const isBrickWall = tile.tags.includes(Tag.Brick);
      const isSteelWall = tile.tags.includes(Tag.Steel);

      // TODO: this check should be a part of bullet attributes model
      const canDestroySteelWall = this.damage === TankBulletWallDamage.High;

      if (isBrickWall || (isSteelWall && canDestroySteelWall)) {
        tile.destroy();
        this.destroy();
      }
    });
  }

  private getFrontRowContacts(
    contacts: Collision['contacts'],
  ): Collision['contacts'] {
    const rotation = this.getWorldRotation();

    if (rotation === Rotation.Up) {
      const frontY = Math.max(...contacts.map((contact) => contact.box.max.y));
      return this.limitContactsToImpactWidth(
        contacts.filter((contact) => contact.box.max.y === frontY),
      );
    }

    if (rotation === Rotation.Down) {
      const frontY = Math.min(...contacts.map((contact) => contact.box.min.y));
      return this.limitContactsToImpactWidth(
        contacts.filter((contact) => contact.box.min.y === frontY),
      );
    }

    if (rotation === Rotation.Left) {
      const frontX = Math.max(...contacts.map((contact) => contact.box.max.x));
      return this.limitContactsToImpactWidth(
        contacts.filter((contact) => contact.box.max.x === frontX),
      );
    }

    if (rotation === Rotation.Right) {
      const frontX = Math.min(...contacts.map((contact) => contact.box.min.x));
      return this.limitContactsToImpactWidth(
        contacts.filter((contact) => contact.box.min.x === frontX),
      );
    }

    return contacts;
  }

  private limitContactsToImpactWidth(
    contacts: Collision['contacts'],
  ): Collision['contacts'] {
    const maxContacts = this.damage * 4;

    // A tile at the impact depth may still be COVERED: when the bullet flew
    // into a crater in a partially destroyed wall, the destroyer's band sits
    // one or more rows deep -- where, in neighboring columns, it overlaps
    // bricks that are hiding behind their still-intact front bricks. Those
    // covering bricks are outside the band entirely, so no front-row or
    // contiguity filtering can see them; check the actual world geometry and
    // drop every candidate that has a wall tile directly in front of it
    // (toward the shooter). The blast can't reach through an intact surface.
    const exposed = contacts.filter(
      (contact) => !this.isCoveredFromFront(contact),
    );

    // Being at the same front-facing distance only means two tiles are
    // equally close along the travel axis -- it says nothing about whether
    // they belong to the same wall. A separate structure (e.g. the far side
    // of a gap between two pillars) can coincidentally share that distance,
    // so without a contiguity check a hit on one pillar could destroy bricks
    // in an unrelated neighboring one. Restrict to the physically-touching
    // (zero-gap) group containing the tile closest to the destroyer's own
    // center -- i.e. the tile actually struck -- before applying the count
    // cap below. Running this AFTER the cover filter also stops destruction
    // from spreading past a covered brick to exposed ones beyond it.
    const contiguous = this.filterToContiguousGroup(exposed);

    if (contiguous.length <= maxContacts) {
      return contiguous;
    }

    const rotation = this.getWorldRotation();
    const center = this.getWorldBoundingBox().getCenter();
    const isVerticalHit = rotation === Rotation.Up || rotation === Rotation.Down;

    return contiguous
      .slice()
      .sort((a, b) => {
        const aCenter = a.box.getCenter();
        const bCenter = b.box.getCenter();
        const aDistance = isVerticalHit
          ? Math.abs(aCenter.x - center.x)
          : Math.abs(aCenter.y - center.y);
        const bDistance = isVerticalHit
          ? Math.abs(bCenter.x - center.x)
          : Math.abs(bCenter.y - center.y);

        return aDistance - bDistance;
      })
      .slice(0, maxContacts);
  }

  // True when another wall tile sits directly in front of this contact
  // (between it and the shooter), overlapping it on the axis perpendicular to
  // travel and within COVER_WINDOW along the travel axis. Border walls are
  // ignored: they surround the field, so a candidate can never legitimately
  // hide behind one from an in-field shooter, and their huge boxes would
  // otherwise "cover" everything. One linear scan of the static colliders per
  // candidate -- destroyers are one-shot objects, so this is not a hot path.
  private isCoveredFromFront(
    contact: Collision['contacts'][number],
  ): boolean {
    if (this.collisionSystem === null) {
      return false;
    }

    const rotation = this.getWorldRotation();
    const box = contact.box;

    for (const collider of this.collisionSystem.getStaticColliders()) {
      const object = collider.object;
      if (object === contact.collider.object) {
        continue;
      }
      if (!object.tags.includes(Tag.Wall) || object.tags.includes(Tag.Border)) {
        continue;
      }

      const other = collider.getBox();

      if (rotation === Rotation.Up) {
        // Shooter is below; the candidate's exposed face is box.max.y.
        if (
          other.min.x < box.max.x &&
          other.max.x > box.min.x &&
          other.min.y >= box.max.y &&
          other.min.y < box.max.y + COVER_WINDOW
        ) {
          return true;
        }
      } else if (rotation === Rotation.Down) {
        // Shooter is above; the candidate's exposed face is box.min.y.
        if (
          other.min.x < box.max.x &&
          other.max.x > box.min.x &&
          other.max.y <= box.min.y &&
          other.max.y > box.min.y - COVER_WINDOW
        ) {
          return true;
        }
      } else if (rotation === Rotation.Left) {
        // Shooter is to the right; the candidate's exposed face is box.max.x.
        if (
          other.min.y < box.max.y &&
          other.max.y > box.min.y &&
          other.min.x >= box.max.x &&
          other.min.x < box.max.x + COVER_WINDOW
        ) {
          return true;
        }
      } else if (rotation === Rotation.Right) {
        // Shooter is to the left; the candidate's exposed face is box.min.x.
        if (
          other.min.y < box.max.y &&
          other.max.y > box.min.y &&
          other.max.x <= box.min.x &&
          other.max.x > box.min.x - COVER_WINDOW
        ) {
          return true;
        }
      }
    }

    return false;
  }

  // Flood-fills outward (along the axis perpendicular to travel, since every
  // input contact already shares the same front-facing distance) from the
  // contact closest to the destroyer's own center, only crossing into a
  // neighbor whose box directly touches (shares an edge, no gap) an
  // already-included one. This is what actually prevents a hit from leaping
  // across empty space into a disconnected wall.
  private filterToContiguousGroup(
    contacts: Collision['contacts'],
  ): Collision['contacts'] {
    if (contacts.length <= 1) {
      return contacts;
    }

    const rotation = this.getWorldRotation();
    const isVerticalHit = rotation === Rotation.Up || rotation === Rotation.Down;
    const center = this.getWorldBoundingBox().getCenter();
    const axisCenter = isVerticalHit ? center.x : center.y;
    const axisRange = (contact: Collision['contacts'][number]): [number, number] =>
      isVerticalHit
        ? [contact.box.min.x, contact.box.max.x]
        : [contact.box.min.y, contact.box.max.y];

    let seedIndex = 0;
    let seedDistance = Infinity;
    contacts.forEach((contact, index) => {
      const [min, max] = axisRange(contact);
      const distance = Math.abs((min + max) / 2 - axisCenter);
      if (distance < seedDistance) {
        seedDistance = distance;
        seedIndex = index;
      }
    });

    const touches = (
      a: [number, number],
      b: [number, number],
    ): boolean => a[1] === b[0] || b[1] === a[0];

    const included = [contacts[seedIndex]];
    const remaining = contacts.filter((_, index) => index !== seedIndex);

    let addedAny = true;
    while (addedAny) {
      addedAny = false;
      for (let i = remaining.length - 1; i >= 0; i -= 1) {
        const candidateRange = axisRange(remaining[i]);
        const touchesIncluded = included.some((contact) =>
          touches(axisRange(contact), candidateRange),
        );
        if (touchesIncluded) {
          included.push(remaining[i]);
          remaining.splice(i, 1);
          addedAny = true;
        }
      }
    }

    return included;
  }

  private destroy(): void {
    this.removeSelf();
    this.collider.unregister();
  }
}
