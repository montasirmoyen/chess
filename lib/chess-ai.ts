import { Chess, type Color, type Move, type PieceSymbol } from "chess.js"

export type AIDifficulty = "easy" | "medium" | "hard"
type EngineDifficulty = "easy" | "medium" | "hard"

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
  return difficulty
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

// =====================================================================
// HARD AI
// Features: opening book, iterative deepening, quiescence search,
//           killer moves, history heuristic, endgame mop-up evaluation
// =====================================================================

// --- Opening book ---
// Each line is a sequence of UCI moves ("from" + "to" concatenated).
// The AI follows any matching line from the current game history.
const OPENING_LINES: string[][] = [
  // Ruy Lopez – Berlin Defence
  ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "g8f6", "e1g1", "f6e4"],
  // Ruy Lopez – Classical
  ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6", "e1g1", "f8e7"],
  // Italian Game
  ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "c2c3", "g8f6", "d2d4"],
  // Sicilian Najdorf
  ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6"],
  // Sicilian Dragon
  ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "g7g6"],
  // French Defence
  ["e2e4", "e7e6", "d2d4", "d7d5", "b1c3", "g8f6", "c1g5", "f8e7"],
  // Caro-Kann Classical
  ["e2e4", "c7c6", "d2d4", "d7d5", "b1c3", "d5e4", "c3e4", "b8d7", "g1f3"],
  // Queen's Gambit Declined
  ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6", "c1g5", "f8e7", "e2e3", "e8g8"],
  // Queen's Gambit Accepted
  ["d2d4", "d7d5", "c2c4", "d5c4", "g1f3", "g8f6", "e2e3", "e7e6"],
  // King's Indian Defence
  ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7", "e2e4", "d7d6", "g1f3", "e8g8"],
  // Nimzo-Indian Defence
  ["d2d4", "g8f6", "c2c4", "e7e6", "b1c3", "f8b4", "e2e3", "e8g8", "g1f3"],
  // English Opening
  ["c2c4", "e7e5", "b1c3", "g8f6", "g1f3", "b8c6", "e2e3"],
  // London System
  ["d2d4", "d7d5", "g1f3", "g8f6", "c1f4", "e7e6", "e2e3"],
]

function getOpeningBookMove(game: Chess): Move | null {
  const history = game.history({ verbose: true }).map((m) => `${m.from}${m.to}`)

  const matching = OPENING_LINES.filter((line) => {
    if (history.length >= line.length) return false
    return history.every((move, i) => move === line[i])
  })

  if (matching.length === 0) return null

  const line = matching[Math.floor(Math.random() * matching.length)]
  const nextUCI = line[history.length]
  const from = nextUCI.slice(0, 2)
  const to = nextUCI.slice(2, 4)

  return game.moves({ verbose: true }).find((m) => m.from === from && m.to === to) ?? null
}

// --- Enhanced evaluation (endgame mop-up / "tablebase-like" heuristic) ---

function squareToIndex(square: string): number {
  return (parseInt(square[1]) - 1) * 8 + (square.charCodeAt(0) - 97)
}

function manhattanDistance(r1: number, c1: number, r2: number, c2: number): number {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2)
}

/** How far is a square from the nearest corner (0 = on edge, 3 = centre). */
function edgeDistance(row: number, col: number): number {
  return Math.min(row, 7 - row) + Math.min(col, 7 - col)
}

function evaluatePositionHard(game: Chess, aiColor: Color): number {
  if (game.isCheckmate()) {
    return game.turn() === aiColor ? -100_000 : 100_000
  }

  if (game.isDraw() || game.isStalemate() || game.isInsufficientMaterial() || game.isThreefoldRepetition()) {
    return 0
  }

  let score = 0
  let aiMaterial = 0
  let oppMaterial = 0
  let aiKingRow = 0
  let aiKingCol = 0
  let oppKingRow = 0
  let oppKingCol = 0

  for (const [rowIndex, row] of game.board().entries()) {
    for (const [colIndex, piece] of row.entries()) {
      if (!piece) continue

      const positional = getPositionalValue(piece, rowIndex, colIndex)

      if (piece.type === "k") {
        if (piece.color === aiColor) {
          aiKingRow = rowIndex
          aiKingCol = colIndex
        } else {
          oppKingRow = rowIndex
          oppKingCol = colIndex
        }
        score += piece.color === aiColor ? positional : -positional
        continue
      }

      const value = MATERIAL_VALUE[piece.type] + positional

      if (piece.color === aiColor) {
        score += value
        aiMaterial += MATERIAL_VALUE[piece.type]
      } else {
        score -= value
        oppMaterial += MATERIAL_VALUE[piece.type]
      }
    }
  }

  // Endgame mop-up: when we are winning by more than a minor piece and there
  // are few pieces left, push the opponent king to the corner and close in
  // with our king. This approximates basic endgame tablebase knowledge.
  const materialDiff = aiMaterial - oppMaterial
  const totalMaterial = aiMaterial + oppMaterial

  if (materialDiff > 300 && totalMaterial < 2_200) {
    // Reward opponent king being on the edge / corner
    score += (6 - edgeDistance(oppKingRow, oppKingCol)) * 20
    // Reward our king being close to the opponent king (for mating)
    score += (14 - manhattanDistance(aiKingRow, aiKingCol, oppKingRow, oppKingCol)) * 10
  }

  return score
}

// --- Quiescence search (avoids the horizon effect) ---

function orderCaptures(captures: Move[]): Move[] {
  return [...captures].sort((a, b) => {
    // MVV-LVA: most valuable victim, least valuable attacker
    const aScore = MATERIAL_VALUE[a.captured as PieceSymbol] - MATERIAL_VALUE[a.piece]
    const bScore = MATERIAL_VALUE[b.captured as PieceSymbol] - MATERIAL_VALUE[b.piece]
    return bScore - aScore
  })
}

function quiescenceSearch(game: Chess, alpha: number, beta: number, aiColor: Color, qdepth: number): number {
  const standPat = evaluatePositionHard(game, aiColor)

  if (game.isGameOver() || qdepth <= 0) return standPat

  const maximizing = game.turn() === aiColor

  if (maximizing) {
    if (standPat >= beta) return standPat
    let currentAlpha = Math.max(alpha, standPat)

    for (const move of orderCaptures(game.moves({ verbose: true }).filter((m) => m.captured))) {
      const next = new Chess()
      next.load(game.fen())
      next.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" })

      const score = quiescenceSearch(next, currentAlpha, beta, aiColor, qdepth - 1)

      if (score >= beta) return score
      if (score > currentAlpha) currentAlpha = score
    }

    return currentAlpha
  }

  if (standPat <= alpha) return standPat
  let currentBeta = Math.min(beta, standPat)

  for (const move of orderCaptures(game.moves({ verbose: true }).filter((m) => m.captured))) {
    const next = new Chess()
    next.load(game.fen())
    next.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" })

    const score = quiescenceSearch(next, alpha, currentBeta, aiColor, qdepth - 1)

    if (score <= alpha) return score
    if (score < currentBeta) currentBeta = score
  }

  return currentBeta
}

// --- Killer moves and history heuristic ---

const KILLER_DEPTH_LIMIT = 20
// Two killer move slots per ply
const killerMoves: (Move | null)[][] = Array.from({ length: KILLER_DEPTH_LIMIT }, () => [null, null])
// History table: [fromIndex][toIndex] -> score
const historyTable: number[][] = Array.from({ length: 64 }, () => new Array(64).fill(0))

function scoreMoveHard(move: Move, pvMove: Move | null, depthIndex: number): number {
  if (pvMove && move.from === pvMove.from && move.to === pvMove.to) return 20_000

  if (move.captured) {
    return 10_000 + MATERIAL_VALUE[move.captured as PieceSymbol] - MATERIAL_VALUE[move.piece]
  }

  if (depthIndex < KILLER_DEPTH_LIMIT) {
    if (killerMoves[depthIndex][0]?.from === move.from && killerMoves[depthIndex][0]?.to === move.to) return 9_000
    if (killerMoves[depthIndex][1]?.from === move.from && killerMoves[depthIndex][1]?.to === move.to) return 8_000
  }

  return historyTable[squareToIndex(move.from)][squareToIndex(move.to)]
}

function orderMovesHard(moves: Move[], pvMove: Move | null, depthIndex: number): Move[] {
  return [...moves].sort((a, b) => scoreMoveHard(b, pvMove, depthIndex) - scoreMoveHard(a, pvMove, depthIndex))
}

function storeKiller(move: Move, depthIndex: number): void {
  if (depthIndex >= KILLER_DEPTH_LIMIT || move.captured) return
  killerMoves[depthIndex][1] = killerMoves[depthIndex][0]
  killerMoves[depthIndex][0] = move
}

// --- Hard minimax (alpha-beta with quiescence at the leaves) ---

function hardMinimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  aiColor: Color,
  pvMove: Move | null,
  startTime: number,
  timeLimitMs: number,
  depthIndex: number,
): { score: number; timedOut: boolean } {
  if (Date.now() - startTime > timeLimitMs) {
    return { score: evaluatePositionHard(game, aiColor), timedOut: true }
  }

  if (game.isGameOver()) {
    return { score: evaluatePositionHard(game, aiColor), timedOut: false }
  }

  if (depth === 0) {
    return { score: quiescenceSearch(game, alpha, beta, aiColor, 4), timedOut: false }
  }

  const moves = orderMovesHard(game.moves({ verbose: true }), pvMove, depthIndex)
  const maximizing = game.turn() === aiColor

  if (maximizing) {
    let bestScore = Number.NEGATIVE_INFINITY

    for (const move of moves) {
      const next = new Chess()
      next.load(game.fen())
      next.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" })

      const result = hardMinimax(next, depth - 1, alpha, beta, aiColor, null, startTime, timeLimitMs, depthIndex + 1)

      if (result.timedOut) {
        return { score: bestScore === Number.NEGATIVE_INFINITY ? evaluatePositionHard(game, aiColor) : bestScore, timedOut: true }
      }

      if (result.score > bestScore) bestScore = result.score
      if (bestScore > alpha) alpha = bestScore

      if (beta <= alpha) {
        storeKiller(move, depthIndex)
        if (!move.captured) historyTable[squareToIndex(move.from)][squareToIndex(move.to)] += depth * depth
        break
      }
    }

    return { score: bestScore, timedOut: false }
  }

  let bestScore = Number.POSITIVE_INFINITY

  for (const move of moves) {
    const next = new Chess()
    next.load(game.fen())
    next.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" })

    const result = hardMinimax(next, depth - 1, alpha, beta, aiColor, null, startTime, timeLimitMs, depthIndex + 1)

    if (result.timedOut) {
      return { score: bestScore === Number.POSITIVE_INFINITY ? evaluatePositionHard(game, aiColor) : bestScore, timedOut: true }
    }

    if (result.score < bestScore) bestScore = result.score
    if (bestScore < beta) beta = bestScore

    if (beta <= alpha) {
      storeKiller(move, depthIndex)
      if (!move.captured) historyTable[squareToIndex(move.from)][squareToIndex(move.to)] += depth * depth
      break
    }
  }

  return { score: bestScore, timedOut: false }
}

// --- Iterative deepening root search ---

const HARD_TIME_LIMIT_MS = 5_000

function findBestMoveHard(game: Chess, aiColor: Color): Move {
  const allMoves = game.moves({ verbose: true })

  // Reset killers each search; decay history across turns
  for (let i = 0; i < KILLER_DEPTH_LIMIT; i++) killerMoves[i] = [null, null]
  for (let i = 0; i < 64; i++) {
    for (let j = 0; j < 64; j++) historyTable[i][j] >>= 1
  }

  const startTime = Date.now()
  let bestMove: Move = orderMoves(allMoves)[0]
  let pvMove: Move | null = null

  for (let depth = 1; depth <= 7; depth++) {
    if (Date.now() - startTime > HARD_TIME_LIMIT_MS * 0.75) break

    const orderedMoves = orderMovesHard(game.moves({ verbose: true }), pvMove, 0)
    let depthBestMove: Move | null = null
    let depthBestScore = Number.NEGATIVE_INFINITY
    let timedOut = false

    for (const move of orderedMoves) {
      const next = new Chess()
      next.load(game.fen())
      next.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" })

      const result = hardMinimax(
        next,
        depth - 1,
        Number.NEGATIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        aiColor,
        null,
        startTime,
        HARD_TIME_LIMIT_MS,
        1,
      )

      if (result.timedOut) {
        timedOut = true
        break
      }

      if (result.score > depthBestScore) {
        depthBestScore = result.score
        depthBestMove = move
      }
    }

    if (!timedOut && depthBestMove) {
      bestMove = depthBestMove
      pvMove = depthBestMove
    }

    if (timedOut) break
  }

  return bestMove
}

export function chooseAIMove(game: Chess, difficulty: AIDifficulty, aiColor: Color) {
  const moves = game.moves({ verbose: true })

  if (moves.length === 0) {
    return null
  }

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  if (difficulty === "hard") {
    return getOpeningBookMove(game) ?? findBestMoveHard(game, aiColor)
  }

  return findBestMove(game, aiColor, 3)
}