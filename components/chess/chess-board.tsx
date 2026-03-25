"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js"
import { Bot, User } from "lucide-react"

import { ChessPiece } from "@/components/chess/chess-piece"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

function getSquare(rowIndex: number, columnIndex: number) {
  return `${FILES[columnIndex]}${8 - rowIndex}` as Square
}

function getSquareCoords(square: Square) {
  return {
    row: 8 - Number(square[1]),
    col: FILES.indexOf(square[0] as (typeof FILES)[number]),
  }
}

function getPieceLabel(type: string) {
  switch (type) {
    case "p": return "pawn"
    case "n": return "knight"
    case "b": return "bishop"
    case "r": return "rook"
    case "q": return "queen"
    case "k": return "king"
    default:  return "piece"
  }
}

function getSquareLabel(square: Square) {
  return `${square[0].toUpperCase()}${square[1]}`
}

function getColorLabel(color: Color) {
  return color === "w" ? "White" : "Black"
}

function materialScore(pieces: PieceSymbol[]) {
  return pieces.reduce((sum, p) => sum + PIECE_VALUE[p], 0)
}

type GameResult =
  | { type: "checkmate"; winner: Color }
  | { type: "draw"; reason: string }

type PieceIdsBySquare = Record<string, string>

function createInitialPieceIds() {
  const map: PieceIdsBySquare = {}
  const game = new Chess()
  const counters: Record<string, number> = {}

  for (const [rowIndex, row] of game.board().entries()) {
    for (const [colIndex, piece] of row.entries()) {
      if (!piece) continue
      const square = getSquare(rowIndex, colIndex)
      const key = `${piece.color}-${piece.type}`
      counters[key] = (counters[key] ?? 0) + 1
      map[square] = `${key}-${counters[key]}`
    }
  }

  return map
}

function CapturedPieces({
  pieces,
  color,
  advantage,
}: {
  pieces: PieceSymbol[]
  color: Color
  advantage: number
}) {
  const sorted = [...pieces].sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a])

  return (
    <div className="flex min-h-7 items-center gap-1">
      <div className="flex flex-wrap items-center gap-px">
        {sorted.map((type, i) => (
          <div key={i} className="h-6 w-6 shrink-0">
            <ChessPiece type={type} color={color} />
          </div>
        ))}
      </div>
      {advantage > 0 && (
        <span className="text-xs font-medium text-foreground/50">+{advantage}</span>
      )}
    </div>
  )
}

export function ChessBoard() {
  const [fen, setFen] = useState(() => new Chess().fen())
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [pieceIdsBySquare, setPieceIdsBySquare] = useState<PieceIdsBySquare>(() => createInitialPieceIds())
  const pieceIdsRef = useRef<PieceIdsBySquare>(pieceIdsBySquare)
  const [lastMove, setLastMove] = useState<{
    pieceId: string
    from: Square
    to: Square
  } | null>(null)
  // capturedByWhite = black pieces that white has captured
  const [capturedByWhite, setCapturedByWhite] = useState<PieceSymbol[]>([])
  // capturedByBlack = white pieces that black has captured
  const [capturedByBlack, setCapturedByBlack] = useState<PieceSymbol[]>([])
  const [isAiThinking, setIsAiThinking] = useState(false)

  const game = useMemo(() => {
    const g = new Chess()
    g.load(fen)
    return g
  }, [fen])

  const board = useMemo(() => game.board(), [game])
  const selectedPiece = selectedSquare ? game.get(selectedSquare) : null

  // After a move is made, the player in check is the one whose turn it now is
  const checkedColor: Color | null = game.isCheck() ? game.turn() : null

  const checkedKingSquare = useMemo(() => {
    if (!checkedColor) return null
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
    if (!selectedSquare || !selectedPiece || gameResult) return []
    if (selectedPiece.color !== "w") return []
    return game.moves({ square: selectedSquare, verbose: true })
  }, [game, gameResult, selectedPiece, selectedSquare])

  const movesByTarget = useMemo(
    () => new Map(legalMoves.map((m) => [m.to, m])),
    [legalMoves]
  )

  // AI: fires whenever it becomes black's turn
  useEffect(() => {
    if (gameResult || game.turn() !== "b") return

    setIsAiThinking(true)

    const timeout = setTimeout(() => {
      const moves = game.moves({ verbose: true })
      if (moves.length === 0) {
        setIsAiThinking(false)
        return
      }

      const pick = moves[Math.floor(Math.random() * moves.length)]
      const next = new Chess()
      next.load(fen)
      const result = next.move({ from: pick.from, to: pick.to, promotion: pick.promotion ?? "q" })

      if (result.captured) {
        setCapturedByBlack((prev) => [...prev, result.captured as PieceSymbol])
      }

      const currentMap = pieceIdsRef.current
      const movingPieceId = currentMap[pick.from] ?? `${result.color}-${result.piece}-${pick.from}`
      const nextMap = { ...currentMap }
      delete nextMap[pick.from]
      if (result.captured) {
        delete nextMap[pick.to]
      }
      nextMap[pick.to] = movingPieceId
      pieceIdsRef.current = nextMap
      setPieceIdsBySquare(nextMap)
      setLastMove({ pieceId: movingPieceId, from: pick.from, to: pick.to })

      setFen(next.fen())

      if (next.isCheckmate()) {
        setGameResult({ type: "checkmate", winner: "b" })
      } else if (next.isStalemate()) {
        setGameResult({ type: "draw", reason: "stalemate" })
      } else if (next.isDraw()) {
        setGameResult({ type: "draw", reason: "draw" })
      }

      setIsAiThinking(false)
    }, 500)

    return () => clearTimeout(timeout)
  }, [fen, game, gameResult])

  function handleSquareClick(square: Square) {
    if (gameResult || isAiThinking || game.turn() !== "w") return

    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }

    // Execute a move if this square is a legal target
    const move = movesByTarget.get(square)
    if (selectedSquare && move && selectedPiece) {
      const next = new Chess()
      next.load(fen)
      const result = next.move({ from: selectedSquare, to: square, promotion: move.promotion ?? "q" })

      if (result.captured) {
        setCapturedByWhite((prev) => [...prev, result.captured as PieceSymbol])
      }

      const currentMap = pieceIdsRef.current
      const movingPieceId = currentMap[selectedSquare] ?? `${result.color}-${result.piece}-${selectedSquare}`
      const nextMap = { ...currentMap }
      delete nextMap[selectedSquare]
      if (result.captured) {
        delete nextMap[square]
      }
      nextMap[square] = movingPieceId
      pieceIdsRef.current = nextMap
      setPieceIdsBySquare(nextMap)
      setLastMove({ pieceId: movingPieceId, from: selectedSquare, to: square })

      setFen(next.fen())

      if (next.isCheckmate()) {
        setGameResult({ type: "checkmate", winner: "w" })
      } else if (next.isStalemate()) {
        setGameResult({ type: "draw", reason: "stalemate" })
      } else if (next.isDraw()) {
        setGameResult({ type: "draw", reason: "draw" })
      }

      setSelectedSquare(null)
      return
    }

    // Select a white piece
    const piece = game.get(square)
    if (piece?.color === "w") {
      setSelectedSquare(square)
      return
    }

    setSelectedSquare(null)
  }

  function handleReset() {
    setFen(new Chess().fen())
    setGameResult(null)
    setSelectedSquare(null)
    const initialPieceIds = createInitialPieceIds()
    pieceIdsRef.current = initialPieceIds
    setPieceIdsBySquare(initialPieceIds)
    setLastMove(null)
    setCapturedByWhite([])
    setCapturedByBlack([])
    setIsAiThinking(false)
  }

  const whiteScore = materialScore(capturedByWhite)
  const blackScore = materialScore(capturedByBlack)
  const whiteAdv = Math.max(0, whiteScore - blackScore)
  const blackAdv = Math.max(0, blackScore - whiteScore)

  const statusText = gameResult
    ? gameResult.type === "checkmate"
      ? `${getColorLabel(gameResult.winner)} wins by checkmate!`
      : `Draw by ${gameResult.reason}.`
    : isAiThinking
      ? "AI is thinking…"
      : checkedColor
        ? `${getColorLabel(checkedColor)} is in check!`
        : selectedPiece
          ? `${getPieceLabel(selectedPiece.type)} on ${getSquareLabel(selectedSquare!)} — ${legalMoves.length} legal move${legalMoves.length === 1 ? "" : "s"}`
          : game.turn() === "w"
            ? "Your turn — select a white piece."
            : "Waiting for AI…"

  const isInteractive = !gameResult && !isAiThinking && game.turn() === "w"

  return (
    <section aria-label="Chess game" className="w-full max-w-[min(92vw,760px)]">

      {/* AI panel */}
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Bot className="h-4 w-4 opacity-70" />
          <span>AI</span>
          {isAiThinking && (
            <span className="animate-pulse text-xs font-normal text-foreground/50">thinking…</span>
          )}
        </div>
        <CapturedPieces pieces={capturedByBlack} color="w" advantage={blackAdv} />
      </div>

      {/* Board */}
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
              const pieceId = piece ? pieceIdsBySquare[square] : undefined
              const motionOffset =
                piece &&
                pieceId &&
                lastMove &&
                lastMove.pieceId === pieceId &&
                lastMove.to === square
                  ? (() => {
                      const from = getSquareCoords(lastMove.from)
                      const to = getSquareCoords(lastMove.to)
                      return { x: from.col - to.col, y: from.row - to.row }
                    })()
                  : undefined
              const pieceName = piece
                ? `${piece.color === "w" ? "white" : "black"} ${getPieceLabel(piece.type)}`
                : "empty square"

              return (
                <button
                  key={square}
                  type="button"
                  aria-label={`${getSquareLabel(square)}, ${pieceName}`}
                  disabled={!isInteractive}
                  className={cn(
                    "chess-square chess-square-button aspect-square",
                    isLightSquare ? "bg-chess-board-light" : "bg-chess-board-dark",
                    isCheckedKing && "chess-square-in-check",
                    isSelected && "chess-square-selected",
                    !isInteractive && "cursor-not-allowed"
                  )}
                  onClick={() => handleSquareClick(square)}
                >
                  {colIndex === 0 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-0.5 top-0.5 select-none text-[clamp(0.45rem,1.1vw,0.65rem)] font-semibold leading-none",
                        isLightSquare ? "text-chess-board-dark/70" : "text-chess-board-light/70"
                      )}
                    >
                      {8 - rowIndex}
                    </span>
                  )}
                  {rowIndex === 7 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-0.5 right-0.5 select-none text-[clamp(0.45rem,1.1vw,0.65rem)] font-semibold leading-none",
                        isLightSquare ? "text-chess-board-dark/70" : "text-chess-board-light/70"
                      )}
                    >
                      {FILES[colIndex]}
                    </span>
                  )}
                  {move ? (
                    <span className="chess-square-overlay">
                      <span className={isCapture ? "chess-capture-ring" : "chess-move-dot"} />
                    </span>
                  ) : null}
                  {piece ? <ChessPiece type={piece.type} color={piece.color} motionOffset={motionOffset} /> : null}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Player panel */}
      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <User className="h-4 w-4 opacity-70" />
          <span>You</span>
        </div>
        <CapturedPieces pieces={capturedByWhite} color="b" advantage={whiteAdv} />
      </div>

      {/* Status bar */}
      <div className="mt-1 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p
          className={cn(
            "max-w-xl text-sm text-foreground/70",
            gameResult && "font-medium text-foreground"
          )}
        >
          {statusText}
        </p>
        <Button variant="secondary" size="sm" onClick={handleReset}>
          New game
        </Button>
      </div>
    </section>
  )
}
