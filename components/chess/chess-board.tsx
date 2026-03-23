import { ChessPiece, type PieceColor, type PieceType } from "@/components/chess/chess-piece"

type SquarePiece = {
  type: PieceType
  color: PieceColor
}

const BACK_RANK: PieceType[] = ["r", "kn", "b", "q", "k", "b", "kn", "r"]

const INITIAL_POSITION: (SquarePiece | null)[][] = [
  BACK_RANK.map((type) => ({ type, color: "black" })),
  Array.from({ length: 8 }, () => ({ type: "p", color: "black" })),
  Array.from({ length: 8 }, () => null),
  Array.from({ length: 8 }, () => null),
  Array.from({ length: 8 }, () => null),
  Array.from({ length: 8 }, () => null),
  Array.from({ length: 8 }, () => ({ type: "p", color: "white" })),
  BACK_RANK.map((type) => ({ type, color: "white" })),
]

export function ChessBoard() {
  return (
    <section aria-label="Static chess board" className="w-full max-w-[min(92vw,760px)]">
      <div className="bg-chess-board-frame rounded-[1.15rem] border p-3 shadow-[0_24px_40px_rgba(0,0,0,0.26)]">
        <div className="bg-chess-grid grid aspect-square grid-cols-8 grid-rows-8 overflow-hidden rounded-md border">
          {INITIAL_POSITION.flatMap((row, rowIndex) =>
            row.map((piece, colIndex) => {
              const isLightSquare = (rowIndex + colIndex) % 2 === 0

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`bg-chess-square aspect-square flex items-center justify-center ${
                    isLightSquare ? "bg-chess-board-light" : "bg-chess-board-dark"
                  }`}
                >
                  {piece ? <ChessPiece type={piece.type} color={piece.color} /> : null}
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
