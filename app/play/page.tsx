"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { ChessBoard } from "@/components/chess/chess-board"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { MenuSquare } from "lucide-react"
import { parseAIDifficulty } from "@/lib/chess-ai"

export default function Play() {
  const [showMovesHistory, setShowMovesHistory] = useState(false)
  const searchParams = useSearchParams()
  const difficulty = parseAIDifficulty(searchParams.get("difficulty"))
  const playerColor = searchParams.get("color") === "black" ? "b" : "w"

  const toggleMovesHistoryGUI = () => {
    setShowMovesHistory((prev) => !prev)
  }

  return (
    <main className="chess-page-bg relative flex min-h-svh items-center justify-center px-4 py-8">
      <div className="absolute right-4 top-4 gap-4 flex items-center">
        <Button className="h-9 w-9" size="icon" variant="outline" onClick={toggleMovesHistoryGUI} aria-pressed={showMovesHistory}>
          <MenuSquare className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
      <ChessBoard difficulty={difficulty} playerColor={playerColor} showMovesHistory={showMovesHistory} />
    </main>
  )
}
