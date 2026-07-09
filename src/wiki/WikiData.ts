// Static wiki content (Milestone 5.5). Structure follows the plan's mapping
// of Mattle's wiki to our world — Our Tanks / Weapons & Modules / Powerups /
// Enemy Tanks — with OUR lore, never Mattle's roster. Existing shop/game
// powerups are all represented. Starts as client data; can move server-side
// behind an admin tool later without changing the scene.

export type WikiCategory = 'tanks' | 'weapons' | 'powerups' | 'enemies';

export interface WikiEntry {
  slug: string;
  name: string;
  role: string;
  lore: string;
  effect: string;
  source: string;
}

export const WIKI_CATEGORIES: { id: WikiCategory; label: string }[] = [
  { id: 'tanks', label: 'OUR TANKS' },
  { id: 'weapons', label: 'WEAPONS' },
  { id: 'powerups', label: 'POWERUPS' },
  { id: 'enemies', label: 'ENEMY TANKS' },
];

export const WIKI_ENTRIES: Record<WikiCategory, WikiEntry[]> = {
  tanks: [
    {
      slug: 'vanguard',
      name: 'VANGUARD',
      role: 'PLAYER TANK - TIER 1',
      lore: 'THE STANDARD-ISSUE HULL EVERY COMMANDER STARTS IN.',
      effect: 'BALANCED SPEED AND SINGLE CANNON.',
      source: 'DEFAULT',
    },
    {
      slug: 'vanguard-mk2',
      name: 'VANGUARD MK-II',
      role: 'PLAYER TANK - TIER 2',
      lore: 'FIELD-REFITTED WITH A FASTER BREECH.',
      effect: 'FASTER SHELLS.',
      source: 'STAR UPGRADE X1',
    },
    {
      slug: 'vanguard-mk3',
      name: 'VANGUARD MK-III',
      role: 'PLAYER TANK - TIER 3',
      lore: 'TWIN AUTOLOADERS KEEP TWO SHELLS IN THE AIR.',
      effect: 'DOUBLE SHOT.',
      source: 'STAR UPGRADE X2',
    },
    {
      slug: 'siegebreaker',
      name: 'SIEGEBREAKER',
      role: 'PLAYER TANK - TIER 4',
      lore: 'THE APEX REFIT. STEEL MEANS NOTHING TO IT.',
      effect: 'DOUBLE SHOT + DESTROYS STEEL WALLS.',
      source: 'STAR UPGRADE X3',
    },
  ],
  weapons: [
    {
      slug: 'cannon',
      name: 'CANNON',
      role: 'PRIMARY WEAPON',
      lore: 'ONE BARREL, ONE JOB.',
      effect: 'FIRES A SHELL THAT BREAKS BRICK.',
      source: 'DEFAULT',
    },
    {
      slug: 'twin-shot',
      name: 'TWIN AUTOLOADER',
      role: 'WEAPON MODULE',
      lore: 'TWO SHELLS LOADED, NO WAITING.',
      effect: 'TWO SHELLS AIRBORNE AT ONCE.',
      source: 'TIER 3+',
    },
    {
      slug: 'ap-rounds',
      name: 'AP ROUNDS',
      role: 'WEAPON MODULE',
      lore: 'TUNGSTEN CORES FOR STUBBORN STEEL.',
      effect: 'SHELLS DESTROY STEEL WALLS.',
      source: 'TIER 4',
    },
    {
      slug: 'hull-plating',
      name: 'HULL PLATING',
      role: 'DEFENSE MODULE',
      lore: 'EXTRA PLATES BOLTED OVER THE ENGINE DECK.',
      effect: 'SURVIVE ONE EXTRA HIT.',
      source: 'EVENT / BOOST PERKS',
    },
  ],
  powerups: [
    {
      slug: 'shield',
      name: 'SHIELD',
      role: 'DEFENSIVE POWERUP',
      lore: 'A FLICKERING ENERGY FIELD FROM SALVAGED TECH.',
      effect: 'TEMPORARY INVULNERABILITY.',
      source: 'DROP / SHOP',
    },
    {
      slug: 'base-defence',
      name: 'BASE DEFENCE',
      role: 'DEFENSIVE POWERUP',
      lore: 'ENGINEERS POUR STEEL AROUND HQ IN SECONDS.',
      effect: 'BASE WALLS TURN TO STEEL FOR A TIME.',
      source: 'DROP / SHOP',
    },
    {
      slug: 'freeze',
      name: 'FREEZE',
      role: 'TACTICAL POWERUP',
      lore: 'CRYO CHARGE. THE FRONT GOES SILENT.',
      effect: 'ALL ENEMIES FREEZE IN PLACE.',
      source: 'DROP / SHOP',
    },
    {
      slug: 'speed',
      name: 'SPEED',
      role: 'MOBILITY POWERUP',
      lore: 'OVERTUNED FUEL INJECTORS. HOLD ON.',
      effect: 'TEMPORARY ENGINE BOOST.',
      source: 'DROP / SHOP',
    },
    {
      slug: 'upgrade',
      name: 'STAR',
      role: 'UPGRADE POWERUP',
      lore: 'A FIELD PROMOTION FOR YOUR HULL.',
      effect: 'UPGRADES THE TANK ONE TIER.',
      source: 'DROP / SHOP',
    },
    {
      slug: 'zoom-out',
      name: 'ZOOM OUT',
      role: 'RECON POWERUP',
      lore: 'SPOTTER BALLOON WITH A WIDE LENS.',
      effect: 'PULLS THE CAMERA BACK TO SEE MORE FIELD.',
      source: 'DROP / SHOP',
    },
    {
      slug: 'wipeout',
      name: 'WIPEOUT',
      role: 'OFFENSIVE POWERUP',
      lore: 'DANGER CLOSE. EVERYTHING BURNS.',
      effect: 'DESTROYS ALL ENEMIES ON THE FIELD.',
      source: 'DROP / SHOP',
    },
    {
      slug: 'extra-life',
      name: 'EXTRA LIFE',
      role: 'SUPPORT POWERUP',
      lore: 'A RESERVE CREW AND A SPARE HULL.',
      effect: '+1 LIFE.',
      source: 'DROP / SHOP',
    },
  ],
  enemies: [
    {
      slug: 'scout',
      name: 'SCOUT',
      role: 'ENEMY - LIGHT',
      lore: 'FAST, LOUD, AND FIRST THROUGH THE BREACH.',
      effect: 'HIGH SPEED, ONE HIT TO DESTROY.',
      source: 'ALL LEVELS',
    },
    {
      slug: 'rapid',
      name: 'RAPID',
      role: 'ENEMY - SKIRMISHER',
      lore: 'ITS AUTOLOADER NEVER JAMS. UNFORTUNATELY.',
      effect: 'FAST SHELLS, ONE HIT TO DESTROY.',
      source: 'MID LEVELS',
    },
    {
      slug: 'armored',
      name: 'ARMORED',
      role: 'ENEMY - MEDIUM',
      lore: 'ROLLING SCRAP-PLATE. AIM FOR THE SEAMS.',
      effect: 'TAKES TWO HITS.',
      source: 'MID LEVELS',
    },
    {
      slug: 'heavy',
      name: 'HEAVY',
      role: 'ENEMY - ASSAULT',
      lore: 'A FORTRESS THAT DECIDED TO DRIVE.',
      effect: 'TAKES FOUR HITS. DROPS POWERUPS WHEN FLASHING.',
      source: 'LATE LEVELS',
    },
  ],
};
