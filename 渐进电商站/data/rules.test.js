/* 推荐规则自动化测试 —— 交付门槛：node rules.test.js 必须全过
   每条硬约束≥3用例（命中/边界/不命中） */
const { recommend, recommendIndex, estimateADD } = require("./rules.js");
const { PRICES } = require("./prices.js");
let pass = 0, fail = 0;
const T = (name, cond) => { cond ? pass++ : (fail++, console.error("✗ FAIL:", name)); };
const base = { ageBand:"45-49", sphRange:"300-600", scenes:[], budget:"1500-3000", experience:"first", astigPositive:false, nearVisionLevel:"mid" };
const R = o => recommend({ ...base, ...o }, PRICES);

/* ── 硬约束1：ADD>2.00 绝不出无忧渐进 ── */
T("55-59岁不推无忧", R({ ageBand:"55-59" }).primary !== "wuyou");
T("60+不推无忧", R({ ageBand:"60plus", budget:"3000-5000" }).primary !== "wuyou");
T("55+任何预算次推荐也无无忧", ["under1500","1500-3000","3000-5000","5000plus"].every(b => { const r = R({ ageBand:"60plus", budget:b }); return r.primary !== "wuyou" && r.secondary !== "wuyou"; }));
T("45-49岁正常推无忧（不命中）", R({}).primary === "wuyou");

/* ── 硬约束2：ADD上下限对智慧镜B ── */
T("60+不推智慧镜B（ADD>2.50）", R({ ageBand:"60plus", budget:"under1500" }).primary !== "zh-b");
T("40-44不推智慧镜B（ADD<1.00）", R({ ageBand:"40-44", budget:"under1500" }).primary !== "zh-b");
T("45-49预算1500内推B（不命中）", R({ budget:"under1500" }).primary === "zh-b");

/* ── 硬约束3：800度+不推智慧镜B ── */
T("800+不推B", R({ sphRange:"800plus", budget:"under1500" }).primary !== "zh-b");
T("800+折射率推1.74", R({ sphRange:"800plus" }).index.main === "1.74");
T("300内推B正常（不命中）", R({ sphRange:"0-300", budget:"under1500" }).primary === "zh-b");

/* ── 硬约束4：智阅永不单推 ── */
T("电脑场景智阅只在addon", (() => { const r = R({ scenes:["computer"] }); return r.addon === "zhiyue" && r.primary !== "zhiyue" && r.secondary !== "zhiyue"; })());
T("任意组合primary≠智阅", ["under40","40-44","45-49","50-54","55-59","60plus"].every(a => ["under1500","1500-3000","3000-5000","5000plus"].every(b => R({ ageBand:a, budget:b, scenes:["computer"] }).primary !== "zhiyue")));
T("无电脑场景无addon", R({}).addon === null);

/* ── 双主推：55+ → 智慧镜I ── */
T("55-59默认主推智慧镜I", R({ ageBand:"55-59" }).primary === "zh-i");
T("40-54主推无忧", R({ ageBand:"50-54" }).primary === "wuyou");
T("50-54有边界提示", R({ ageBand:"50-54" }).flags.some(f => f.includes("+2.00")));

/* ── 散光 ── */
T("散光阳性提示验光复查", R({ astigPositive:true }).flags.some(f => f.includes("散光")));
T("散光阳性升档至I", R({ astigPositive:true }).primary === "zh-i");
T("散光+低预算不强制升档", R({ astigPositive:true, budget:"under1500" }).primary !== "zh-u");

/* ── 折射率表 ── */
T("0-300→1.50", recommendIndex("0-300").main === "1.50");
T("300-600→1.60", recommendIndex("300-600").main === "1.60");
T("600-800→1.67", recommendIndex("600-800").main === "1.67");
T("未知度数有提示", recommendIndex("unknown").note.includes("验光"));

/* ── 换片老手 ── */
T("已戴渐进从I起步", R({ experience:"wearing" }).primary === "zh-i");
T("已戴+高预算→U", R({ experience:"wearing", budget:"5000plus" }).primary === "zh-u");

/* ── ADD估算 ── */
T("45-49基础区间1.25-1.50", JSON.stringify(estimateADD("45-49","mid")) === "[1.25,1.5]");
T("近视力差上调0.25", estimateADD("45-49","bad")[1] === 1.75);

/* ── 价格数据完整性抽查（对照价目册原图） ── */
T("B/1.50钻朗=1280", PRICES["zh-b"].coatings["钻朗膜"]["1.50"] === 1280);
T("无忧优享/1.50钻朗=1880", PRICES["wuyou"].versions["优享版"]["钻朗膜"]["1.50"] === 1880);
T("无忧尊享/1.74星蓝=5080", PRICES["wuyou"].versions["尊享版"]["星蓝·钻朗膜"]["1.74"] === 5080);
T("I/1.74清朗=5980", PRICES["zh-i"].coatings["清朗膜"]["1.74"] === 5980);
T("SPRO/1.50蜂朗=2680", PRICES["zh-spro"].coatings["蜂朗膜"]["1.50"] === 2680);
T("U/1.74清朗=11000", PRICES["zh-u"].coatings["清朗膜"]["1.74"] === 11000);
T("智阅/1.60钻朗=2180", PRICES["zhiyue"].coatings["钻朗膜"]["1.60"] === 2180);
T("智阅无1.50档", !("1.50" in PRICES["zhiyue"].coatings["钻朗膜"]));
T("B无1.74档", PRICES["zh-b"].maxIndex === 1.67);
T("无忧ADD上限2.00", PRICES["wuyou"].addMax === 2.00);

console.log(`\n结果: ${pass} 通过, ${fail} 失败 ${fail === 0 ? "✅ 全部通过" : "❌ 存在失败，禁止交付"}`);
process.exit(fail === 0 ? 0 : 1);
