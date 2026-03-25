import type { Color, PieceSymbol } from "chess.js"
import type { CSSProperties } from "react"

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
  motionOffset?: {
    x: number
    y: number
  }
}

export function ChessPiece({ type, color, motionOffset }: ChessPieceProps) {
  const assetType = type === "n" ? "kn" : type
  const pieceColor = color === "w" ? "white" : "black"
  const src = `/${assetType}-${pieceColor}.svg`
  const label = `${pieceColor} ${PIECE_LABELS[type]}`
  const motionStyle = motionOffset
    ? ({
        "--chess-piece-dx": `${motionOffset.x * 100}%`,
        "--chess-piece-dy": `${motionOffset.y * 100}%`,
      } as CSSProperties)
    : undefined

  return (
    <img
      src={src}
      alt={label}
      draggable={false}
      style={motionStyle}
      className={`chess-piece-img pointer-events-none h-[75%] w-[75%] select-none object-contain ${motionOffset ? "chess-piece-move" : ""}`}
    />
  )
}

export type { PieceColor, PieceType }
