import type { ArbiterDecision } from "../../types/chat.js";
import type { SceneSnapshot } from "../../types/scene.js";

const SILENCE_TRIGGERS = ["滚", "别理", "不要回应", "离我远点", "闭嘴"];
const GROUP_TRIGGERS = ["让我过", "打听", "盘问", "你们", "是不是"];
const ACTION_ONLY_PATTERN = /^[（(].+[)）]$/;

export type MockArbiterInput = {
  targetNpcId: string;
  playerInput: string;
  scene?: SceneSnapshot;
};

export function mockArbiter({ targetNpcId, playerInput, scene }: MockArbiterInput): ArbiterDecision {
  const trimmed = playerInput.trim();

  if (SILENCE_TRIGGERS.some((trigger) => trimmed.includes(trigger))) {
    return {
      speakers: [],
      rationale: "玩家在驱赶，全员沉默。"
    };
  }

  if (ACTION_ONLY_PATTERN.test(trimmed)) {
    return {
      speakers: [{ npcId: targetNpcId, mode: "action_only" }],
      rationale: "玩家只做了个动作，目标 NPC 也只回一个动作。"
    };
  }

  const sceneNpcIds = scene?.scene.npcIds ?? [];
  const targetInScene = sceneNpcIds.includes(targetNpcId);
  const otherSceneNpcs = sceneNpcIds.filter((id) => id !== targetNpcId);

  if (targetInScene && otherSceneNpcs.length > 0 && GROUP_TRIGGERS.some((trigger) => trimmed.includes(trigger))) {
    return {
      speakers: [
        { npcId: targetNpcId, mode: "speak" },
        { npcId: otherSceneNpcs[0], mode: "interrupt" }
      ],
      rationale: "玩家挑动群体，另一个 NPC 顺势接话。"
    };
  }

  return {
    speakers: [{ npcId: targetNpcId, mode: "speak" }],
    rationale: "默认目标 NPC 单人回应。"
  };
}
