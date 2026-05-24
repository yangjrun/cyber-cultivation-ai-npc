import type { StateCreator } from "zustand";
import { MAX_LOGS } from "../constants";
import type { GameActions, GameStore } from "../types";
import { nowTime, uid } from "../utils";

type LogActions = Pick<GameActions, "appendLog">;

export const createLogSlice: StateCreator<GameStore, [], [], LogActions> = (set) => ({
  appendLog: (text: string) => {
    set((state) => {
      const next = [...state.systemLogs, { id: uid(), time: nowTime(), text }];
      return { systemLogs: next.slice(-MAX_LOGS) };
    });
  }
});
