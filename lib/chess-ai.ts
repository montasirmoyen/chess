import { Chess, type Color, type Move, type PieceSymbol } from "chess.js"

export type AIDifficulty = "easy" | "medium" | "hard"
type EngineDifficulty = "easy" | "medium"

const MATERIAL_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

const PAWN_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [0, 0, 0, 0, 0, 0, 0, 0],
] as const

const KNIGHT_TABLE = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
] as const

const BISHOP_TABLE = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
] as const

const ROOK_TABLE = [
  [0, 0, 0, 5, 5, 0, 0, 0],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
] as const

const QUEEN_TABLE = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
] as const

const KING_TABLE = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
] as const

const TABLES: Record<PieceSymbol, readonly (readonly number[])[]> = {
  p: PAWN_TABLE,
  n: KNIGHT_TABLE,
  b: BISHOP_TABLE,
  r: ROOK_TABLE,
  q: QUEEN_TABLE,
  k: KING_TABLE,
}

export function parseAIDifficulty(value: string | null | undefined): AIDifficulty {
  if (value === "medium" || value === "hard") {
    return value
  }

  return "easy"
}

export function resolveAIDifficulty(difficulty: AIDifficulty): EngineDifficulty {
  return difficulty === "easy" ? "easy" : "medium"
}

function getPositionalValue(piece: { color: Color; type: PieceSymbol }, row: number, col: number) {
  const table = TABLES[piece.type]
  const tableRow = piece.color === "w" ? row : 7 - row

  return table[tableRow][col]
}

function evaluatePosition(game: Chess, aiColor: Color) {
  if (game.isCheckmate()) {
    return game.turn() === aiColor ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
  }

  if (game.isDraw() || game.isStalemate() || game.isInsufficientMaterial() || game.isThreefoldRepetition()) {
    return 0
  }

  let score = 0

  for (const [rowIndex, row] of game.board().entries()) {
    for (const [colIndex, piece] of row.entries()) {
      if (!piece) {
        continue
      }

      const value = MATERIAL_VALUE[piece.type] + getPositionalValue(piece, rowIndex, colIndex)
      score += piece.color === aiColor ? value : -value
    }
  }

  return score
}

function orderMoves(moves: Move[]) {
  return [...moves].sort((left, right) => {
    const leftScore = (left.captured ? MATERIAL_VALUE[left.captured as PieceSymbol] : 0) - MATERIAL_VALUE[left.piece]
    const rightScore = (right.captured ? MATERIAL_VALUE[right.captured as PieceSymbol] : 0) - MATERIAL_VALUE[right.piece]

    return rightScore - leftScore
  })
}

function minimax(game: Chess, depth: number, alpha: number, beta: number, aiColor: Color): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluatePosition(game, aiColor)
  }

  const moves = orderMoves(game.moves({ verbose: true }))
  const maximizing = game.turn() === aiColor

  if (maximizing) {
    let bestScore = Number.NEGATIVE_INFINITY

    for (const move of moves) {
      const next = new Chess()
      next.load(game.fen())
      next.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" })

      bestScore = Math.max(bestScore, minimax(next, depth - 1, alpha, beta, aiColor))
      alpha = Math.max(alpha, bestScore)

      if (beta <= alpha) {
        break
      }
    }

    return bestScore
  }

  let bestScore = Number.POSITIVE_INFINITY

  for (const move of moves) {
    const next = new Chess()
    next.load(game.fen())
    next.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" })

    bestScore = Math.min(bestScore, minimax(next, depth - 1, alpha, beta, aiColor))
    beta = Math.min(beta, bestScore)

    if (beta <= alpha) {
      break
    }
  }

  return bestScore
}

function findBestMove(game: Chess, aiColor: Color, depth: number) {
  const moves = orderMoves(game.moves({ verbose: true }))
  let bestMove: Move | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const move of moves) {
    const next = new Chess()
    next.load(game.fen())
    next.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" })

    const score = minimax(next, depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, aiColor)

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove ?? moves[0]
}

export function chooseAIMove(game: Chess, difficulty: AIDifficulty, aiColor: Color) {
  const moves = game.moves({ verbose: true })

  if (moves.length === 0) {
    return null
  }

  const engineDifficulty = resolveAIDifficulty(difficulty)

  if (engineDifficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  return findBestMove(game, aiColor, 3)
}