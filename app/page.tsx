import { ChessBoard } from "@/components/chess/chess-board"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export default function Page() {
  return (
    <main className="chess-page-bg relative flex min-h-svh items-center justify-center px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <ChessBoard />
    </main>
  )
}
