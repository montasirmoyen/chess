type PieceType = "k" | "q" | "r" | "b" | "kn" | "p"
type PieceColor = "white" | "black"

interface ChessPieceProps {
  type: PieceType
  color: PieceColor
}

export function ChessPiece({ type, color }: ChessPieceProps) {
  const src = `/${type}-${color}.svg`
  const label = `${color} ${type === "kn" ? "knight" : type}`

  return (
    <img
      src={src}
      alt={label}
      draggable={false}
      className="chess-piece-img pointer-events-none h-[78%] w-[78%] select-none object-contain"
    />
  )
}

export type { PieceColor, PieceType }
