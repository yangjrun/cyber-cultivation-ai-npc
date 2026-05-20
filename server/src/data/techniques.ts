import type { RootElement } from "../types/player.js";

export type Technique = {
  id: string;
  name: string;
  multiplier: number;
  rootWeights: Record<RootElement, number>;
};

export const techniques: Record<string, Technique> = {
  basic_breathing: {
    id: "basic_breathing",
    name: "九龙吐纳诀",
    multiplier: 1,
    rootWeights: {
      metal: 0.3,
      wood: 0.25,
      water: 0.15,
      fire: 0.15,
      earth: 0.15
    }
  }
};

export function getTechnique(id: string): Technique {
  return techniques[id] ?? techniques.basic_breathing;
}
