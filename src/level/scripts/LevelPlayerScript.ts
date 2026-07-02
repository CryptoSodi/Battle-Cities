import {
  GameObject,
  RectPainter,
  SpriteAlignment,
  SpritePainter,
  Timer,
  Vector,
} from '../../core';
import { DebugLevelPlayerMenu } from '../../debug';
import { GameUpdateArgs } from '../../game';
import { PlayerTank, SpriteText } from '../../gameObjects';
import { LevelPlayInputContext } from '../../input';
import { PowerupType } from '../../powerup';
import { ShopInventoryItemId, ShopManager } from '../../shop';
import { TankFactory, TankParty } from '../../tank';
import * as config from '../../config';

import { LevelScript } from '../LevelScript';
import {
  LevelPlayerSpawnCompletedEvent,
  LevelPowerupPickedEvent,
} from '../events';

const HOTBAR_SLOT_SIZE = 70;
const HOTBAR_SLOT_GAP = 12;
const HOTBAR_SLOT_COUNT = 4;

class PowerHotbarSlot extends GameObject {
  private readonly keyText: SpriteText;
  private readonly countText: SpriteText;
  private readonly icon: GameObject;
  private readonly itemId: ShopInventoryItemId;

  constructor(index: number, itemId: ShopInventoryItemId = null, count = 0) {
    super(HOTBAR_SLOT_SIZE, HOTBAR_SLOT_SIZE);

    this.itemId = itemId;
    this.painter = new RectPainter(
      itemId === null ? 'rgba(26, 24, 16, 0.62)' : 'rgba(68, 56, 10, 0.82)',
      itemId === null ? 'rgba(145, 119, 20, 0.35)' : config.COLOR_YELLOW,
    );
    (this.painter as RectPainter).lineWidth = 3;

    this.keyText = new SpriteText((index + 1).toString(), {
      color: itemId === null ? config.COLOR_GRAY : config.COLOR_WHITE,
      letterSpacing: 0,
    });
    this.keyText.position.set(6, 4);
    this.add(this.keyText);

    this.icon = new GameObject(44, 44);
    this.icon.position.set(17, 19);
    this.icon.painter = new SpritePainter(null, SpriteAlignment.Stretch);
    this.add(this.icon);

    this.countText = new SpriteText(count > 1 ? `X${count}` : '', {
      color: config.COLOR_YELLOW,
      letterSpacing: 0,
    });
    this.countText.position.set(34, 48);
    this.add(this.countText);
  }

  protected setup({ spriteLoader }: GameUpdateArgs): void {
    if (this.itemId === null) {
      return;
    }

    (this.icon.painter as SpritePainter).sprite = spriteLoader.load(
      this.getIconId(this.itemId),
    );
  }

  private getIconId(itemId: ShopInventoryItemId): string {
    switch (itemId) {
      case ShopInventoryItemId.Shield:
        return 'powerup.helmet';
      case ShopInventoryItemId.BaseDefence:
        return 'powerup.shovel';
      case ShopInventoryItemId.Freeze:
        return 'powerup.clock';
      case ShopInventoryItemId.Wipeout:
        return 'powerup.grenade';
      case ShopInventoryItemId.ExtraLife:
        return 'powerup.tank';
      default:
        return 'shop.bundle';
    }
  }
}

export class LevelPlayerScript extends LevelScript {
  private positions: Vector[] = [];
  private timers: Timer[] = [];
  private tanks: PlayerTank[] = [];
  private hotbar = new GameObject();
  private shopManager: ShopManager = null;
  private isReplaying = false;

  protected setup({ gameStorage, inputManager, session }: GameUpdateArgs): void {
    this.shopManager = new ShopManager(gameStorage);
    this.isReplaying = inputManager.isReplaying();
    this.eventBus.playerSpawnCompleted.addListener(this.handleSpawnCompleted);
    this.eventBus.powerupPicked.addListener(this.handlePowerupPicked);
    this.eventBus.levelGameOverMoveBlocked.addListener(
      this.handleLevelGameOverMoveBlocked,
    );

    this.positions = this.mapConfig.getPlayerSpawnPositions();

    // Keep only one player if not multiplayer
    if (!session.isMultiplayer()) {
      this.positions = this.positions.slice(0, 1);
    }

    this.positions.forEach((position, index) => {
      const timer = new Timer(config.PLAYER_FIRST_SPAWN_DELAY);
      timer.done.addListener(() => {
        this.requestSpawn(index);
      });
      this.timers.push(timer);

      // Fill in the array of tanks
      this.tanks.push(null);
    });

    if (config.IS_DEV) {
      const debugMenu = new DebugLevelPlayerMenu({
        top: 365,
      });
      debugMenu.attach();
      debugMenu.upgradeRequest.addListener((partyIndex) => {
        const tank = this.tanks[partyIndex];
        if (tank === null) {
          return;
        }
        tank.upgrade();
      });
      debugMenu.deathRequest.addListener((partyIndex) => {
        const tank = this.tanks[partyIndex];
        if (tank === null) {
          return;
        }
        tank.die();
      });
      debugMenu.moveSpeedUpRequest.addListener(({ partyIndex, speed }) => {
        const tank = this.tanks[partyIndex];
        if (tank === null) {
          return;
        }
        tank.attributes.moveSpeed += speed;
      });
    }

    this.hotbar.position.set(
      config.CANVAS_WIDTH -
        config.BORDER_RIGHT_WIDTH -
        HOTBAR_SLOT_COUNT * HOTBAR_SLOT_SIZE -
        (HOTBAR_SLOT_COUNT - 1) * HOTBAR_SLOT_GAP -
        18,
      config.CANVAS_HEIGHT -
        config.BORDER_TOP_BOTTOM_HEIGHT -
        HOTBAR_SLOT_SIZE -
        14,
    );
    this.hotbar.setZIndex(500);
    this.world.sceneRoot.add(this.hotbar);
    this.renderHotbar();
  }

  protected update({ deltaTime, inputManager }: GameUpdateArgs): void {
    this.timers.forEach((timer) => {
      timer.update(deltaTime);
    });

    const inputMethod = inputManager.getActiveMethod();
    if (inputMethod.isDownAny(LevelPlayInputContext.PowerOne)) {
      this.useHotbarPower(0);
    } else if (inputMethod.isDownAny(LevelPlayInputContext.PowerTwo)) {
      this.useHotbarPower(1);
    } else if (inputMethod.isDownAny(LevelPlayInputContext.PowerThree)) {
      this.useHotbarPower(2);
    } else if (inputMethod.isDownAny(LevelPlayInputContext.PowerFour)) {
      this.useHotbarPower(3);
    }
  }

  private requestSpawn = (partyIndex: number): void => {
    const playerSession = this.session.getPlayer(partyIndex);
    if (!playerSession.isAlive()) {
      return;
    }

    const position = this.positions[partyIndex];

    const type = TankFactory.createPlayerType();

    this.eventBus.playerSpawnRequested.notify({
      type,
      partyIndex,
      position,
    });
  };

  private handleSpawnCompleted = (
    event: LevelPlayerSpawnCompletedEvent,
  ): void => {
    if (event.type.party !== TankParty.Player) {
      return;
    }

    const { partyIndex } = event;

    const tank = TankFactory.createPlayer(partyIndex);
    tank.updateMatrix();
    tank.setCenter(event.centerPosition);
    tank.updateMatrix();
    tank.activateShield(config.SHIELD_SPAWN_DURATION);

    const playerSession = this.session.getPlayer(partyIndex);

    // Check if tank tier from previous level should be activated.
    // If tank dies - it loses all this tiers, so it applies only to first
    // spawn.
    const isLevelFirstSpawn = playerSession.isLevelFirstSpawn();
    if (isLevelFirstSpawn) {
      const carryoverTier = playerSession.getTankTier();
      tank.upgrade(carryoverTier, false);
    }

    tank.died.addListener(() => {
      this.eventBus.playerDied.notify({
        type: event.type,
        centerPosition: tank.getCenter(),
        partyIndex,
      });

      tank.removeSelf();
      this.tanks[partyIndex] = null;
      this.world.removePlayerTank(partyIndex);

      this.timers[partyIndex].reset(config.PLAYER_SPAWN_DELAY);

      playerSession.resetTankTier();
    });

    tank.fired.addListener(() => {
      this.eventBus.playerFired.notify(null);
    });

    tank.upgraded.addListener((event) => {
      playerSession.setTankTier(event.tier);
    });

    tank.slided.addListener(() => {
      this.eventBus.playerSlided.notify(null);
    });

    playerSession.setLevelSpawned();

    this.tanks[partyIndex] = tank;

    this.world.addPlayerTank(partyIndex, tank);
  };

  private useHotbarPower(index: number): void {
    const tank = this.tanks[0];
    if (tank === null || tank === undefined) {
      return;
    }

    const runConsumables = this.session.getRunConsumables();
    const powerupCounts = runConsumables.powerupCounts || [];
    runConsumables.powerupCounts = powerupCounts;
    const itemId = runConsumables.powerupItems[index];
    const type = runConsumables.powerups[index];
    if (itemId === undefined || type === undefined) {
      return;
    }

    if (!this.isReplaying && !this.shopManager.consumeInventoryItem(itemId)) {
      runConsumables.powerupItems.splice(index, 1);
      runConsumables.powerups.splice(index, 1);
      powerupCounts.splice(index, 1);
      this.renderHotbar();
      return;
    }

    const stackCount = powerupCounts[index] || 1;
    if (stackCount > 1) {
      powerupCounts[index] = stackCount - 1;
    } else {
      runConsumables.powerupItems.splice(index, 1);
      runConsumables.powerups.splice(index, 1);
      powerupCounts.splice(index, 1);
    }

    this.eventBus.powerupPicked.notify({
      type,
      centerPosition: tank.getCenter(),
      partyIndex: 0,
    });
    this.renderHotbar();
  }

  private renderHotbar(): void {
    this.hotbar.removeAllChildren();
    const runConsumables = this.session.getRunConsumables();
    const powerupCounts = runConsumables.powerupCounts || [];
    runConsumables.powerupCounts = powerupCounts;

    for (let index = 0; index < HOTBAR_SLOT_COUNT; index += 1) {
      const slot = new PowerHotbarSlot(
        index,
        runConsumables.powerupItems[index],
        powerupCounts[index] || 0,
      );
      slot.position.set(index * (HOTBAR_SLOT_SIZE + HOTBAR_SLOT_GAP), 0);
      this.hotbar.add(slot);
    }
  }

  private handlePowerupPicked = (event: LevelPowerupPickedEvent): void => {
    const { type: powerupType, partyIndex } = event;

    const tank = this.tanks[partyIndex];

    if (powerupType === PowerupType.Shield) {
      tank.activateShield(config.SHIELD_POWERUP_DURATION);
    }

    if (powerupType === PowerupType.Speed) {
      tank.activateSpeedBoost(
        config.SPEED_POWERUP_DURATION,
        config.SPEED_POWERUP_MULTIPLIER,
      );
    }

    if (powerupType === PowerupType.Upgrade) {
      tank.upgrade();
    }
  };

  private handleLevelGameOverMoveBlocked = (): void => {
    this.tanks.forEach((tank) => {
      if (tank === null) {
        return;
      }

      // Freeze the tank
      tank.freezeState.set(true);
    });
  };
}
