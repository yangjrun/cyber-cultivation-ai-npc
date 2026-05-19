export type NpcState = {
  trust: number;
  fear: number;
  anger: number;
  tianDaoAlert: number;
};

export type NpcIntent = {
  type: "none" | "offer_trade" | "give_quest" | "report_player" | "refuse_service";
  params: Record<string, unknown>;
};

export type ChatResponse = {
  dialogue: string;
  tone: string;
  intent: NpcIntent;
  state: NpcState;
  memoryAdded: string;
  actionResult: string;
};

export async function sendChat(playerInput: string, npcId = "baili", sessionId?: string): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      playerInput,
      npcId,
      ...(sessionId ? { sessionId } : {})
    })
  });

  if (!res.ok) {
    throw new Error("chat request failed");
  }

  return res.json() as Promise<ChatResponse>;
}

export async function resetChat(npcId = "baili", sessionId?: string): Promise<void> {
  const res = await fetch("/api/chat/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      npcId,
      ...(sessionId ? { sessionId } : {})
    })
  });

  if (!res.ok) {
    throw new Error("reset request failed");
  }
}
