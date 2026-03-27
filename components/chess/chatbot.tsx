"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Bot, Eraser, Loader2, Send, Sparkles } from "lucide-react"

import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const COOLDOWN_SECONDS = 5

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

function renderMessageContent(content: string) {
  const parts: Array<{ text: string; isBold: boolean }> = []
  const boldPattern = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = boldPattern.exec(content)) !== null) {
    const [fullMatch, boldText] = match
    const startIndex = match.index

    if (startIndex > lastIndex) {
      parts.push({ text: content.slice(lastIndex, startIndex), isBold: false })
    }

    parts.push({ text: boldText, isBold: true })
    lastIndex = startIndex + fullMatch.length
  }

  if (lastIndex < content.length) {
    parts.push({ text: content.slice(lastIndex), isBold: false })
  }

  if (parts.length === 0) {
    return content
  }

  return parts.map((part, index) =>
    part.isBold ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>
  )
}

const STARTER_QUESTIONS = [
  "What's a good opening repertoire for club players?",
  "How should I handle isolated queen's pawn positions?",
  "Explain the basics of pawn structure in the Caro-Kann.",
  "Suggest 3 practical endgame tips for rook endgames.",
]

export function ChatBot({ boardContext, className }: { boardContext: string; className?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Ask me anything about chess: openings, middlegame strategy, tactics, endgames, puzzles, and position evaluation.",
    },
  ])
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isLoading])

  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const timeout = window.setTimeout(() => setCooldownRemaining((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearTimeout(timeout)
  }, [cooldownRemaining])

  const isCooldownActive = cooldownRemaining > 0
  const canSubmit = useMemo(() => prompt.trim().length > 0 && !isLoading && !isCooldownActive, [prompt, isLoading, isCooldownActive])

  async function submitMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading || isCooldownActive) return

    const nextUserMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed }
    const nextMessages = [...messages, nextUserMessage]
    setMessages(nextMessages)
    setPrompt("")
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          boardContext,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Could not get a response from the chess assistant.")
      }

      const assistantReply: string = (data.response || "") as string

      const nextAssistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: assistantReply }
      setMessages([...nextMessages, nextAssistantMessage])
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.")
    } finally {
      setIsLoading(false)
      setCooldownRemaining(COOLDOWN_SECONDS)
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await submitMessage(prompt)
  }

  function resetConversation() {
    setMessages([
      { id: crypto.randomUUID(), role: "assistant", content: "Conversation cleared. Ask a chess question whenever you are ready." },
    ])
    setError(null)
    setPrompt("")
  }

  const showStarterQuestions = messages.length === 1 && messages[0].role === "assistant"

  return (
    <div>
      {/* TODO: Chat bot UI */}
    </div>
  )
}