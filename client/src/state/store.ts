import { create } from "zustand";
import { createInitialState } from "./initialState";
import { createAlchemySlice } from "./slices/alchemySlice";
import { createArtifactSlice } from "./slices/artifactSlice";
import { createChatSlice } from "./slices/chatSlice";
import { createChronicleSlice } from "./slices/chronicleSlice";
import { createCultivationSlice } from "./slices/cultivationSlice";
import { createLogSlice } from "./slices/logSlice";
import { createSceneSlice } from "./slices/sceneSlice";
import { createSessionSlice } from "./slices/sessionSlice";
import type { GameStore } from "./types";

export type { GameStore } from "./types";
export { MAX_INPUT, NPC_NAMES, initialNpcState } from "./constants";
export { getActiveMemories, getActiveMessages, getActiveNpcState } from "./selectors";
export { getNpcName } from "./utils";

export const useGameStore = create<GameStore>()((set, get, store) => ({
  ...createInitialState(),
  ...createSessionSlice(set, get, store),
  ...createChatSlice(set, get, store),
  ...createSceneSlice(set, get, store),
  ...createCultivationSlice(set, get, store),
  ...createAlchemySlice(set, get, store),
  ...createChronicleSlice(set, get, store),
  ...createArtifactSlice(set, get, store),
  ...createLogSlice(set, get, store)
}));

export function resetGameStoreForTests(): void {
  useGameStore.setState(createInitialState());
}
