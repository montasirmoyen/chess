import type { Color, PieceSymbol } from "chess.js"

type PieceType = PieceSymbol
type PieceColor = Color

const PIECE_LABELS: Record<PieceType, string> = {
  b: "bishop",
  k: "king",
  n: "knight",
  p: "pawn",
  q: "queen",
  r: "rook",
}

interface ChessPieceProps {
  type: PieceType
  color: PieceColor
}

export function ChessPiece({ type, color }: ChessPieceProps) {
  const assetType = type === "n" ? "kn" : type
  const pieceColor = color === "w" ? "white" : "black"
  const src = `/${assetType}-${pieceColor}.svg`
  const label = `${pieceColor} ${PIECE_LABELS[type]}`

  return (
    <img
      src={src}
      alt={label}
      draggable={false}
      className="chess-piece-img pointer-events-none h-[75%] w-[75%] select-none object-contain"
    />
  )
}

export type { PieceColor, PieceType }
