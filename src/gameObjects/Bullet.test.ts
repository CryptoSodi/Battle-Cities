import test from 'ava';

import { Tag } from '../game';
import { TankBulletWallDamage } from '../tank';

import { Bullet } from './Bullet';

function createPlayerBullet(ownerPartyIndex: number): Bullet {
  const bullet = new Bullet(ownerPartyIndex, 200, 1, TankBulletWallDamage.Low);
  bullet.tags.push(Tag.Player);
  return bullet;
}

function collide(left: Bullet, right: Bullet): void {
  const collision = {
    contacts: [{ collider: right.collider }],
  };
  const collisionInvoker = (left as unknown) as {
    collideBullets(value: unknown): void;
  };
  collisionInvoker.collideBullets(collision);
}

test('bullets from different players cancel each other', (t) => {
  const playerOneBullet = createPlayerBullet(0);
  const playerTwoBullet = createPlayerBullet(1);

  collide(playerOneBullet, playerTwoBullet);

  t.true(playerOneBullet.isSpent());
  t.true(playerTwoBullet.isSpent());
});

test('bullets from the same player pass through each other', (t) => {
  const firstBullet = createPlayerBullet(0);
  const secondBullet = createPlayerBullet(0);

  collide(firstBullet, secondBullet);

  t.false(firstBullet.isSpent());
  t.false(secondBullet.isSpent());
});
