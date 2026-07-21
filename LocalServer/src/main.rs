mod model;
mod simulation;

use std::{collections::HashMap, net::SocketAddr, sync::Arc, time::Duration};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use model::{ClientMessage, ServerMessage, PLAYER_COUNT};
use simulation::MatchSimulation;
use tokio::sync::{mpsc, RwLock};
use tracing::{error, info, warn};

const TICK_RATE: u64 = 60;
const SNAPSHOT_EVERY_TICKS: u64 = 3;

type Clients = [Option<mpsc::UnboundedSender<Message>>; PLAYER_COUNT];
type SharedRooms = Arc<RwLock<HashMap<String, Room>>>;

#[derive(Clone)]
struct AppState {
    rooms: SharedRooms,
}

struct Room {
    simulation: MatchSimulation,
    clients: Clients,
}

impl Room {
    fn new(config: model::MatchConfig, seed: u64) -> Result<Self, &'static str> {
        Ok(Self {
            simulation: MatchSimulation::new(config, seed)?,
            clients: [None, None],
        })
    }

    fn snapshot_json(&self) -> String {
        let simulation = &self.simulation;
        serde_json::to_string(&ServerMessage::Snapshot {
            tick: simulation.tick,
            phase: simulation.phase.as_str(),
            players: [
                simulation.players[0].snapshot(simulation.tick),
                simulation.players[1].snapshot(simulation.tick),
            ],
            enemies: simulation.enemies(),
            projectiles: simulation.projectiles(),
            board_mutations: simulation.board_mutations(),
            events: simulation.events(),
            base_alive: simulation.base_alive(),
            powerup: simulation.powerup(),
        })
        .expect("snapshot serialization must succeed")
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "battlecity_local_server=info".into()),
        )
        .init();

    let state = AppState {
        rooms: Arc::new(RwLock::new(HashMap::new())),
    };
    tokio::spawn(simulation_loop(state.rooms.clone()));

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/ws", get(websocket_handler))
        .route("/local-game", get(websocket_handler))
        .with_state(state);
    let address = SocketAddr::from(([0, 0, 0, 0], 8787));
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("failed to bind local game server");
    info!(%address, "BattleCity local authoritative server listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("local game server stopped unexpectedly");
}

async fn websocket_handler(
    websocket: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    websocket.on_upgrade(move |socket| handle_socket(socket, state.rooms))
}

async fn handle_socket(socket: WebSocket, rooms: SharedRooms) {
    let (mut socket_sender, mut socket_receiver) = socket.split();
    let (outgoing_sender, mut outgoing_receiver) = mpsc::unbounded_channel::<Message>();
    let writer = tokio::spawn(async move {
        while let Some(message) = outgoing_receiver.recv().await {
            if socket_sender.send(message).await.is_err() {
                break;
            }
        }
    });

    let mut membership: Option<(String, usize)> = None;
    while let Some(result) = socket_receiver.next().await {
        let message = match result {
            Ok(Message::Text(text)) => text,
            Ok(Message::Close(_)) => break,
            Ok(_) => continue,
            Err(error) => {
                warn!(%error, "websocket receive failed");
                break;
            }
        };
        let parsed = match serde_json::from_str::<ClientMessage>(&message) {
            Ok(parsed) => parsed,
            Err(error) => {
                send_error(&outgoing_sender, &format!("invalid message: {error}"));
                continue;
            }
        };
        match parsed {
            ClientMessage::Join {
                room,
                player,
                config,
            } => {
                if membership.is_some() || room.is_empty() || room.len() > 64 || player > 1 {
                    send_error(&outgoing_sender, "invalid or duplicate room join");
                    continue;
                }
                let player_index = usize::from(player);
                let mut room_map = rooms.write().await;
                let seed = stable_room_seed(&room);
                let room_state = if let Some(existing) = room_map.get_mut(&room) {
                    if existing.simulation.config != config {
                        send_error(&outgoing_sender, "room map configuration does not match");
                        continue;
                    }
                    existing
                } else {
                    match Room::new(config, seed) {
                        Ok(created) => room_map.entry(room.clone()).or_insert(created),
                        Err(message) => {
                            send_error(&outgoing_sender, message);
                            continue;
                        }
                    }
                };
                room_state.clients[player_index] = Some(outgoing_sender.clone());
                let player_state = &mut room_state.simulation.players[player_index];
                if !player_state.claimed {
                    player_state.claimed = true;
                }
                player_state.connected = true;
                room_state.simulation.refresh_phase();
                membership = Some((room.clone(), player_index));
                send_json(&outgoing_sender, &ServerMessage::Welcome { player });
                broadcast(room_state);
                info!(room, player, "player joined local match");
            }
            ClientMessage::Input {
                sequence,
                direction,
                moving,
            } => {
                let Some((room_id, player_index)) = membership.as_ref() else {
                    send_error(&outgoing_sender, "join a room before sending input");
                    continue;
                };
                if direction > 3 {
                    send_error(&outgoing_sender, "direction must be between 0 and 3");
                    continue;
                }
                let mut room_map = rooms.write().await;
                let Some(room) = room_map.get_mut(room_id) else {
                    send_error(&outgoing_sender, "room no longer exists");
                    continue;
                };
                room.simulation
                    .set_player_input(*player_index, sequence, direction, moving);
            }
            ClientMessage::Fire { sequence } => {
                let Some((room_id, player_index)) = membership.as_ref() else {
                    send_error(&outgoing_sender, "join a room before firing");
                    continue;
                };
                let mut room_map = rooms.write().await;
                let Some(room) = room_map.get_mut(room_id) else {
                    send_error(&outgoing_sender, "room no longer exists");
                    continue;
                };
                let player = &mut room.simulation.players[*player_index];
                if sequence <= player.fire_sequence {
                    continue;
                }
                player.fire_sequence = sequence;
                player.queued_fire = true;
            }
        }
    }

    if let Some((room_id, player_index)) = membership {
        let mut room_map = rooms.write().await;
        if let Some(room) = room_map.get_mut(&room_id) {
            room.clients[player_index] = None;
            room.simulation.players[player_index].connected = false;
            room.simulation.players[player_index].moving = false;
            broadcast(room);
        }
        info!(
            room = room_id,
            player = player_index,
            "player left local match"
        );
    }
    writer.abort();
}

async fn simulation_loop(rooms: SharedRooms) {
    let mut interval = tokio::time::interval(Duration::from_nanos(1_000_000_000 / TICK_RATE));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        let mut room_map = rooms.write().await;
        for room in room_map.values_mut() {
            let previous_tick = room.simulation.tick;
            room.simulation.tick();
            if room.simulation.tick != previous_tick
                && room.simulation.tick % SNAPSHOT_EVERY_TICKS == 0
            {
                broadcast(room);
            }
        }
    }
}

fn broadcast(room: &mut Room) {
    let message = Message::Text(room.snapshot_json().into());
    for client in &mut room.clients {
        if client
            .as_ref()
            .is_some_and(|sender| sender.send(message.clone()).is_err())
        {
            *client = None;
        }
    }
}

fn send_json(sender: &mpsc::UnboundedSender<Message>, message: &ServerMessage<'_>) {
    match serde_json::to_string(message) {
        Ok(json) => {
            let _ = sender.send(Message::Text(json.into()));
        }
        Err(error) => error!(%error, "failed to serialize server message"),
    }
}

fn send_error(sender: &mpsc::UnboundedSender<Message>, message: &str) {
    send_json(sender, &ServerMessage::Error { message });
}

fn stable_room_seed(room: &str) -> u64 {
    room.bytes().fold(0xcbf2_9ce4_8422_2325, |hash, byte| {
        (hash ^ u64::from(byte)).wrapping_mul(0x1000_0000_01b3)
    })
}

async fn shutdown_signal() {
    if let Err(error) = tokio::signal::ctrl_c().await {
        error!(%error, "failed to install Ctrl+C handler");
    }
}
