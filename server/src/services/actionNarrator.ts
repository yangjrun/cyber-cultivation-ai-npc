import { requestLlmText } from "./llmClient.js";
import { validateActionNarration } from "./actionNarrationValidator.js";
import { buildActionNarrationSystemPrompt, buildActionNarrationUserPrompt } from "./promptParts/actionNarration.js";
import type { ActionVerb, ActionWitness } from "./actionResolver.js";
import type { PlayerState } from "../types/player.js";
import type { SceneSnapshot } from "../types/scene.js";

export type ActionNarrationInput = {
  sessionId: string;
  playerInput: string;
  actionVerb: ActionVerb;
  targetNpcId: string | null;
  scene?: SceneSnapshot;
  witnesses: ActionWitness[];
  player: PlayerState;
};

export type ActionNarrationResult = {
  narration: string;
  fallbackUsed: boolean;
};

/**
 * Generates vivid action narration using LLM.
 * Falls back to simple format if LLM is unavailable or returns invalid output.
 */
export async function generateActionNarration(input: ActionNarrationInput): Promise<ActionNarrationResult> {
  const { playerInput, actionVerb } = input;
  const fallbackNarration = buildFallbackNarration(actionVerb, playerInput);

  try {
    const systemPrompt = buildActionNarrationSystemPrompt();
    const userPrompt = buildActionNarrationUserPrompt(input);

    const rawResponse = await requestLlmText({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      callSite: "action-narrator",
      mockFallback: () => fallbackNarration
    });

    const validation = validateActionNarration(rawResponse, fallbackNarration);

    return {
      narration: validation.narration,
      fallbackUsed: validation.fallbackUsed
    };
  } catch (error) {
    // Log error for observability, then fall back to simple narration
    console.error("[actionNarrator] LLM narration failed, using fallback:", error instanceof Error ? error.message : String(error));

    return {
      narration: fallbackNarration,
      fallbackUsed: true
    };
  }
}

function buildFallbackNarration(verb: ActionVerb, input: string): string {
  const templates: Record<ActionVerb, (input: string) => string> = {
    潜行: (inp) => `${inp}——悄无声息。`,
    出手: (inp) => `${inp}——迅如闪电。`,
    搜查: (inp) => `${inp}——仔细搜寻。`,
    撤离: (inp) => `${inp}——迅速离开。`,
    动作: (inp) => inp
  };
  return templates[verb]?.(input) ?? input;
}
