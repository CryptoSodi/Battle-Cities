import { BoxCollider, Collision, GameObject } from '../core';
import { GameUpdateArgs, Rotation, Tag } from '../game';
import { TankBulletWallDamage } from '../tank';
import * as config from '../config';

import { TerrainTile } from './TerrainTile';

export class TerrainTileDestroyer extends GameObject {
  public readonly collider: BoxCollider;
  public readonly damage: number;

  constructor(argDamage: number) {
    const damage = Math.min(argDamage, TankBulletWallDamage.High);

    const width = config.TILE_SIZE_LARGE;
    const depth = config.TILE_SIZE_SMALL;

    super(width, depth);

    this.damage = damage;
    this.collider = new BoxCollider(this, true);
  }

  protected setup({ collisionSystem }: GameUpdateArgs): void {
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

    if (contacts.length <= maxContacts) {
      return contacts;
    }

    const rotation = this.getWorldRotation();
    const center = this.getWorldBoundingBox().getCenter();
    const isVerticalHit = rotation === Rotation.Up || rotation === Rotation.Down;

    return contacts
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

  private destroy(): void {
    this.removeSelf();
    this.collider.unregister();
  }
}
