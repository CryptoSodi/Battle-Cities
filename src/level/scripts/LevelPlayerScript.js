"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelPlayerScript = void 0;
const core_1 = require("../../core");
const debug_1 = require("../../debug");
const gameObjects_1 = require("../../gameObjects");
const input_1 = require("../../input");
const mobile_1 = require("../../input/mobile");
const powerup_1 = require("../../powerup");
const shop_1 = require("../../shop");
const tank_1 = require("../../tank");
const config = __importStar(require("../../config"));
const LevelScript_1 = require("../LevelScript");
const HOTBAR_SLOT_SIZE = 70;
const HOTBAR_SLOT_GAP = 12;
const HOTBAR_SLOT_COUNT = 4;
class PowerHotbarSlot extends core_1.GameObject {
    constructor(index, itemId = null, count = 0) {
        super(HOTBAR_SLOT_SIZE, HOTBAR_SLOT_SIZE);
        this.itemId = itemId;
        this.painter = new core_1.RectPainter(itemId === null ? 'rgba(26, 24, 16, 0.62)' : 'rgba(68, 56, 10, 0.82)', itemId === null ? 'rgba(145, 119, 20, 0.35)' : config.COLOR_YELLOW);
        this.painter.lineWidth = 3;
        this.keyText = new gameObjects_1.SpriteText((index + 1).toString(), {
            color: itemId === null ? config.COLOR_GRAY : config.COLOR_WHITE,
            letterSpacing: 0,
        });
        this.keyText.position.set(6, 4);
        this.add(this.keyText);
        this.icon = new core_1.GameObject(44, 44);
        this.icon.position.set(17, 19);
        this.icon.painter = new core_1.SpritePainter(null, core_1.SpriteAlignment.Stretch);
        this.add(this.icon);
        this.countText = new gameObjects_1.SpriteText(count > 1 ? `X${count}` : '', {
            color: config.COLOR_YELLOW,
            letterSpacing: 0,
        });
        this.countText.position.set(34, 48);
        this.add(this.countText);
    }
    setup({ spriteLoader }) {
        if (this.itemId === null) {
            return;
        }
        this.icon.painter.sprite = spriteLoader.load(this.getIconId(this.itemId));
    }
    getIconId(itemId) {
        switch (itemId) {
            case shop_1.ShopInventoryItemId.Shield:
                return 'powerup.helmet';
            case shop_1.ShopInventoryItemId.BaseDefence:
                return 'powerup.shovel';
            case shop_1.ShopInventoryItemId.Freeze:
                return 'powerup.clock';
            case shop_1.ShopInventoryItemId.Speed:
                return 'powerup.speed';
            case shop_1.ShopInventoryItemId.Upgrade:
                return 'powerup.star';
            case shop_1.ShopInventoryItemId.ZoomOut:
                return 'powerup.zoomout';
            case shop_1.ShopInventoryItemId.Wipeout:
                return 'powerup.grenade';
            case shop_1.ShopInventoryItemId.ExtraLife:
                return 'powerup.life';
            default:
                return 'shop.bundle';
        }
    }
}
class LevelPlayerScript extends LevelScript_1.LevelScript {
    constructor(options = {}) {
        super();
        this.tankCreated = new core_1.Subject();
        this.positions = [];
        this.timers = [];
        this.tanks = [];
        this.hotbar = new core_1.GameObject();
        this.shopManager = null;
        this.isReplaying = false;
        this.isWebRtcClient = false;
        this.localPlayerIndex = 0;
        this.requestSpawn = (partyIndex) => {
            const playerSession = this.session.getPlayer(partyIndex);
            if (!playerSession.isAlive()) {
                return;
            }
            const position = this.positions[partyIndex];
            const type = new tank_1.TankType(tank_1.TankParty.Player, this.session.getPlayerTankTier(partyIndex));
            this.eventBus.playerSpawnRequested.notify({
                type,
                partyIndex,
                position,
            });
        };
        this.handleSpawnCompleted = (event) => {
            if (event.type.party !== tank_1.TankParty.Player) {
                return;
            }
            const { partyIndex } = event;
            const tank = tank_1.TankFactory.createPlayer(partyIndex, event.type.clone());
            tank.updateMatrix();
            tank.setCenter(event.centerPosition);
            tank.updateMatrix();
            tank.activateShield(config.SHIELD_SPAWN_DURATION);
            // Run-long trait boosts (trading/staking). Deterministic and replay-safe:
            // the session holds either the live boosts captured at run start or the
            // ones stored in the replay being watched.
            tank.setRunBoosts(this.session.getRunBoosts());
            const playerSession = this.session.getPlayer(partyIndex);
            // Check if tank tier from previous level should be activated.
            // If tank dies - it loses all this tiers, so it applies only to first
            // spawn.
            const isLevelFirstSpawn = playerSession.isLevelFirstSpawn();
            if (isLevelFirstSpawn) {
                const carryoverTier = playerSession.getTankTier();
                if (getTankTierRank(carryoverTier) > getTankTierRank(tank.type.tier)) {
                    tank.upgrade(carryoverTier, false);
                }
            }
            playerSession.setTankTier(tank.type.tier);
            this.session.setPlayerTankTier(partyIndex, tank.type.tier);
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
                this.session.setPlayerTankTier(partyIndex, tank_1.TankTier.A);
            });
            tank.fired.addListener(() => {
                this.eventBus.playerFired.notify(null);
            });
            tank.upgraded.addListener((event) => {
                playerSession.setTankTier(event.tier);
                this.session.setPlayerTankTier(partyIndex, event.tier);
            });
            tank.slided.addListener(() => {
                this.eventBus.playerSlided.notify(null);
            });
            playerSession.setLevelSpawned();
            this.tanks[partyIndex] = tank;
            this.tankCreated.notify(tank);
            this.world.addPlayerTank(partyIndex, tank);
        };
        this.handlePowerupPicked = (event) => {
            const { type: powerupType, partyIndex, hotbarSlot } = event;
            if (this.isWebRtcClient &&
                partyIndex === this.localPlayerIndex &&
                Number.isInteger(hotbarSlot)) {
                this.consumeClientHotbarSlot(hotbarSlot);
            }
            const tank = this.tanks[partyIndex];
            if (powerupType === powerup_1.PowerupType.Shield) {
                tank.activateShield(config.SHIELD_POWERUP_DURATION);
            }
            if (powerupType === powerup_1.PowerupType.Speed) {
                tank.activateSpeedBoost(config.SPEED_POWERUP_DURATION, config.SPEED_POWERUP_MULTIPLIER);
            }
            if (powerupType === powerup_1.PowerupType.Upgrade) {
                tank.upgrade();
            }
        };
        this.handleLevelGameOverMoveBlocked = () => {
            this.tanks.forEach((tank) => {
                if (tank === null) {
                    return;
                }
                // Freeze the tank
                tank.freezeState.set(true);
            });
        };
        this.headless = options.headless === true;
        this.playerRunConsumables = options.playerRunConsumables === undefined
            ? null
            : options.playerRunConsumables.map((consumables) => ({
                powerups: [...consumables.powerups],
                powerupCounts: [...consumables.powerupCounts],
            }));
    }
    setup(updateArgs) {
        const { gameStorage, inputManager, session, webRtcMatch, } = updateArgs;
        this.isWebRtcClient =
            webRtcMatch.isEnabled() && !webRtcMatch.isBroadcaster();
        const isWebRtcObserver = !this.headless && webRtcMatch.isObserver();
        if (this.isWebRtcClient) {
            this.localPlayerIndex = webRtcMatch.getLocalPlayerIndex();
        }
        if (!this.headless) {
            this.shopManager = new shop_1.ShopManager(gameStorage);
            this.isReplaying = inputManager.isReplaying();
        }
        const runConsumables = session.getRunConsumables();
        if (!this.headless &&
            !isWebRtcObserver &&
            !this.isReplaying &&
            session.getLevelNumber() === 1 &&
            runConsumables.powerupItems.length === 0 &&
            runConsumables.powerups.length === 0) {
            const equippedConsumables = this.shopManager.getEquippedRunConsumables();
            if (equippedConsumables.powerupItems.length > 0) {
                session.setRunConsumables(equippedConsumables);
            }
        }
        this.eventBus.playerSpawnCompleted.addListener(this.handleSpawnCompleted);
        this.eventBus.powerupPicked.addListener(this.handlePowerupPicked);
        this.eventBus.levelGameOverMoveBlocked.addListener(this.handleLevelGameOverMoveBlocked);
        this.positions = this.mapConfig.getPlayerSpawnPositions();
        // Keep only one player if not multiplayer
        if (!session.isMultiplayer()) {
            this.positions = this.positions.slice(0, 1);
        }
        this.positions.forEach((position, index) => {
            const timer = new core_1.Timer(config.PLAYER_FIRST_SPAWN_DELAY);
            timer.done.addListener(() => {
                this.requestSpawn(index);
            });
            this.timers.push(timer);
            // Fill in the array of tanks
            this.tanks.push(null);
        });
        if (config.IS_DEV && !this.headless) {
            const debugMenu = new debug_1.DebugLevelPlayerMenu({
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
        this.hotbar.position.set(config.CANVAS_WIDTH -
            config.BORDER_RIGHT_WIDTH -
            HOTBAR_SLOT_COUNT * HOTBAR_SLOT_SIZE -
            (HOTBAR_SLOT_COUNT - 1) * HOTBAR_SLOT_GAP -
            18, config.CANVAS_HEIGHT -
            config.BORDER_TOP_BOTTOM_HEIGHT -
            HOTBAR_SLOT_SIZE -
            14);
        this.hotbar.setZIndex(500);
        if (!this.headless && !isWebRtcObserver && !(0, mobile_1.isMobileTouchLayout)()) {
            this.world.sceneRoot.add(this.hotbar);
            this.renderHotbar();
        }
    }
    update(updateArgs) {
        const { deltaTime, inputManager, webRtcMatch } = updateArgs;
        this.timers.forEach((timer) => {
            timer.update(deltaTime);
        });
        if (webRtcMatch.isEnabled()) {
            if (webRtcMatch.isBroadcaster()) {
                this.tanks.forEach((_tank, partyIndex) => {
                    for (let action = 0; action < HOTBAR_SLOT_COUNT; action += 1) {
                        const slot = webRtcMatch.consumeRemotePowerSlot(partyIndex);
                        if (slot === null) {
                            break;
                        }
                        this.useHotbarPower(slot, partyIndex, false);
                    }
                });
            }
            return;
        }
        if (this.headless) {
            return;
        }
        const inputMethod = inputManager.getActiveMethod();
        if (inputMethod.isDownAny(input_1.LevelPlayInputContext.PowerOne)) {
            this.useHotbarPower(0);
        }
        else if (inputMethod.isDownAny(input_1.LevelPlayInputContext.PowerTwo)) {
            this.useHotbarPower(1);
        }
        else if (inputMethod.isDownAny(input_1.LevelPlayInputContext.PowerThree)) {
            this.useHotbarPower(2);
        }
        else if (inputMethod.isDownAny(input_1.LevelPlayInputContext.PowerFour)) {
            this.useHotbarPower(3);
        }
    }
    getAuthoritativeRunConsumables() {
        if (this.playerRunConsumables === null) {
            return null;
        }
        return this.playerRunConsumables.map((consumables) => ({
            powerups: [...consumables.powerups],
            powerupCounts: [...consumables.powerupCounts],
        }));
    }
    useHotbarPower(index, partyIndex = 0, consumeStoredInventory = true) {
        const tank = this.tanks[partyIndex];
        if (tank === null || tank === undefined) {
            return;
        }
        const authoritativeConsumables = this.playerRunConsumables?.[partyIndex] ?? null;
        const runConsumables = authoritativeConsumables ?? this.session.getRunConsumables();
        const powerupCounts = runConsumables.powerupCounts || [];
        runConsumables.powerupCounts = powerupCounts;
        const itemId = authoritativeConsumables === null
            ? this.session.getRunConsumables().powerupItems[index]
            : null;
        const type = runConsumables.powerups[index];
        if (type === undefined ||
            (consumeStoredInventory && itemId === undefined)) {
            return;
        }
        if (consumeStoredInventory &&
            !this.isReplaying &&
            !this.shopManager.consumeInventoryItem(itemId)) {
            this.session.getRunConsumables().powerupItems.splice(index, 1);
            runConsumables.powerups.splice(index, 1);
            powerupCounts.splice(index, 1);
            this.renderHotbar();
            return;
        }
        const stackCount = powerupCounts[index] || 1;
        if (stackCount > 1) {
            powerupCounts[index] = stackCount - 1;
        }
        else {
            if (authoritativeConsumables === null) {
                this.session.getRunConsumables().powerupItems.splice(index, 1);
            }
            runConsumables.powerups.splice(index, 1);
            powerupCounts.splice(index, 1);
        }
        this.eventBus.powerupPicked.notify({
            type,
            centerPosition: tank.getCenter(),
            partyIndex,
            hotbarSlot: index,
        });
        if (!this.headless) {
            this.renderHotbar();
        }
    }
    renderHotbar() {
        this.hotbar.removeAllChildren();
        const runConsumables = this.session.getRunConsumables();
        const powerupCounts = runConsumables.powerupCounts || [];
        runConsumables.powerupCounts = powerupCounts;
        for (let index = 0; index < HOTBAR_SLOT_COUNT; index += 1) {
            const slot = new PowerHotbarSlot(index, runConsumables.powerupItems[index], powerupCounts[index] || 0);
            slot.position.set(index * (HOTBAR_SLOT_SIZE + HOTBAR_SLOT_GAP), 0);
            this.hotbar.add(slot);
        }
    }
    consumeClientHotbarSlot(index) {
        const runConsumables = this.session.getRunConsumables();
        const powerupCounts = runConsumables.powerupCounts || [];
        const stackCount = powerupCounts[index] || 1;
        if (stackCount > 1) {
            powerupCounts[index] = stackCount - 1;
        }
        else {
            runConsumables.powerupItems.splice(index, 1);
            runConsumables.powerups.splice(index, 1);
            powerupCounts.splice(index, 1);
        }
        runConsumables.powerupCounts = powerupCounts;
        this.renderHotbar();
    }
}
exports.LevelPlayerScript = LevelPlayerScript;
function getTankTierRank(tier) {
    switch (tier) {
        case tank_1.TankTier.B:
            return 1;
        case tank_1.TankTier.C:
            return 2;
        case tank_1.TankTier.D:
            return 3;
        default:
            return 0;
    }
}
