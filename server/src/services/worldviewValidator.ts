import type { ValidatedNpcResponse } from "../types/chat.js";

type Severity = "soft" | "hard";

type WorldviewRule = {
  pattern: string;
  severity: Severity;
  replacement: string | null;
};

const WORLDVIEW_RULES: ReadonlyArray<WorldviewRule> = [
  { pattern: "付款", severity: "soft", replacement: "付灵石" },
  { pattern: "转账", severity: "soft", replacement: "转灵石" },
  { pattern: "充值", severity: "soft", replacement: "添灵石" },
  { pattern: "账户", severity: "soft", replacement: "灵石袋" },
  { pattern: "银两", severity: "soft", replacement: "灵石" },
  { pattern: "铜板", severity: "soft", replacement: "灵石" },
  { pattern: "纸币", severity: "soft", replacement: "灵石" },
  { pattern: "金钱", severity: "soft", replacement: "灵石" },
  { pattern: "钱", severity: "soft", replacement: "灵石" },
  { pattern: "扫描", severity: "soft", replacement: "望气" },
  { pattern: "探测仪", severity: "soft", replacement: "望气盘" },
  { pattern: "波形", severity: "soft", replacement: "灵压波纹" },
  { pattern: "频谱", severity: "soft", replacement: "灵压波纹" },
  { pattern: "信号", severity: "soft", replacement: "灵压波纹" },
  { pattern: "芯片", severity: "soft", replacement: "灵根烙印" },
  { pattern: "义眼", severity: "soft", replacement: "望气瞳" },
  { pattern: "义体", severity: "soft", replacement: "傀儡身" },
  { pattern: "假体", severity: "soft", replacement: "傀儡身" },
  { pattern: "天道云", severity: "soft", replacement: "天道镜" },
  { pattern: "云端", severity: "soft", replacement: "天道镜" },
  { pattern: "全息", severity: "soft", replacement: "符光" },
  { pattern: "投影", severity: "soft", replacement: "符光" },
  { pattern: "赛博", severity: "hard", replacement: null },
  { pattern: "电流", severity: "hard", replacement: null },
  { pattern: "数据", severity: "hard", replacement: null },
  { pattern: "数据库", severity: "hard", replacement: null },
  { pattern: "网络", severity: "hard", replacement: null },
  { pattern: "服务器", severity: "hard", replacement: null },
  { pattern: "程序", severity: "hard", replacement: null },
  { pattern: "软件", severity: "hard", replacement: null },
  { pattern: "硬件", severity: "hard", replacement: null },
  { pattern: "编程", severity: "hard", replacement: null },
  { pattern: "代码", severity: "hard", replacement: null },
  { pattern: "算法", severity: "hard", replacement: null },
  { pattern: "WiFi", severity: "hard", replacement: null },
  { pattern: "蓝牙", severity: "hard", replacement: null }
];

export type WorldviewViolation = {
  term: string;
  severity: Severity;
};

export type WorldviewScanResult = {
  violations: WorldviewViolation[];
  sanitized: ValidatedNpcResponse;
  hasHardViolation: boolean;
};

export function validateWorldview(response: ValidatedNpcResponse): WorldviewScanResult {
  const violations: WorldviewViolation[] = [];
  const seen = new Set<string>();

  const recordViolation = (term: string, severity: Severity): void => {
    const key = `${term}:${severity}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    violations.push({ term, severity });
  };

  const sanitizeText = (text: string): string => {
    let current = text;

    for (const rule of WORLDVIEW_RULES) {
      if (!current.includes(rule.pattern)) {
        continue;
      }

      recordViolation(rule.pattern, rule.severity);

      if (rule.severity === "soft" && rule.replacement !== null) {
        current = current.split(rule.pattern).join(rule.replacement);
      }
    }

    return current;
  };

  const sanitizedDialogue = sanitizeText(response.dialogue);
  const sanitizedMemory = sanitizeText(response.memory);
  const sanitizedActions = response.actions
    ? response.actions.map((action) => sanitizeText(action))
    : response.actions;

  const hasHardViolation = violations.some((violation) => violation.severity === "hard");

  return {
    violations,
    sanitized: {
      ...response,
      dialogue: sanitizedDialogue,
      memory: sanitizedMemory,
      actions: sanitizedActions
    },
    hasHardViolation
  };
}
