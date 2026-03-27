"use client"

import { type FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import type { AIDifficulty } from "@/lib/chess-ai"

type PieceColorChoice = "white" | "black"

export default function Page() {
    const router = useRouter()
    const [difficulty, setDifficulty] = useState<AIDifficulty>("easy")
    const [pieceColor, setPieceColor] = useState<PieceColorChoice>("white")

    function handlePlay(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const params = new URLSearchParams({ color: pieceColor, difficulty })
        router.push(`/play?${params.toString()}`)
    }

    return (
        <main className="chess-page-bg relative flex min-h-svh items-center justify-center px-4 py-8">
            <div className="absolute right-4 top-4">
                <ThemeToggle />
            </div>
            <div className="flex flex-col items-center gap-4 px-6 py-8">
                <h1 className="text-4xl font-bold">Endgame</h1>

                <Dialog>
                    <DialogTrigger render={<Button size="lg" />}>Play Now</DialogTrigger>
                    <DialogContent className="sm:max-w-sm">
                        <form className="space-y-6" onSubmit={handlePlay}>
                            <DialogHeader>
                                <DialogTitle>Choose AI Difficulty</DialogTitle>
                                <DialogDescription>
                                    Select the difficulty level for the AI opponent.
                                </DialogDescription>
                            </DialogHeader>
                            <RadioGroup value={difficulty} onValueChange={(value) => setDifficulty(value as AIDifficulty)} className="w-fit">
                                <div className="flex items-center gap-3">
                                    <RadioGroupItem value="easy" id="difficulty-easy" />
                                    <Label htmlFor="difficulty-easy">Easy</Label>
                                </div>
                                <div className="flex items-center gap-3">
                                    <RadioGroupItem value="medium" id="difficulty-medium" />
                                    <Label htmlFor="difficulty-medium">Medium</Label>
                                </div>
                                <div className="flex items-center gap-3">
                                    <RadioGroupItem value="hard" id="difficulty-hard" />
                                    <Label htmlFor="difficulty-hard">Hard</Label>
                                </div>
                            </RadioGroup>

                            <div className="space-y-3">
                                <DialogHeader>
                                    <DialogTitle>Choose Your Piece</DialogTitle>
                                    <DialogDescription>
                                        Select the color of the pieces you want to play with.
                                    </DialogDescription>
                                </DialogHeader>
                                <RadioGroup value={pieceColor} onValueChange={(value) => setPieceColor(value as PieceColorChoice)} className="w-fit">
                                    <div className="flex items-center gap-3">
                                        <RadioGroupItem value="white" id="white" />
                                        <Label htmlFor="white" className="flex items-center gap-2">
                                            <img src="/k-white.svg" alt="White King" className="h-6 w-6" />
                                            White
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <RadioGroupItem value="black" id="black" />
                                        <Label htmlFor="black" className="flex items-center gap-2">
                                            <img src="/k-black.svg" alt="Black King" className="h-6 w-6" />
                                            Black
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <DialogFooter>
                                <DialogClose render={<Button variant="outline" type="button" />}>Back</DialogClose>
                                <Button type="submit">Start</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </main>
    )
}