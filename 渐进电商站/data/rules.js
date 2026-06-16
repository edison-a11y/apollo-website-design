/* ============================================================
   推荐决策规则（源：docs/02需求决议 第二节，2026-06-11外部核验通过）
   ★ 改推荐逻辑只改这个文件。改动必须先过 tests/rules.test.js
   ============================================================ */

/* 年龄段 → 预期ADD区间（IOT验光师指南标准表） */
const AGE_ADD = {
  "under40": [0,    0   ],
  "40-44":   [0.75, 1.00],
  "45-49":   [1.25, 1.50],
  "50-54":   [1.75, 2.00],
  "55-59":   [2.25, 2.50],
  "60plus":  [2.50, 2.75]
};

/* 度数区间 → 推荐折射率（国内通行标准；阿波罗渐进无1.56档，1.50为入门档） */
function recommendIndex(sphRange) {
  switch (sphRange) {
    case "0-300":   return { main: "1.50", alt: "1.60", note: "300度以内1.50足够，预算充足可选1.60更薄" };
    case "300-600": return { main: "1.60", alt: "1.67", note: "中度数选1.60，兼顾厚度与性价比" };
    case "600-800": return { main: "1.67", alt: "1.74", note: "600度以上建议1.67，明显更薄" };
    case "800plus": return { main: "1.74", alt: "1.67", note: "推荐1.74更薄美观；1.67也可定制（约覆盖至1000度）" };
    default:        return { main: "1.60", alt: "1.50", note: "度数未知，暂按常见中度数推荐，以验光为准" };
  }
}

/* ADD预估：年龄表为基础，近视力自测结果微调（仅做区间提示，绝不替代验光） */
function estimateADD(ageBand, nearVisionLevel) {
  const base = AGE_ADD[ageBand] || [0.75, 2.00];
  let [lo, hi] = base;
  if (nearVisionLevel === "bad" ) { lo = Math.min(lo + 0.25, 3.0); hi = Math.min(hi + 0.25, 3.5); }
  if (nearVisionLevel === "good" && lo > 0.75) { lo -= 0.25; hi -= 0.25; }
  return [lo, hi];
}

/* 核心推荐：返回 { primary, secondary, addon, reasons[], flags[] }
   answers = { ageBand, sphRange, scenes[], budget, experience, astigPositive, nearVisionLevel } */
function recommend(a, PRICES) {
  const reasons = [], flags = [];
  const [addLo, addHi] = estimateADD(a.ageBand, a.nearVisionLevel);
  const idx = recommendIndex(a.sphRange);

  /* —— 硬约束过滤（优先级最高） —— */
  let pool = ["zh-b", "wuyou", "zh-i", "zh-spro", "zh-u"]; // 智阅永不进主推池（室内专用）
  if (addHi > 2.00) { pool = pool.filter(p => p !== "wuyou");
    reasons.push("您的年龄段预期ADD可能超过+2.00，超出无忧渐进定制范围"); }
  if (addHi > 2.50) { pool = pool.filter(p => p !== "zh-b"); }
  if (addLo > 0 && addLo < 1.00) { pool = pool.filter(p => p !== "zh-b");
    flags.push("初期老花（ADD较低），智慧镜B下限+1.00不适用"); }
  if (a.sphRange === "800plus" && idx.main === "1.74") { pool = pool.filter(p => p !== "zh-b");
    reasons.push("800度以上建议1.74折射率，智慧镜B最高仅1.67"); }

  /* —— 主路径：经验 × 预算 —— */
  let primary;
  const exp = a.experience === "wearing" ? "upgrade" : "first";
  if (exp === "upgrade") {
    primary = a.budget === "5000plus" ? "zh-u" : a.budget === "3000-5000" ? "zh-spro" : "zh-i";
    reasons.push("您已有渐进佩戴经验，直接从进阶设计起步");
  } else {
    if      (a.budget === "under1500")  primary = "zh-b";
    else if (a.budget === "1500-3000")  primary = "wuyou";
    else if (a.budget === "3000-5000")  primary = pool.includes("wuyou") ? "wuyou" : "zh-spro"; // 优先退换保障(尊享版)
    else                                 primary = "zh-spro";
  }
  /* 硬约束兜底：主推被过滤则顺位上移 */
  if (!pool.includes(primary)) {
    const ladder = ["zh-i", "zh-spro", "zh-u"];
    primary = ladder.find(p => pool.includes(p)) || "zh-i";
  }
  /* 55+ 双主推规则 */
  if ((a.ageBand === "55-59" || a.ageBand === "60plus") && primary === "wuyou") primary = "zh-i";

  /* —— 散光提示 —— */
  if (a.astigPositive && primary !== "zh-i" && primary !== "zh-spro" && primary !== "zh-u") {
    flags.push("散光自测呈阳性：智慧镜I/S PRO配备散光像差优化，更适合散光人群，验光时请务必复查散光");
    if (pool.includes("zh-i")) primary = (a.budget === "under1500") ? primary : "zh-i";
  }

  /* —— 次推荐：池内相邻档位 —— */
  const order = ["zh-b", "wuyou", "zh-i", "zh-spro", "zh-u"];
  const secondary = pool.filter(p => p !== primary)
    .sort((x, y) => Math.abs(order.indexOf(x) - order.indexOf(primary)) - Math.abs(order.indexOf(y) - order.indexOf(primary)))[0] || null;

  /* —— 场景附加推荐：智阅只能当第二副 —— */
  let addon = null;
  if ((a.scenes || []).includes("computer")) {
    addon = "zhiyue";
    flags.push("您电脑办公时间长：智阅办公渐进作为「办公第二副」可大幅提升中近距离舒适度（室内专用，不可驾驶佩戴）");
  }

  /* —— 50-54边界提示 —— */
  if (a.ageBand === "50-54" && primary === "wuyou")
    flags.push("您的预期ADD接近无忧渐进上限+2.00：若门店实测ADD超过+2.00，请改配智慧镜I");

  /* 智阅产品永不作为primary/secondary（防御性断言） */
  if (primary === "zhiyue") primary = "zh-i";

  return { primary, secondary, addon, index: idx, addRange: [addLo, addHi], reasons, flags,
    disclaimer: "本测试为筛查参考。渐进定制需含单眼瞳距、瞳高、ADD的完整验光单，下单前请到正规视光门店或眼科完成验光。" };
}

if (typeof module !== "undefined") module.exports = { AGE_ADD, recommendIndex, estimateADD, recommend };
