import { getNpcProfile } from "../gameState.js";
import { getWorldviewPreamble } from "./worldview.js";
import type { ActionVerb, ActionWitness } from "../actionResolver.js";
import type { PlayerState } from "../../types/player.js";
import type { SceneSnapshot } from "../../types/scene.js";

export type ActionNarrationPromptInput = {
  playerInput: string;
  actionVerb: ActionVerb;
  targetNpcId: string | null;
  scene?: SceneSnapshot;
  witnesses: ActionWitness[];
  player: PlayerState;
};

export function buildActionNarrationSystemPrompt(): string {
  return `你是九龙下城修仙世界的旁白叙述者。玩家执行了一个动作，你需要生成生动的叙述。

${getWorldviewPreamble()}

# 叙述原则
1. 2-4句话，总长度100-400字（不超过500字）
2. 描述动作过程和结果
3. 包含NPC的即时反应（表情、动作、情绪变化）
4. 营造沉浸感，但不要过度夸张
5. 保持修仙世界的氛围和术语（灵压、义体、天道镜等）
6. 不要编造不存在的物品、地点、NPC
7. 根据NPC的性格和状态描述反应

# 动作类型指南
- 潜行：强调隐蔽、紧张感、是否被发现、周围人的警觉
- 出手：描述攻击动作、力度、对方反应、战斗氛围
- 搜查：描述搜索过程、发现的细节、环境描写
- 撤离：描述逃跑动作、追赶情况、紧迫感
- 动作：根据具体内容灵活描述

# NPC反应指南
- 如果有目标NPC，重点描述目标的反应
- 如果动作隐蔽（潜行），描述是否被察觉
- 如果动作公开（出手、搜查），描述在场所有人的反应
- 根据NPC的愤怒、恐惧值变化，描述相应的情绪反应
- 愤怒增加：怒视、握拳、冷笑、威胁
- 恐惧增加：后退、警惕、紧张、戒备

# 输出格式
只输出纯文本叙述，不要JSON，不要标记，不要前后缀，不要引号。
直接输出叙述内容。`;
}

export function buildActionNarrationUserPrompt(input: ActionNarrationPromptInput): string {
  const { playerInput, actionVerb, targetNpcId, scene, witnesses, player } = input;

  let prompt = `# 场景\n`;
  if (scene) {
    prompt += `${scene.scene.name} - ${scene.scene.description}\n\n`;
    prompt += `# 在场NPC\n`;
    for (const { profile, state } of scene.npcs) {
      prompt += `- ${profile.name}（${profile.role}）状态：信任${state.trust} 恐惧${state.fear} 愤怒${state.anger}\n`;
    }
  } else {
    prompt += `无特定场景（玩家独自行动）\n`;
  }

  prompt += `\n# 玩家信息\n`;
  prompt += `${player.name}（${player.realm}）\n`;

  prompt += `\n# 动作\n`;
  prompt += `类型：${actionVerb}\n`;
  prompt += `玩家输入：${playerInput}\n`;

  if (targetNpcId) {
    const targetProfile = getNpcProfile(targetNpcId);
    prompt += `目标：${targetProfile.name}\n`;
  } else {
    prompt += `目标：无特定目标\n`;
  }

  if (witnesses.length > 0) {
    prompt += `\n# NPC反应（已计算的状态变化）\n`;
    for (const witness of witnesses) {
      const profile = getNpcProfile(witness.npcId);
      const reactions: string[] = [];

      if (witness.angerDelta > 0) {
        reactions.push(`愤怒+${witness.angerDelta}`);
      }
      if (witness.fearDelta > 0) {
        reactions.push(`恐惧+${witness.fearDelta}`);
      }
      if (witness.tianDaoAlertDelta > 0) {
        reactions.push(`警觉+${witness.tianDaoAlertDelta}`);
      }

      if (reactions.length > 0) {
        prompt += `- ${profile.name}: ${reactions.join(" ")}\n`;
      } else {
        prompt += `- ${profile.name}: 目睹了这一幕\n`;
      }
    }
  }

  prompt += `\n请生成这个动作的生动叙述。`;

  return prompt;
}
