"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js"
import { Bot, User } from "lucide-react"

import { chooseAIMove, resolveAIDifficulty, type AIDifficulty } from "@/lib/chess-ai"
import { cn, capitalize } from "@/lib/utils"

import { ChessPiece } from "@/components/chess/chess-piece"
import { ChatBot } from "@/components/chess/chatbot"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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
    default: return "piece"
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

type MoveHistoryEntry = {
  color: Color
  san: string
  from: Square
  to: Square
  flags: string
  piece: PieceSymbol
  captured?: PieceSymbol
  promotion?: PieceSymbol
}

type PieceMotion = {
  pieceId: string
  from: Square
  to: Square
  motionVariant: "normal" | "castle" | "undo"
}

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

function getGameResult(game: Chess): GameResult | null {
  if (game.isCheckmate()) {
    return { type: "checkmate", winner: game.turn() === "w" ? "b" : "w" }
  }
  if (game.isStalemate()) {
    return { type: "draw", reason: "stalemate" }
  }
  if (game.isDraw()) {
    return { type: "draw", reason: "draw" }
  }
  return null
}

function getCastlingRookMove(move: Pick<Move, "color" | "flags">) {
  if (move.flags.includes("k")) {
    return move.color === "w"
      ? ({ from: "h1", to: "f1" } as const)
      : ({ from: "h8", to: "f8" } as const)
  }

  if (move.flags.includes("q")) {
    return move.color === "w"
      ? ({ from: "a1", to: "d1" } as const)
      : ({ from: "a8", to: "d8" } as const)
  }

  return null
}

function getCapturedSquare(move: Pick<Move, "from" | "to" | "flags">) {
  if (move.flags.includes("e")) {
    return `${move.to[0]}${move.from[1]}` as Square
  }

  return move.to
}

function applyMoveToPieceMap(currentMap: PieceIdsBySquare, move: Move) {
  const nextMap = { ...currentMap }
  const movingPieceId = nextMap[move.from] ?? `${move.color}-${move.piece}-${move.from}`
  const motionVariant: PieceMotion["motionVariant"] =
    move.flags.includes("k") || move.flags.includes("q") ? "castle" : "normal"
  const motions: PieceMotion[] = [{ pieceId: movingPieceId, from: move.from, to: move.to, motionVariant }]

  delete nextMap[move.from]

  if (move.captured) {
    delete nextMap[getCapturedSquare(move)]
  }

  nextMap[move.to] = movingPieceId

  const rookMove = getCastlingRookMove(move)
  if (rookMove) {
    const rookPieceId = nextMap[rookMove.from] ?? `${move.color}-r-${rookMove.from}`
    delete nextMap[rookMove.from]
    nextMap[rookMove.to] = rookPieceId
    motions.push({ pieceId: rookPieceId, from: rookMove.from, to: rookMove.to, motionVariant: "castle" })
  }

  return { nextMap, motions }
}

function buildUndoMotions(movesToUndo: MoveHistoryEntry[], nextMap: PieceIdsBySquare) {
  const motions: PieceMotion[] = []

  for (const move of movesToUndo) {
    const movingPieceId = nextMap[move.from] ?? `${move.color}-${move.piece}-${move.from}`
    motions.push({
      pieceId: movingPieceId,
      from: move.to,
      to: move.from,
      motionVariant: "undo",
    })

    const rookMove = getCastlingRookMove(move)
    if (rookMove) {
      const rookPieceId = nextMap[rookMove.from] ?? `${move.color}-r-${rookMove.from}`
      motions.push({
        pieceId: rookPieceId,
        from: rookMove.to,
        to: rookMove.from,
        motionVariant: "undo",
      })
    }
  }

  return motions
}

function buildStateFromMoveHistory(moveHistory: MoveHistoryEntry[]) {
  const replay = new Chess()
  let currentMap = createInitialPieceIds()
  const nextCapturedByWhite: PieceSymbol[] = []
  const nextCapturedByBlack: PieceSymbol[] = []
  let nextLastMoveMotions: PieceMotion[] = []

  for (const move of moveHistory) {
    const result = replay.move({ from: move.from, to: move.to, promotion: move.promotion })
    if (!result) continue

    if (result.captured) {
      if (result.color === "w") {
        nextCapturedByWhite.push(result.captured as PieceSymbol)
      } else {
        nextCapturedByBlack.push(result.captured as PieceSymbol)
      }
    }

    const { nextMap, motions } = applyMoveToPieceMap(currentMap, result)
    currentMap = nextMap
    nextLastMoveMotions = motions
  }

  return {
    fen: replay.fen(),
    pieceIdsBySquare: currentMap,
    capturedByWhite: nextCapturedByWhite,
    capturedByBlack: nextCapturedByBlack,
    lastMoveMotions: nextLastMoveMotions,
    gameResult: getGameResult(replay),
  }
}

function generateBoardContext(
  game: Chess,
  moveHistory: MoveHistoryEntry[],
  capturedByWhite: PieceSymbol[],
  capturedByBlack: PieceSymbol[]
): string {
  if (moveHistory.length === 0) {
    return "The game just started, all pieces are in their default positions."
  }

  const board = game.board()
  let context = "Current board position:\n"

  for (let row = 7; row >= 0; row--) {
    const rowPieces: string[] = []
    for (let col = 0; col < 8; col++) {
      const piece = board[7 - row][col]
      if (piece) {
        const square = `${FILES[col]}${row + 1}`
        const colorName = piece.color === "w" ? "White" : "Black"
        const pieceName = capitalize(getPieceLabel(piece.type))
        rowPieces.push(`${colorName} ${pieceName} on ${square}`)
      }
    }
    if (rowPieces.length > 0) {
      context += `Rank ${row + 1}: ${rowPieces.join(", ")}\n`
    }
  }

  // Add captured pieces info
  if (capturedByWhite.length > 0) {
    const captured = capturedByWhite.map((p) => capitalize(getPieceLabel(p))).join(", ")
    context += `\nCaptured by White (black pieces): ${captured}`
  }
  if (capturedByBlack.length > 0) {
    const captured = capturedByBlack.map((p) => capitalize(getPieceLabel(p))).join(", ")
    context += `\nCaptured by Black (white pieces): ${captured}`
  }

  // Add game state info
  if (game.isCheck()) {
    context += `\n${getColorLabel(game.turn())} is in check!`
  }
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "Black" : "White"
    context += `\nCheckmate! ${winner} wins.`
  }
  if (game.isDraw() || game.isStalemate()) {
    context += `\nThe game is a draw.`
  }

  // Add last few moves
  if (moveHistory.length > 0) {
    const lastMoves = moveHistory.slice(-6).map((m) => m.san).join(" ")
    context += `\n\nLast moves: ${lastMoves}`
  }

  return context
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

export function ChessBoard({
  difficulty = "easy",
  playerColor = "w",
  showMovesHistory = false,
  showAIChatBot = false,
}: {
  difficulty?: AIDifficulty
  playerColor?: Color
  showMovesHistory?: boolean
  showAIChatBot?: boolean
}) {
  const [fen, setFen] = useState(() => new Chess().fen())
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [pieceIdsBySquare, setPieceIdsBySquare] = useState<PieceIdsBySquare>(() => createInitialPieceIds())
  const pieceIdsRef = useRef<PieceIdsBySquare>(pieceIdsBySquare)
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([])
  const [lastMoveMotions, setLastMoveMotions] = useState<PieceMotion[]>([])
  const [capturedByWhite, setCapturedByWhite] = useState<PieceSymbol[]>([])
  const [capturedByBlack, setCapturedByBlack] = useState<PieceSymbol[]>([])
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [hintsRemaining, setHintsRemaining] = useState<number>(() => 3)
  const [hintedAtMoveCount, setHintedAtMoveCount] = useState<number | null>(null)
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null)
  const [showHint, setShowHint] = useState(true)
  const isPlayingAgainstAi = true
  const aiColor: Color = playerColor === "w" ? "b" : "w"
  const engineDifficulty = resolveAIDifficulty(difficulty)
  const aiDifficultyLabel = difficulty === "hard" ? "Hard (medium engine)" : capitalize(engineDifficulty)

  const game = useMemo(() => {
    const g = new Chess()
    g.load(fen)
    return g
  }, [fen])

  const board = useMemo(() => game.board(), [game])
  const selectedPiece = selectedSquare ? game.get(selectedSquare) : null

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
    if (selectedPiece.color !== playerColor) return []
    return game.moves({ square: selectedSquare, verbose: true })
  }, [game, gameResult, playerColor, selectedPiece, selectedSquare])

  const movesByTarget = useMemo(
    () => new Map(legalMoves.map((m) => [m.to, m])),
    [legalMoves]
  )

  function commitMove(result: Move, next: Chess) {
    setMoveHistory((prev) => [
      ...prev,
      {
        color: result.color,
        san: result.san,
        from: result.from,
        to: result.to,
        flags: result.flags,
        piece: result.piece,
        captured: result.captured as PieceSymbol | undefined,
        promotion: result.promotion as PieceSymbol | undefined,
      },
    ])

    if (result.captured) {
      if (result.color === "w") {
        setCapturedByWhite((prev) => [...prev, result.captured as PieceSymbol])
      } else {
        setCapturedByBlack((prev) => [...prev, result.captured as PieceSymbol])
      }
    }

    const currentMap = pieceIdsRef.current
    const { nextMap, motions } = applyMoveToPieceMap(currentMap, result)
    pieceIdsRef.current = nextMap
    setPieceIdsBySquare(nextMap)
    setLastMoveMotions(motions)

    setFen(next.fen())
    setGameResult(getGameResult(next))
  }

  useEffect(() => {
    if (gameResult || game.turn() !== aiColor) return

    const thinkingStartTimeout = setTimeout(() => {
      setIsAiThinking(true)
    }, 0)

    const timeout = setTimeout(() => {
      const next = new Chess()
      next.load(fen)

      const pick = chooseAIMove(next, difficulty, aiColor)
      if (!pick) {
        setGameResult(getGameResult(next))
        setIsAiThinking(false)
        return
      }

      const result = next.move({ from: pick.from, to: pick.to, promotion: pick.promotion ?? "q" })

      commitMove(result, next)

      setIsAiThinking(false)
    }, engineDifficulty === "easy" ? 300 : 450)

    return () => {
      clearTimeout(thinkingStartTimeout)
      clearTimeout(timeout)
    }
  }, [aiColor, difficulty, engineDifficulty, fen, game, gameResult])

  function handleSquareClick(square: Square) {
    if (gameResult || isAiThinking || game.turn() !== playerColor) return

    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }

    const move = movesByTarget.get(square)
    if (selectedSquare && move && selectedPiece) {
      const next = new Chess()
      next.load(fen)
      const result = next.move({ from: selectedSquare, to: square, promotion: move.promotion ?? "q" })

      commitMove(result, next)

      setSelectedSquare(null)
      return
    }

    const piece = game.get(square)
    if (piece?.color === playerColor) {
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
    setLastMoveMotions([])
    setCapturedByWhite([])
    setCapturedByBlack([])
    setMoveHistory([])
    setIsAiThinking(false)
    setHintsRemaining(3)
    setHintedAtMoveCount(null)
    setHintMove(null)
  }

  function handleUndoMove() {
    if (!isPlayingAgainstAi || isAiThinking || moveHistory.length === 0) return

    const halfMovesToUndo = Math.min(2, moveHistory.length)
    const movesToUndo = moveHistory.slice(-halfMovesToUndo)
    const nextHistory = moveHistory.slice(0, -halfMovesToUndo)
    const rebuilt = buildStateFromMoveHistory(nextHistory)
    const undoMotions = buildUndoMotions(movesToUndo, rebuilt.pieceIdsBySquare)

    setMoveHistory(nextHistory)
    setFen(rebuilt.fen)
    setGameResult(rebuilt.gameResult)
    setSelectedSquare(null)
    pieceIdsRef.current = rebuilt.pieceIdsBySquare
    setPieceIdsBySquare(rebuilt.pieceIdsBySquare)
    setLastMoveMotions(undoMotions)
    setCapturedByWhite(rebuilt.capturedByWhite)
    setCapturedByBlack(rebuilt.capturedByBlack)
    setIsAiThinking(false)
  }

  function handleHint() {
    if (!isInteractive) return

    if (hintedAtMoveCount !== moveHistory.length) {
      setHintsRemaining((v) => Math.max(0, v - 1))
      setHintedAtMoveCount(moveHistory.length)
    }

    const next = new Chess()
    next.load(fen)
    const pick = chooseAIMove(next, difficulty, playerColor)
    if (!pick) {
      setHintMove(null)
      setShowHint(false)
      return
    }

    setHintMove({ from: pick.from, to: pick.to })
    setShowHint(true)
  }

  useEffect(() => {
    setHintMove(null)
    setHintedAtMoveCount(null)
    setShowHint(true)
  }, [moveHistory.length])

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
          ? `${capitalize(getPieceLabel(selectedPiece.type))} on ${getSquareLabel(selectedSquare!)} — ${legalMoves.length} legal move${legalMoves.length === 1 ? "" : "s"}`
          : game.turn() === playerColor
            ? `Your turn — select a ${getColorLabel(playerColor).toLowerCase()} piece.`
            : "Waiting for AI…"

  const isInteractive = !gameResult && !isAiThinking && game.turn() === playerColor
  const moveRows = useMemo(() => {
    const rows: Array<{ turn: number; white: string; black: string }> = []

    for (let i = 0; i < moveHistory.length; i += 2) {
      rows.push({
        turn: i / 2 + 1,
        white: moveHistory[i]?.san ?? "",
        black: moveHistory[i + 1]?.san ?? "",
      })
    }

    return rows
  }, [moveHistory])
  const displayRowIndexes = playerColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const displayColIndexes = playerColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]

  // for the ai
  const boardContext = useMemo(
    () => generateBoardContext(game, moveHistory, capturedByWhite, capturedByBlack),
    [game, moveHistory, capturedByWhite, capturedByBlack]
  )

  return (
    <section aria-label="Chess game" className="w-full max-w-[min(92vw,725px)]">
      {/* AI panel */}
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Bot className="h-4 w-4 opacity-70" />
          <span>AI</span>
          <span className="text-xs font-normal text-foreground/50">{aiDifficultyLabel}</span>
          {isAiThinking && (
            <span className="animate-pulse text-xs font-normal text-foreground/50">thinking…</span>
          )}
        </div>
        <CapturedPieces pieces={aiColor === "w" ? capturedByWhite : capturedByBlack} color={playerColor} advantage={aiColor === "w" ? whiteAdv : blackAdv} />
      </div>

      {/* Board */}
      <div className="bg-chess-board-frame rounded-[1.15rem] border p-3 shadow-[0_24px_40px_rgba(0,0,0,0.26)]">
        <div className="bg-chess-grid relative grid aspect-square grid-cols-8 grid-rows-8 overflow-hidden rounded-md border">
          {/* SVG overlay for hint arrow */}
          {hintMove && showHint && (
            (() => {
              const fromCoords = getSquareCoords(hintMove.from)
              const toCoords = getSquareCoords(hintMove.to)

              const visualFromRow = playerColor === "w" ? fromCoords.row : 7 - fromCoords.row
              const visualFromCol = playerColor === "w" ? fromCoords.col : 7 - fromCoords.col
              const visualToRow = playerColor === "w" ? toCoords.row : 7 - toCoords.row
              const visualToCol = playerColor === "w" ? toCoords.col : 7 - toCoords.col

              const unit = 100 / 8
              const x1 = (visualFromCol + 0.5) * unit
              const y1 = (visualFromRow + 0.5) * unit
              const x2 = (visualToCol + 0.5) * unit
              const y2 = (visualToRow + 0.5) * unit

              return (
                <svg
                  aria-hidden
                  className="absolute inset-0 pointer-events-none z-20"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <marker id="hint-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L6,3 L0,6 L2,3 z" fill="#ffffff" opacity="1" />
                    </marker>
                  </defs>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth="1" strokeLinecap="round" markerEnd="url(#hint-arrow)" />
                </svg>
              )
            })()
          )}
          {displayRowIndexes.flatMap((rowIndex, displayRowIndex) =>
            displayColIndexes.map((colIndex, displayColIndex) => {
              const piece = board[rowIndex][colIndex]
              const isLightSquare = (rowIndex + colIndex) % 2 === 0
              const square = getSquare(rowIndex, colIndex)
              const move = movesByTarget.get(square)
              const isCheckedKing = checkedKingSquare === square
              const isSelected = selectedSquare === square
              const isCapture = Boolean(move?.captured)
              const isHintFrom = hintMove?.from === square
              const isHintTo = hintMove?.to === square
              const pieceId = piece ? pieceIdsBySquare[square] : undefined
              const activeMotion =
                piece && pieceId
                  ? lastMoveMotions.find((motion) => motion.pieceId === pieceId && motion.to === square)
                  : undefined
              const motionOffset =
                activeMotion
                  ? (() => {
                    const from = getSquareCoords(activeMotion.from)
                    const to = getSquareCoords(activeMotion.to)
                    return { x: from.col - to.col, y: from.row - to.row }
                  })()
                  : undefined
              const pieceName = piece
                ? `${piece.color === "w" ? "white" : "black"} ${capitalize(getPieceLabel(piece.type))}`
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
                  {displayColIndex === 0 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-0.5 top-0.5 select-none text-[clamp(0.45rem,1.1vw,0.65rem)] font-semibold leading-none",
                        isLightSquare ? "text-chess-board-dark/70" : "text-chess-board-light/70"
                      )}
                    >
                      {square[1]}
                    </span>
                  )}
                  {displayRowIndex === 7 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-0.5 right-0.5 select-none text-[clamp(0.45rem,1.1vw,0.65rem)] font-semibold leading-none",
                        isLightSquare ? "text-chess-board-dark/70" : "text-chess-board-light/70"
                      )}
                    >
                      {square[0]}
                    </span>
                  )}
                  {move ? (
                    <span className="chess-square-overlay">
                      <span className={isCapture ? "chess-capture-ring" : "chess-move-dot"} />
                    </span>
                  ) : null}
                  {(showHint && (isHintFrom || isHintTo)) ? (
                    <span className="chess-square-overlay pointer-events-none">
                      {isHintFrom && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="size-18 rounded-full bg-red-400/90 animate-pulse" />
                        </span>
                      )}
                      {isHintTo && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="size-18 rounded-full bg-red-400/90 animate-pulse" />
                        </span>
                      )}
                    </span>
                  ) : null}
                  {piece ? (
                    <ChessPiece
                      type={piece.type}
                      color={piece.color}
                      motionOffset={motionOffset}
                      motionVariant={activeMotion?.motionVariant ?? "normal"}
                    />
                  ) : null}
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
        <CapturedPieces pieces={playerColor === "w" ? capturedByWhite : capturedByBlack} color={aiColor} advantage={playerColor === "w" ? whiteAdv : blackAdv} />
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
        <div className="flex items-center gap-2">
          {isPlayingAgainstAi && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndoMove}
              disabled={isAiThinking || moveHistory.length === 0}
            >
              Undo move
            </Button>
          )}
          {isPlayingAgainstAi && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleHint}
              disabled={!isInteractive || isAiThinking || hintsRemaining === 0}
            >
              Hint {`(${hintsRemaining})`}
            </Button>
          )}
          {hintMove && showHint && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHint(false)}
            >
              Hide Hint
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger>
              <Button variant="secondary" size="sm">
                New game
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset the current game and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {showMovesHistory && (
        <div className="fixed right-4 top-16 z-30 w-[min(90vw,320px)] rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Moves</h2>
            <span className="text-xs text-muted-foreground">{moveHistory.length} ply</span>
          </div>
          {moveRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No moves yet.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="w-12 pb-1">#</th>
                    <th className="pb-1">White</th>
                    <th className="pb-1">Black</th>
                  </tr>
                </thead>
                <tbody>
                  {moveRows.map((row) => (
                    <tr key={row.turn} className="border-t align-top">
                      <td className="py-1.5 pr-2 text-muted-foreground">{row.turn}.</td>
                      <td className="py-1.5 pr-2 font-medium">{row.white || "-"}</td>
                      <td className="py-1.5 pr-2 font-medium">{row.black || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}