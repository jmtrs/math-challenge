import { motion } from "framer-motion";

export type FallingTextData = {
  id: number;
  text: string;
  x: number;
};

interface FallingTextProps {
  data: FallingTextData;
  onComplete: () => void;
}

export function FallingText({ data, onComplete }: FallingTextProps) {
  return (
    <motion.div
      initial={{ y: -100, opacity: 1 }}
      animate={{ y: window.innerHeight + 100, opacity: 1 }}
      transition={{ duration: 2.5, ease: "easeIn" }}
      onAnimationComplete={onComplete}
      style={{
        position: "absolute",
        left: data.x,
        fontSize: "1rem",
        fontWeight: "bold",
        color: "#fff",
        pointerEvents: "none",
      }}
    >
      {data.text}
    </motion.div>
  );
}
