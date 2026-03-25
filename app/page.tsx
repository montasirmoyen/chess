"use client"

import { useRouter } from 'next/navigation';

import { ThemeToggle } from "@/components/ui/theme-toggle"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

export default function Page() {
    const router = useRouter();

    const handlePlay = () => {
        router.push('/play');
    }

    return (
        <main className="chess-page-bg relative flex min-h-svh items-center justify-center px-4 py-8">
            <div className="absolute right-4 top-4">
                <ThemeToggle />
            </div>
            <div className="flex flex-col items-center gap-4 px-6 py-8">
                <h1 className="text-4xl font-bold">Endgame</h1>

                <Dialog>
                    <form>
                        <DialogTrigger>
                            <Button size="lg">Play Now</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm">
                            <DialogHeader>
                                <DialogTitle>Choose AI Difficulty</DialogTitle>
                                <DialogDescription>
                                    Select the difficulty level for the AI opponent.
                                </DialogDescription>
                            </DialogHeader>
                            <RadioGroup defaultValue="comfortable" className="w-fit">
                                <div className="flex items-center gap-3">
                                    <RadioGroupItem value="default" id="r1" />
                                    <Label htmlFor="r1">Easy</Label>
                                </div>
                                <div className="flex items-center gap-3">
                                    <RadioGroupItem value="comfortable" id="r2" />
                                    <Label htmlFor="r2">Medium</Label>
                                </div>
                                <div className="flex items-center gap-3">
                                    <RadioGroupItem value="compact" id="r3" />
                                    <Label htmlFor="r3">Hard</Label>
                                </div>
                            </RadioGroup>
                            <DialogFooter>
                                <DialogClose>
                                    <Button variant="outline">Back</Button>
                                </DialogClose>
                                <Button type="submit" onClick={handlePlay}>Start</Button>
                            </DialogFooter>
                        </DialogContent>
                    </form>
                </Dialog>
            </div>
        </main>
    )
}