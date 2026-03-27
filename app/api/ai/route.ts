const API_KEY = process.env.OPENROUTER_API_KEY;
const AI_MODEL = process.env.OPENROUTER_AI_MODEL || 'qwen/qwen3-4b:free';

import { NextResponse, type NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: API_KEY,
    defaultHeaders: {
        'X-Title': 'ScentDex',
    },
});

const SYSTEM_PROMPT = `
You are Chess expert and grandmaster.

Your scope is strictly limited to chess-related topics, including:
- opening theory
- middle game strategies
- endgame techniques
- tactics and combinations
- famous games and players
- chess puzzles and exercises

If the user asks about anything outside chess, politely refuse in one short sentence and redirect them to ask a chess-related question.
Be concise, practical, and clear. Never claim personal real-world experience.
If information is uncertain, say so.

When answering questions, take into account the current board position that will be provided with each question.
`;

type IncomingMessage = {
    role: 'user' | 'assistant';
    content: string;
};

function isIncomingMessage(value: unknown): value is IncomingMessage {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const maybeMessage = value as Record<string, unknown>;
    return (
        (maybeMessage.role === 'user' || maybeMessage.role === 'assistant') &&
        typeof maybeMessage.content === 'string'
    );
}

function toResponseMessageContent(content: unknown): string {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === 'object' && part !== null && 'text' in part) {
                    const partText = (part as { text?: unknown }).text;
                    return typeof partText === 'string' ? partText : '';
                }

                return '';
            })
            .join('')
            .trim();
    }

    return '';
}

export async function POST(request: NextRequest) {
    try {
        if (!API_KEY) {
            console.error('API key not configured');
            return NextResponse.json(
                { error: 'API key not configured' },
                { status: 500 }
            );
        }

        const body: { messages?: unknown; prompt?: unknown; boardContext?: unknown } = await request.json();
        const rawMessages: unknown[] = Array.isArray(body.messages) ? body.messages : [];
        const prePrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        const boardContext = typeof body.boardContext === 'string' ? body.boardContext.trim() : '';
        const prompt = prePrompt + " - If the question is not chess-related, please politely redirect the user to ask a chess-related question. No matter what the user asks, the response must be chess-related.";

        const history: IncomingMessage[] = rawMessages
            .filter((message: unknown): message is IncomingMessage => isIncomingMessage(message))
            .map((message: IncomingMessage) => ({
                role: message.role,
                content: message.content.trim(),
            }))
            .filter((message: IncomingMessage) => message.content.length > 0)
            .slice(-12);

        const hasUserMessageInHistory = history.some(
            (message: IncomingMessage) => message.role === 'user'
        );

        if (!hasUserMessageInHistory && prompt.length === 0) {
            return NextResponse.json(
                { error: 'Please provide a chess-related question.' },
                { status: 400 }
            );
        }

        if (!hasUserMessageInHistory && prompt.length > 0) {
            const fullPrompt = boardContext 
                ? `${boardContext}\n\nQuestion: ${prompt}`
                : prompt;
            history.push({ role: 'user', content: fullPrompt });
        } else if (hasUserMessageInHistory && boardContext && history.length > 0) {
            const lastUserIndex = history.map((m, i) => ({ ...m, i })).reverse().find(m => m.role === 'user')?.i;
            if (lastUserIndex !== undefined && !history[lastUserIndex].content.includes('Current board position:')) {
                history[lastUserIndex].content = `${boardContext}\n\n${history[lastUserIndex].content}`;
            }
        }

        const completion = await openai.chat.completions.create({
            model: AI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT,
                },
                ...history,
            ],
            temperature: 0.6,
        });

        const response = toResponseMessageContent(completion.choices[0]?.message?.content);

        if (!response) {
            return NextResponse.json(
                { error: 'The AI did not return a valid response. Please try again.' },
                {
                    status: 502,
                }
            );
        }

        return NextResponse.json({ success: true, response });
    } catch (error: unknown) {
        if (error instanceof OpenAI.APIError && error.status === 401) {
            return NextResponse.json(
                { error: 'Invalid API key. Please check your API key.' },
                { status: 401 }
            );
        }

        const message =
            error instanceof Error
                ? error.message
                : 'Unknown error while contacting the AI provider.';

        return NextResponse.json(
            { error: 'Failed to receive a response from the AI. Please try again. ' + message },
            { status: 500 }
        );
    }
}