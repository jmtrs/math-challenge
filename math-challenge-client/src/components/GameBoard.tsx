import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import { GameState } from "../types";

type Problem = { a: number; b: number; operator: string };

interface GameBoardProps {
  gameState: GameState;
  problem: Problem;
  answer: string;
  scores: { teamA: number; teamB: number };
  onAnswerChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function GameBoard({
  gameState,
  problem,
  answer,
  scores,
  onAnswerChange,
  onSubmit,
}: GameBoardProps) {
  return (
    <div className="z-10 bg-muted/20 backdrop-blur border border-white/10 rounded-xl p-6 shadow-lg">
      <AnimatePresence mode="wait">
        {gameState === GameState.Waiting && (
          <motion.div
            key={GameState.Waiting}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center space-y-4 py-4"
          >
            <div className="spinner" />
            <p className="text-sm text-muted-foreground">
              Waiting for players...
            </p>
          </motion.div>
        )}

        {gameState === GameState.InProgress && (
          <motion.form
            key={GameState.InProgress}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={onSubmit}
            className="flex flex-col items-center space-y-6 py-4"
          >
            <motion.div
              key={`${problem.a}-${problem.operator}-${problem.b}`}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-4 text-3xl font-bold text-white"
            >
              <span>{problem.a}</span>
              <span className="text-primary">{problem.operator}</span>
              <span>{problem.b}</span>
              <span>=</span>
              <input
                type="number"
                value={answer}
                onChange={(e) => onAnswerChange(e.target.value)}
                className="w-24 text-center text-xl bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all"
                autoFocus
              />
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "#e2e2e2" }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="bg-white text-black font-semibold px-6 py-3 rounded-md border border-black/10 shadow-md transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              Submit
            </motion.button>
          </motion.form>
        )}

        {gameState === GameState.GameOver && (
          <motion.div
            key={GameState.GameOver}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-4 space-y-2"
          >
            <h2 className="text-2xl font-bold text-primary">
              {scores.teamA > scores.teamB ? "Team A" : "Team B"} Wins!
            </h2>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
