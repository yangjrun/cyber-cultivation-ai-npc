type ForbiddenKeyword = {
  pattern: string;
  tianDaoAlertDelta: number;
};

const FORBIDDEN_KEYWORDS: ReadonlyArray<ForbiddenKeyword> = [
  { pattern: "非法", tianDaoAlertDelta: 3 },
  { pattern: "芯片", tianDaoAlertDelta: 3 },
  { pattern: "义体", tianDaoAlertDelta: 3 },
  { pattern: "义眼", tianDaoAlertDelta: 3 },
  { pattern: "扫描", tianDaoAlertDelta: 3 },
  { pattern: "全息", tianDaoAlertDelta: 3 },
  { pattern: "赛博", tianDaoAlertDelta: 4 },
  { pattern: "天道云", tianDaoAlertDelta: 3 },
  { pattern: "灵根波形", tianDaoAlertDelta: 3 },
  { pattern: "监察", tianDaoAlertDelta: 2 },
  { pattern: "卧底", tianDaoAlertDelta: 3 },
  { pattern: "鹤七", tianDaoAlertDelta: 4 },
  { pattern: "走私", tianDaoAlertDelta: 4 },
  { pattern: "违规", tianDaoAlertDelta: 2 },
  { pattern: "雷罚", tianDaoAlertDelta: 2 },
  { pattern: "杀", tianDaoAlertDelta: 4 },
  { pattern: "盗", tianDaoAlertDelta: 3 },
  { pattern: "劫", tianDaoAlertDelta: 4 },
  { pattern: "抢", tianDaoAlertDelta: 3 }
];

const MAX_TOTAL_DELTA = 10;

export type ForbiddenScanResult = {
  hits: string[];
  tianDaoAlertDelta: number;
};

export function scanForbiddenKeywords(input: string): ForbiddenScanResult {
  const hits: string[] = [];
  let delta = 0;

  for (const { pattern, tianDaoAlertDelta } of FORBIDDEN_KEYWORDS) {
    if (input.includes(pattern) && !hits.includes(pattern)) {
      hits.push(pattern);
      delta += tianDaoAlertDelta;
    }
  }

  return {
    hits,
    tianDaoAlertDelta: Math.min(delta, MAX_TOTAL_DELTA)
  };
}
