const WebSocket = require("ws");
const http = require("http");
const msgpack = require("msgpack-lite");
const Heap = require("heap");
const { send } = require("process");

const PORT = process.env.PORT || 3000;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// ----------------------------------------------------
//   Configuraciones y estructuras de datos
// ----------------------------------------------------
let rooms = {}; // { [roomId]: { ...infoDeLaSala... } }
let roomCount = 0; // Para asignar IDs únicos a las salas
let playerRoomMap = {}; // { [playerId]: { roomId, player } }

const MAX_PLAYERS_PER_ROOM = 30;
const MIN_PLAYERS_TO_START = 2; // Cambia según tu lógica
const WIN_SCORE = 9; // Puntos para ganar
const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutos en ms

// Cola de prioridad para inactividad
const roomExpirationHeap = new Heap(
  (a, b) => a.expirationTime - b.expirationTime
);
let expirationTimer = null;

// ----------------------------------------------------
//  Manejo de inactividad de salas
// ----------------------------------------------------
function scheduleNextExpiration() {
  if (expirationTimer) {
    clearTimeout(expirationTimer);
  }
  if (roomExpirationHeap.empty()) return;

  const nextExpiration = roomExpirationHeap.peek();
  const now = Date.now();
  const delay = Math.max(nextExpiration.expirationTime - now, 0);

  expirationTimer = setTimeout(() => {
    handleRoomExpiration();
  }, delay);
}

function handleRoomExpiration() {
  const now = Date.now();
  while (
    !roomExpirationHeap.empty() &&
    roomExpirationHeap.peek().expirationTime <= now
  ) {
    const { roomId, expirationTime } = roomExpirationHeap.pop();
    const room = rooms[roomId];
    if (room && room.expirationTime === expirationTime) {
      console.log(`Eliminando sala ${roomId} por inactividad.`);

      // Notificar a los jugadores que la sala se cierra
      for (let playerId in room.players) {
        sendMessage(playerId, {
          type: "room_closed",
          content: "La sala ha sido cerrada por inactividad.",
        });
        room.players[playerId].ws.close();
      }

      if (room.gameTimeout) clearTimeout(room.gameTimeout);
      if (room.speedInterval) clearInterval(room.speedInterval);

      delete rooms[roomId];
      console.log(`Sala ${roomId} eliminada correctamente.`);
    }
  }
  scheduleNextExpiration();
}

// Actualiza la marca de actividad
function updateRoomActivity(room) {
  room.lastActivity = Date.now();
  room.expirationTime = room.lastActivity + INACTIVITY_LIMIT;
  roomExpirationHeap.push({
    roomId: room.id,
    expirationTime: room.expirationTime,
  });
  if (
    roomExpirationHeap.peek() &&
    roomExpirationHeap.peek().roomId === room.id
  ) {
    scheduleNextExpiration();
  }
}

scheduleNextExpiration(); // Arrancamos el control de inactividad

// ----------------------------------------------------
//   Funciones auxiliares de creación y envío de datos
// ----------------------------------------------------
function createRoom(id) {
  return {
    id,
    players: {}, // { [playerId]: { ... } }
    teamAScore: 0,
    teamBScore: 0,
    gameStarted: false,
    gameTimeout: null,
    speedInterval: null,
    lastActivity: Date.now(),
    expirationTime: Date.now() + INACTIVITY_LIMIT,
    maxPlayersReached: false,
  };
}

// Envía un mensaje a un jugador concreto con msgpack
function sendMessage(playerId, message) {
  const encoded = msgpack.encode(message);
  const mapping = playerRoomMap[playerId];
  if (!mapping) return;
  const player = mapping.player;
  if (player && player.ws.readyState === WebSocket.OPEN) {
    player.ws.send(encoded);
  }
}

// Envía un mensaje a todos los jugadores de la sala
function broadcast(room, message) {
  const encoded = msgpack.encode(message);
  for (let playerId in room.players) {
    const p = room.players[playerId];
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(encoded);
    }
  }
}

// *** NUEVO: Genera un ID único para el problema (para validarlo en la respuesta).
function generateProblem() {
  const ops = ["+", "-", "×"];
  const operator = ops[Math.floor(Math.random() * ops.length)];
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return {
    id: Math.random().toString(36).substring(2, 9), // problemId
    a,
    b,
    operator,
  };
}

function calculateAnswer({ a, b, operator }) {
  switch (operator) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    default:
      return 0;
  }
}

// Enviar a todos el estado de la sala
function broadcastGameState(room) {
  const state = {
    waiting: !room.gameStarted,
    teamAScore: room.teamAScore,
    teamBScore: room.teamBScore,
  };
  broadcast(room, { type: "game_state", state });
}

// *** NUEVO: Asigna equipo con umbral de diferencia > 1
function assignTeam(room) {
  const playersInA = Object.values(room.players).filter(
    (p) => p.team === "Team A"
  ).length;
  const playersInB = Object.values(room.players).filter(
    (p) => p.team === "Team B"
  ).length;

  const diff = playersInA - playersInB;
  // Si la diferencia es mayor a 1, forzamos al equipo con menos
  if (diff > 1) {
    return "Team B";
  } else if (diff < -1) {
    return "Team A";
  }
  // Si la diferencia no es > 1, se asigna al equipo con menos jugadores
  // (o en caso de empate => Team A por defecto, o haz random si prefieres)
  if (playersInA <= playersInB) {
    return "Team A";
  } else {
    return "Team B";
  }
}

// ----------------------------------------------------
//   Lógica de inicio/fin de juego
// ----------------------------------------------------
function startGame(room) {
  room.gameStarted = true;
  room.teamAScore = 0;
  room.teamBScore = 0;

  for (let playerId in room.players) {
    const player = room.players[playerId];
    player.score = 0;
    player.currentProblem = generateProblem();
    sendMessage(playerId, {
      type: "new_problem",
      problem: player.currentProblem,
    });
  }

  broadcast(room, {
    type: "game_started",
    content: "El juego ha comenzado",
  });
  broadcastGameState(room);
  updateRoomActivity(room);
}

// *** NUEVO: termino prematuro (por ejemplo si se quedan 1 o 0 jugadores en mitad de la partida)
function endGamePremature(room, reason) {
  room.gameStarted = false;
  broadcast(room, {
    type: "game_over",
    winningTeam: "TEAM_NONE", // o null
    reason,
  });
  // Acto seguido podrías plantear si hay rematch o cerrar la sala
  // Aquí optamos por cerrar la sala de inmediato:
  for (let playerId in room.players) {
    sendMessage(playerId, { type: "room_closed", content: reason });
    room.players[playerId].ws.close();
  }
  if (room.gameTimeout) clearTimeout(room.gameTimeout);
  if (room.speedInterval) clearInterval(room.speedInterval);
  delete rooms[room.id];
  console.log(`Sala ${room.id} eliminada prematuramente. Motivo: ${reason}`);
}

function endGame(room, winningTeam) {
  room.gameStarted = false;
  broadcast(room, {
    type: "game_over",
    winningTeam,
    teamAScore: room.teamAScore,
    teamBScore: room.teamBScore,
  });

  // Pedimos rematch
  for (let playerId in room.players) {
    const p = room.players[playerId];
    p.readyForRematch = null;
    sendMessage(playerId, {
      type: "rematch_request",
      content: "¿Quieres jugar de nuevo?",
    });
  }
  updateRoomActivity(room);
}

function checkRematchStatus(room) {
  const players = room.players;
  const readyPlayers = Object.values(players).filter(
    (p) => p.readyForRematch === true
  );

  const allResponded = Object.values(players).every(
    (p) => p.readyForRematch !== null
  );
  if (!allResponded) return;

  if (readyPlayers.length >= MIN_PLAYERS_TO_START) {
    startGame(room);
  } else {
    console.log(
      `No hay suficientes jugadores para un rematch en la sala ${room.id}. Eliminando...`
    );
    for (let playerId in players) {
      sendMessage(playerId, {
        type: "game_over",
        content: "No hay suficientes jugadores para continuar.",
      });
      players[playerId].ws.close();
    }
    if (room.gameTimeout) clearTimeout(room.gameTimeout);
    if (room.speedInterval) clearInterval(room.speedInterval);
    delete rooms[room.id];
    console.log(`Sala ${room.id} eliminada tras rematch fallido.`);
  }
}

// ----------------------------------------------------
//   Manejo de conexiones WebSocket
// ----------------------------------------------------
wss.on("connection", (ws) => {
  ws.id = Math.random().toString(36).substring(2, 9);
  console.log(`Nuevo cliente conectado: ${ws.id}`);

  ws.on("message", (rawData) => {
    let data;
    try {
      data = msgpack.decode(rawData);
    } catch (err) {
      console.error("No se pudo decodificar el mensaje msgpack:", err);
      return;
    }

    const mapping = playerRoomMap[ws.id];
    let room = null;
    let player = null;

    if (mapping) {
      room = rooms[mapping.roomId];
      player = mapping.player;
    }

    switch (data.type) {
      // ========================================
      // 1) Set username y unir a la sala
      // ========================================
      case "set_username": {
        let assignedRoom = null;

        // Busca sala con hueco (< 30) y juego NO iniciado
        for (let roomId in rooms) {
          const r = rooms[roomId];
          if (Object.keys(r.players).length < MAX_PLAYERS_PER_ROOM) {
            assignedRoom = r;
            break;
          }
        }

        // Si no hay sala, crea una nueva
        if (!assignedRoom) {
          assignedRoom = createRoom(roomCount++);
          rooms[assignedRoom.id] = assignedRoom;
          roomExpirationHeap.push({
            roomId: assignedRoom.id,
            expirationTime: assignedRoom.expirationTime,
          });
        }

        // *** NUEVO: asignar equipo usando la función con umbral
        const team = assignTeam(assignedRoom);

        assignedRoom.players[ws.id] = {
          id: ws.id,
          ws,
          name: data.name,
          team,
          score: 0,
          currentProblem: null,
          readyForRematch: null,
        };

        playerRoomMap[ws.id] = {
          roomId: assignedRoom.id,
          player: assignedRoom.players[ws.id],
        };

        console.log(
          `Jugador ${data.name} (ID: ${ws.id}) => sala ${assignedRoom.id}, equipo: ${team}`
        );
        sendMessage(ws.id, { type: "player_id", playerId: ws.id, team });

        updateRoomActivity(assignedRoom);
        if (Object.keys(assignedRoom.players).length === MAX_PLAYERS_PER_ROOM) {
          assignedRoom.maxPlayersReached = true;
        }

        // Iniciar si hay jugadores suficientes
        if (
          Object.keys(assignedRoom.players).length >= MIN_PLAYERS_TO_START &&
          !assignedRoom.gameStarted
        ) {
          startGame(assignedRoom);
        } else {
          broadcastGameState(assignedRoom);

          if (assignedRoom.gameStarted) {
            const newProb = generateProblem();
            assignedRoom.players[ws.id].currentProblem = newProb;
            sendMessage(ws.id, {
              type: "new_problem",
              problem: newProb,
            });
            sendMessage(ws.id, {
              type: "game_started",
              content: "El juego ha comenzado",
            });
            sendMessage(ws.id, {
              type: "game_state",
              state: {
                waiting: false,
                teamAScore: assignedRoom.teamAScore,
                teamBScore: assignedRoom.teamBScore,
              },
            });
          } else {
            broadcastGameState(assignedRoom);
          }
        }
        break;
      }

      // ========================================
      // 2) El jugador envía su respuesta
      // ========================================
      case "answer": {
        if (!room || !player) return; // Jugador no está en sala
        if (!room.gameStarted) return; // El juego no está activo
        if (!player.currentProblem) return; // No tiene un problema asignado

        // *** NUEVO: Validaciones extra
        if (typeof data.answer !== "number") {
          // Descarta si no es un número
          console.log(
            `Respuesta inválida: answer no es número. Jugador: ${player.id}`
          );
          return;
        }
        if (typeof data.problemId !== "string") {
          console.log(`Falta problemId o no es string. Jugador: ${player.id}`);
          return;
        }

        // Verificamos que el problemId coincide con el actual
        if (data.problemId !== player.currentProblem.id) {
          console.log(
            `Jugador ${player.id} envió answer para problemId distinto. Se ignora.`
          );
          return;
        }

        const correctAns = calculateAnswer(player.currentProblem);
        const isCorrect = Number(data.answer) === correctAns;
        if (isCorrect) {
          if (player.team === "Team A") {
            room.teamAScore += 1;
          } else {
            room.teamBScore += 1;
          }
          const { a, b, operator } = player.currentProblem;
          const text = `${player.team}: ${a} ${operator} ${b} = ${correctAns}`;

          broadcast(room, {
            type: "score_update",
            teamAScore: room.teamAScore,
            teamBScore: room.teamBScore,
            fallingText: text,
          });

          // Check fin de juego
          if (room.teamAScore >= WIN_SCORE) {
            endGame(room, "Team A");
          } else if (room.teamBScore >= WIN_SCORE) {
            endGame(room, "Team B");
          } else {
            // Generar siguiente problema para este jugador
            player.currentProblem = generateProblem();
            sendMessage(player.id, {
              type: "new_problem",
              problem: player.currentProblem,
            });
          }
        } else {
          sendMessage(player.id, { type: "wrong_answer" });
        }
        updateRoomActivity(room);
        break;
      }

      // ========================================
      // 3) El jugador responde rematch
      // ========================================
      case "rematch_response": {
        if (!room || !player) return;
        player.readyForRematch = data.ready;
        console.log(
          `Jugador ${player.name} (ID: ${player.id}) => rematch: ${data.ready}`
        );

        updateRoomActivity(room);
        checkRematchStatus(room);
        break;
      }

      // Otras acciones que puedas necesitar...
    }
  });

  // ========================================
  // Al desconectarse un jugador
  // ========================================
  ws.on("close", () => {
    const mapping = playerRoomMap[ws.id];
    if (mapping) {
      const { roomId, player } = mapping;
      const room = rooms[roomId];
      if (room && room.players[ws.id]) {
        console.log(
          `Jugador desconectado: ${room.players[ws.id].name} (ID: ${ws.id})`
        );
        delete room.players[ws.id];
        delete playerRoomMap[ws.id];

        // *** NUEVO: Si el juego estaba en progreso y se quedan < MIN_PLAYERS_TO_START => fin prematuro
        if (room.gameStarted) {
          const numPlayersActual = Object.keys(room.players).length;
          if (numPlayersActual < MIN_PLAYERS_TO_START) {
            // Podemos terminar la partida prematuramente
            endGamePremature(
              room,
              "No hay suficientes jugadores para continuar la partida"
            );
            return;
          }
        }

        // Si todavía hay jugadores
        updateRoomActivity(room);
        broadcastGameState(room);

        // Si la sala queda vacía
        if (Object.keys(room.players).length === 0) {
          if (room.gameTimeout) clearTimeout(room.gameTimeout);
          if (room.speedInterval) clearInterval(room.speedInterval);
          delete rooms[room.id];
          console.log(`Sala ${room.id} eliminada por estar vacía.`);
        } else {
          // Si estábamos en rematch, revisamos
          checkRematchStatus(room);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
