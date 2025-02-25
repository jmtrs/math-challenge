import React, { useEffect, useRef, useState } from "react";
import msgpack from "msgpack-lite";
import { AnimatePresence } from "framer-motion";

import { FallingText, FallingTextData } from "./components/FallingText";
import { ScoreDisplay } from "./components/ScoreDisplay";
import { GameBoard } from "./components/GameBoard";
import { GameState } from "./types";

type Problem = {
  id: string;
  a: number;
  b: number;
  operator: string;
};

export default function App() {
  const hasConnectedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 2) Estados para la partida
  const [gameState, setGameState] = useState<GameState>(GameState.Waiting);
  const [team, setTeam] = useState<"Team A" | "Team B" | null>(null);
  const [scores, setScores] = useState({ teamA: 0, teamB: 0 });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [answer, setAnswer] = useState("");
  const [fallingTexts, setFallingTexts] = useState<FallingTextData[]>([]);
  const [winningTeam, setWinningTeam] = useState<"Team A" | "Team B" | null>(
    null
  );

  // 3) useEffect para crear la conexión WebSocket solo una vez
  useEffect(() => {
    if (hasConnectedRef.current) return;
    hasConnectedRef.current = true;

    if (!wsRef.current) {
      const socket = new WebSocket("ws://localhost:3000");
      socket.binaryType = "arraybuffer";

      socket.onopen = () => {
        console.log("Conectado al servidor WebSocket");
        wsRef.current = socket;
        const playerName = "Player_" + Math.floor(Math.random() * 10000);
        const msg = msgpack.encode({ type: "set_username", name: playerName });
        socket.send(msg);
      };

      socket.onmessage = (event) => {
        const data = msgpack.decode(new Uint8Array(event.data));
        console.log("Servidor =>", data);

        switch (data.type) {
          case "player_id":
            setTeam(data.team);
            break;

          case "game_started":
            setGameState(GameState.InProgress);
            setScores({ teamA: 0, teamB: 0 });
            setWinningTeam(null);
            break;

          case "new_problem":
            setProblem(data.problem);
            setAnswer("");
            break;

          case "score_update":
            setScores({
              teamA: data.teamAScore,
              teamB: data.teamBScore,
            });
            if (data.fallingText) {
              addFallingText(data.fallingText);
            }
            break;

          case "wrong_answer":
            console.log("Respuesta incorrecta");
            break;

          case "game_over":
            setGameState(GameState.GameOver);
            if (data.winningTeam) {
              setWinningTeam(data.winningTeam);
            }
            break;

          case "game_state":
            setScores({
              teamA: data.state.teamAScore,
              teamB: data.state.teamBScore,
            });
            if (data.state.waiting) {
              setGameState(GameState.Waiting);
            }
            break;

          case "room_closed":
            alert("La sala se ha cerrado: " + data.content);
            setGameState(GameState.GameOver);
            setWinningTeam(null);
            break;

          case "rematch_request":
            console.log("Rematch request:", data.content);
            break;
        }
      };

      socket.onclose = () => {
        console.log("Desconectado del servidor WebSocket");
        wsRef.current = null; // Limpia la ref
      };
    }

    // Al desmontar el componente, cierra el socket
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Añade texto cayendo
  function addFallingText(text: string) {
    const id = Date.now();
    const x = Math.random() * (window.innerWidth - 200);
    setFallingTexts((prev) => [...prev, { id, text, x }]);
  }

  // handleSubmit: usamos la ref directamente
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const socket = wsRef.current; // Cogemos la instancia de la ref
    if (!socket || !problem) {
      console.log("No hay socket o problem, no se envía la respuesta");
      return;
    }

    const numericAnswer = parseInt(answer, 10);
    console.log(
      "Enviando respuesta al server:",
      numericAnswer,
      "problemId:",
      problem.id
    );

    const msg = msgpack.encode({
      type: "answer",
      answer: numericAnswer,
      problemId: problem.id,
    });
    socket.send(msg);

    setAnswer("");
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col items-center bg-black">
      <AnimatePresence>
        {fallingTexts.map((item) => (
          <FallingText
            key={item.id}
            data={item}
            onComplete={() =>
              setFallingTexts((prev) => prev.filter((t) => t.id !== item.id))
            }
          />
        ))}
      </AnimatePresence>

      <h1 className="z-10 mt-8 text-4xl font-bold text-white">
        Math Challenge
      </h1>

      <ScoreDisplay scores={scores} currentTeam={team || "Team A"} />

      <GameBoard
        gameState={gameState}
        problem={problem}
        answer={answer}
        onAnswerChange={(val) => setAnswer(val)}
        onSubmit={handleSubmit}
        winningTeam={winningTeam}
      />
    </div>
  );
}
