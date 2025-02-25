import React, { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { FallingText, FallingTextData } from "./components/FallingText";
import { ScoreDisplay } from "./components/ScoreDisplay";
import { GameBoard } from "./components/GameBoard";
import { GameState } from "./types";

type Problem = { a: number; b: number; operator: string };

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.Waiting);
  const [team, setTeam] = useState<"Team A" | "Team B">("Team A");
  const [scores, setScores] = useState({ teamA: 0, teamB: 0 });
  const [problem, setProblem] = useState<Problem>({
    a: 0,
    b: 0,
    operator: "+",
  });
  const [answer, setAnswer] = useState("");
  const [fallingTexts, setFallingTexts] = useState<FallingTextData[]>([]);

  useEffect(() => {
    setTeam(Math.random() < 0.5 ? "Team A" : "Team B");
    const timer = setTimeout(() => {
      setGameState(GameState.InProgress);
      generateProblem();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  function generateProblem() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const ops = ["+", "-", "×"];
    const operator = ops[Math.floor(Math.random() * ops.length)];
    setProblem({ a, b, operator });
  }

  function calculateAnswer(a: number, b: number, operator: string) {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const correctAnswer = calculateAnswer(
      problem.a,
      problem.b,
      problem.operator
    );
    const isCorrect = Number(answer) === correctAnswer;

    setScores((prev) => {
      const newScore = {
        ...prev,
        [team === "Team A" ? "teamA" : "teamB"]:
          prev[team === "Team A" ? "teamA" : "teamB"] + (isCorrect ? 1 : 0),
      };
      if (newScore.teamA >= 9 || newScore.teamB >= 9) {
        setGameState(GameState.GameOver);
      }
      return newScore;
    });

    if (isCorrect) {
      addFallingText(
        `${team}: ${problem.a} ${problem.operator} ${problem.b} = ${correctAnswer}`
      );
    }
    setAnswer("");
    generateProblem();
  }

  function addFallingText(text: string) {
    const id = Date.now();
    const x = Math.random() * (window.innerWidth - 200);
    setFallingTexts((prev) => [...prev, { id, text, x }]);
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

      <ScoreDisplay scores={scores} currentTeam={team} />

      <GameBoard
        gameState={gameState}
        problem={problem}
        answer={answer}
        scores={scores}
        onAnswerChange={(value) => setAnswer(value)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
