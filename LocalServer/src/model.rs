use serde::{Deserialize, Serialize};

pub const PLAYER_COUNT: usize = 2;
pub const MAX_ENEMY_TOTAL: usize = 20;
pub const MAX_ACTIVE_ENEMIES: usize = 6;

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MatchConfig {
    pub field_width: i32,
    pub field_height: i32,
    pub spawns: [Position; PLAYER_COUNT],
    pub enemy_spawns: Vec<Position>,
    pub enemy_tiers: Vec<u8>,
    pub enemy_drops: Vec<bool>,
    pub terrain_width: u8,
    pub terrain_height: u8,
    pub terrain: Vec<u8>,
    pub base_position: Position,
    #[serde(default)]
    pub debug_disable_enemy_shooting: bool,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Join {
        room: String,
        player: u8,
        config: MatchConfig,
    },
    Input {
        sequence: u64,
        direction: u8,
        moving: bool,
    },
    Fire {
        sequence: u64,
    },
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerSnapshot {
    pub x: i32,
    pub y: i32,
    pub direction: u8,
    pub moving: bool,
    pub sequence: u64,
    pub connected: bool,
    pub alive: bool,
    pub lives: u8,
    pub health: u8,
    pub score: u32,
    pub kills: u16,
    pub stunned: bool,
    pub tier: u8,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnemySnapshot {
    pub id: u16,
    pub x: i32,
    pub y: i32,
    pub direction: u8,
    pub tier: u8,
    pub health: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectileOwner {
    Player,
    Enemy,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileSnapshot {
    pub id: u32,
    pub owner: ProjectileOwner,
    pub owner_id: u16,
    pub x: i32,
    pub y: i32,
    pub direction: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardMutation {
    pub x: u8,
    pub y: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PowerupKind {
    #[serde(rename = "defence")]
    BaseDefence,
    Freeze,
    Life,
    Shield,
    Speed,
    Upgrade,
    #[serde(rename = "zoomout")]
    ZoomOut,
    Wipeout,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerupSnapshot {
    pub id: u32,
    pub kind: PowerupKind,
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum GameEvent {
    EnemyDied {
        event_id: u64,
        id: u16,
        killer: u8,
    },
    PlayerDied {
        event_id: u64,
        player: u8,
    },
    BaseDied {
        event_id: u64,
    },
    MatchWon {
        event_id: u64,
    },
    MatchLost {
        event_id: u64,
    },
    PowerupPicked {
        event_id: u64,
        player: u8,
        powerup: PowerupKind,
        x: i32,
        y: i32,
    },
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ServerMessage<'a> {
    Welcome {
        player: u8,
    },
    Snapshot {
        tick: u64,
        phase: &'a str,
        players: [PlayerSnapshot; PLAYER_COUNT],
        enemies: Vec<EnemySnapshot>,
        projectiles: Vec<ProjectileSnapshot>,
        board_mutations: &'a [BoardMutation],
        events: &'a [GameEvent],
        base_alive: bool,
        powerup: Option<PowerupSnapshot>,
    },
    Error {
        message: &'a str,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn game_events_use_the_browser_protocol_field_names() {
        let json = serde_json::to_string(&GameEvent::PowerupPicked {
            event_id: 7,
            player: 1,
            powerup: PowerupKind::Upgrade,
            x: 10,
            y: 20,
        })
        .unwrap();
        assert!(json.contains("\"kind\":\"powerup_picked\""));
        assert!(json.contains("\"eventId\":7"));
        assert!(json.contains("\"powerup\":\"upgrade\""));
    }

    #[test]
    fn snapshots_use_the_browser_protocol_field_names() {
        let player = PlayerSnapshot {
            x: 0,
            y: 0,
            direction: 0,
            moving: false,
            sequence: 0,
            connected: true,
            alive: true,
            lives: 3,
            health: 1,
            score: 0,
            kills: 0,
            stunned: false,
            tier: 0,
        };
        let players = [player, player];
        let json = serde_json::to_string(&ServerMessage::Snapshot {
            tick: 1,
            phase: "active",
            players,
            enemies: Vec::new(),
            projectiles: Vec::new(),
            board_mutations: &[],
            events: &[],
            base_alive: true,
            powerup: None,
        })
        .unwrap();

        assert!(json.contains("\"boardMutations\":[]"));
        assert!(json.contains("\"baseAlive\":true"));
        assert!(!json.contains("board_mutations"));
        assert!(!json.contains("base_alive"));
    }
}
