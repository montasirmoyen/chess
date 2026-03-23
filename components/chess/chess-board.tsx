"use client"

import { useMemo, useState } from "react"
import { Chess, type Color, type Square } from "chess.js"

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

function getColorLabel(color: Color) {
  return color === "w" ? "White" : "Black"
}

type GameResult = {
  loser: Color
  winner: Color
}

export function ChessBoard() {
  const [fen, setFen] = useState(() => new Chess().fen())
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)

  const game = useMemo(() => createGame(fen), [fen])
  const board = useMemo(() => game.board(), [game])
  const selectedPiece = selectedSquare ? game.get(selectedSquare) : null
  const checkedColor = useMemo(() => {
    if (createGame(fen, "w").isCheck()) {
      return "w"
    }

    if (createGame(fen, "b").isCheck()) {
      return "b"
    }

    return null
  }, [fen])
  const checkedKingSquare = useMemo(() => {
    if (!checkedColor) {
      return null
    }

    for (const [rowIndex, row] of board.entries()) {
      for (const [colIndex, piece] of row.entries()) {
        if (piece?.type === "k" && piece.color === checkedColor) {
          return getSquare(rowIndex, colIndex)
        }
      }
    }

    return null
  }, [board, checkedColor])

  const legalMoves = useMemo(() => {
    if (!selectedSquare || !selectedPiece || gameResult) {
      return []
    }

    if (checkedColor && (selectedPiece.color !== checkedColor || selectedPiece.type !== "k")) {
      return []
    }

    const analysisGame = createGame(fen, selectedPiece.color)

    return analysisGame
      .moves({ square: selectedSquare, verbose: true })
      .filter((move) => move.captured !== "k")
  }, [checkedColor, fen, gameResult, selectedPiece, selectedSquare])

  const movesByTarget = useMemo(() => {
    return new Map(legalMoves.map((move) => [move.to, move]))
  }, [legalMoves])

  function handleSquareClick(square: Square) {
    if (gameResult) {
      return
    }

    if (selectedSquare === square) {
      setSelectedSquare(null)

      return
    }

    const move = movesByTarget.get(square)

    if (selectedSquare && move && selectedPiece) {
      const analysisGame = createGame(fen, selectedPiece.color)
      const capturedPiece = game.get(square)

      if (capturedPiece?.type === "k") {
        setSelectedSquare(null)

        return
      }

      analysisGame.move({
        from: selectedSquare,
        promotion: move.promotion ?? "q",
        to: square,
      })

      const nextFen = analysisGame.fen()
      const defendingColor = selectedPiece.color === "w" ? "b" : "w"
      const defendingGame = createGame(nextFen, defendingColor)

      setFen(nextFen)
      setGameResult(
        defendingGame.isCheckmate()
          ? {
              loser: defendingColor,
              winner: selectedPiece.color,
            }
          : null
      )
      setSelectedSquare(null)

      return
    }

    const piece = game.get(square)

    if (piece) {
      if (checkedColor && (piece.color !== checkedColor || piece.type !== "k")) {
        setSelectedSquare(null)

        return
      }

      setSelectedSquare(square)

      return
    }

    setSelectedSquare(null)
  }

  function handleReset() {
    setFen(new Chess().fen())
    setGameResult(null)
    setSelectedSquare(null)
  }

  const statusText = gameResult
    ? `${getColorLabel(gameResult.winner)} wins by checkmate. Reset the board to start again.`
    : checkedColor
      ? `${getColorLabel(checkedColor)} is in check. Move the king to a safe square.`
    : selectedPiece
      ? `${getColorLabel(selectedPiece.color)} ${getPieceLabel(selectedPiece.type)} on ${getSquareLabel(selectedSquare!)} · ${legalMoves.length} legal move${legalMoves.length === 1 ? "" : "s"}`
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
              const isCheckedKing = checkedKingSquare === square
              const isSelected = selectedSquare === square
              const isCapture = Boolean(move?.captured)
              const pieceName = piece ? `${piece.color === "w" ? "white" : "black"} ${getPieceLabel(piece.type)}` : "empty square"

              return (
                <button
                  key={square}
                  type="button"
                  aria-label={`${getSquareLabel(square)}, ${pieceName}`}
                  disabled={Boolean(gameResult)}
                  className={cn(
                    "chess-square chess-square-button aspect-square",
                    isLightSquare ? "bg-chess-board-light" : "bg-chess-board-dark",
                    isCheckedKing && "chess-square-in-check",
                    isSelected && "chess-square-selected",
                    gameResult && "cursor-not-allowed"
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
        <p className={cn("max-w-xl text-sm text-foreground/80", gameResult && "font-medium text-foreground")}>
          {statusText}
        </p>
        <Button variant="secondary" size="sm" onClick={handleReset}>
          Reset board
        </Button>
      </div>
    </section>
  )
}
