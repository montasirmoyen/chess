"use client"

import { useMemo, useState } from "react"
import { Chess, type Color, type Move, type Square } from "chess.js"

import { ChessPiece } from "@/components/chess/chess-piece"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const

function createGame(fen: string, activeColor?: Color) {
  const game = new Chess()

  if (!activeColor) {
    game.load(fen)

    return game
  }

  const [position, , castling = "-", enPassant = "-", halfmove = "0", fullmove = "1"] =
    fen.split(" ")

  game.load([position, activeColor, castling, enPassant, halfmove, fullmove].join(" "))

  return game
}

function getSquare(rowIndex: number, columnIndex: number) {
  return `${FILES[columnIndex]}${8 - rowIndex}` as Square
}

function getPieceLabel(type: string) {
  switch (type) {
    case "p":
      return "pawn"
    case "n":
      return "knight"
    case "b":
      return "bishop"
    case "r":
      return "rook"
    case "q":
      return "queen"
    case "k":
      return "king"
    default:
      return "piece"
  }
}

function getSquareLabel(square: Square) {
  return `${square[0].toUpperCase()}${square[1]}`
}

export function ChessBoard() {
  const [fen, setFen] = useState(() => new Chess().fen())
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)

  const game = useMemo(() => createGame(fen), [fen])
  const board = useMemo(() => game.board(), [game])
  const selectedPiece = selectedSquare ? game.get(selectedSquare) : null

  const legalMoves = useMemo(() => {
    if (!selectedSquare || !selectedPiece) {
      return []
    }

    const analysisGame = createGame(fen, selectedPiece.color)

    return analysisGame.moves({ square: selectedSquare, verbose: true })
  }, [fen, selectedPiece, selectedSquare])

  const movesByTarget = useMemo(() => {
    return new Map(legalMoves.map((move) => [move.to, move]))
  }, [legalMoves])

  function handleSquareClick(square: Square) {
    if (selectedSquare === square) {
      setSelectedSquare(null)

      return
    }

    const move = movesByTarget.get(square)

    if (selectedSquare && move && selectedPiece) {
      const analysisGame = createGame(fen, selectedPiece.color)

      analysisGame.move({
        from: selectedSquare,
        promotion: move.promotion ?? "q",
        to: square,
      })

      setFen(analysisGame.fen())
      setSelectedSquare(null)

      return
    }

    if (game.get(square)) {
      setSelectedSquare(square)

      return
    }

    setSelectedSquare(null)
  }

  function handleReset() {
    setFen(new Chess().fen())
    setSelectedSquare(null)
  }

  const statusText = selectedPiece
    ? `${selectedPiece.color === "w" ? "White" : "Black"} ${getPieceLabel(selectedPiece.type)} on ${getSquareLabel(selectedSquare!)} · ${legalMoves.length} legal move${legalMoves.length === 1 ? "" : "s"}`
    : "Start playing by clicking on a piece."

  return (
    <section aria-label="Interactive chess sandbox" className="w-full max-w-[min(92vw,760px)]">
      <div className="bg-chess-board-frame rounded-[1.15rem] border p-3 shadow-[0_24px_40px_rgba(0,0,0,0.26)]">
        <div className="bg-chess-grid grid aspect-square grid-cols-8 grid-rows-8 overflow-hidden rounded-md border">
          {board.flatMap((row, rowIndex) =>
            row.map((piece, colIndex) => {
              const isLightSquare = (rowIndex + colIndex) % 2 === 0
              const square = getSquare(rowIndex, colIndex)
              const move = movesByTarget.get(square)
              const isSelected = selectedSquare === square
              const isCapture = Boolean(move?.captured)
              const pieceName = piece ? `${piece.color === "w" ? "white" : "black"} ${getPieceLabel(piece.type)}` : "empty square"

              return (
                <button
                  key={square}
                  type="button"
                  aria-label={`${getSquareLabel(square)}, ${pieceName}`}
                  className={cn(
                    "chess-square chess-square-button aspect-square",
                    isLightSquare ? "bg-chess-board-light" : "bg-chess-board-dark",
                    isSelected && "chess-square-selected"
                  )}
                  onClick={() => handleSquareClick(square)}
                >
                  {move ? (
                    <span className="chess-square-overlay">
                      <span className={isCapture ? "chess-capture-ring" : "chess-move-dot"} />
                    </span>
                  ) : null}
                  {piece ? <ChessPiece type={piece.type} color={piece.color} /> : null}
                </button>
              )
            })
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="max-w-xl text-sm text-foreground/80">{statusText}</p>
        <Button variant="secondary" size="sm" onClick={handleReset}>
          Reset board
        </Button>
      </div>
    </section>
  )
}
