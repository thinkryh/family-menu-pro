#!/usr/bin/env node
/**
 * build.js — 校验 data/*.json 并注入 app/template.html 生成 app/index.html
 * 用法:
 *   node scripts/build.js            校验 + 构建
 *   node scripts/build.js --validate 仅校验(菜谱量产时每批跑)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

let errors = [];
const err = (m) => errors.push(m);

// ---------- 载入 ----------
let config, babyRules, ingredients, recipes;
try {
  config = read('data/config.json');
  babyRules = read('data/baby_rules.json');
  ingredients = read('data/ingredients.json');
  recipes = read('data/recipes.json');
} catch (e) {
  console.error('JSON 解析失败:', e.message);
  process.exit(1);
}

// ---------- 校验 ----------
const ingNames = new Set(ingredients.items.map((i) => i.name));
const ids = new Set();
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

for (const r of recipes.items) {
  const tag = `[${r.id || '无id'}]`;
  if (!r.id || ids.has(r.id)) err(`${tag} id 缺失或重复`);
  ids.add(r.id);

  for (const m of r.main_ingredients || []) {
    if (!ingNames.has(m.name)) err(`${tag} 主料「${m.name}」不在食材库,先补 ingredients.json`);
    if (!(m.qty_g > 0)) err(`${tag} 主料「${m.name}」缺 qty_g`);
  }

  // 时令交集:菜的在季月份必须是所有主料在季月份的子集,主料一过季菜就得跟着下架
  const rMonths = r.season_months === 'all' ? ALL_MONTHS : r.season_months;
  if (!Array.isArray(rMonths)) {
    err(`${tag} season_months 必须是 [1-12] 数组或 "all"`);
  } else {
    for (const m of r.main_ingredients || []) {
      const ing = ingredients.items.find((i) => i.name === m.name);
      if (!ing) continue;
      const iMonths = ing.season_months === 'all' ? ALL_MONTHS : ing.season_months;
      const over = rMonths.filter((x) => !iMonths.includes(x));
      if (over.length) err(`${tag} 时令超出主料「${m.name}」(${iMonths.join('/')}月):多出 ${over.join('/')} 月`);
    }
  }

  const bv = r.baby_variant;
  if (!bv) { err(`${tag} 缺 baby_variant`); continue; }
  if (bv.suitable === true) {
    if (!bv.split_point || bv.split_point.length < 6) err(`${tag} suitable=true 但 split_point 未写明具体操作`);
    // 宝宝份主料不得含 baby_ok=false 且无排除说明的食材
    for (const m of r.main_ingredients || []) {
      const ing = ingredients.items.find((i) => i.name === m.name);
      if (ing && ing.baby_ok === false && !(bv.split_point + bv.modification).includes(m.name)) {
        err(`${tag} 主料「${m.name}」baby_ok=false,但 split_point/modification 未说明宝宝份如何排除它`);
      }
    }
  } else if (bv.suitable === false) {
    if (!bv.unsuitable_reason) err(`${tag} suitable=false 必须写 unsuitable_reason`);
  } else {
    err(`${tag} baby_variant.suitable 必须为布尔值`);
  }

  if ((r.spicy || 0) >= 1 && bv.suitable === true && !/前盛出|先盛/.test(bv.split_point || '')) {
    err(`${tag} spicy≥1 的适配菜,split_point 必须写明「下辣/盐之前盛出」的时机`);
  }
  if (r.cook_time_min > config.constraints.meal_time_budget_min && !r.prep_ahead) {
    err(`${tag} 耗时 ${r.cook_time_min}min 超单餐预算且未标 prep_ahead`);
  }
}

// 忌口清单必须对得上库里的东西。这两个列表是「写了就该生效」的配置,
// 一个错字(家里说「牛肉炖南瓜」,库里叫「牛肉末炖南瓜」)会让它安静地什么都不做——
// taste.exclude 以前没有任何代码读它,就是这么白写了很久的。
const taste = config.family.taste || {};
const recNames = new Set(recipes.items.map((r) => r.name));
// 完全对不上的只是提醒:忌口可以先于菜谱存在(臭鳜鱼就从来没入过库,是「别加进来」的备忘)。
// 对上一半的才是错字,报错——「牛肉炖南瓜」能找到「牛肉末炖南瓜」,那就是想排它却没排掉。
// 「像」的判断不能只用 includes:家里说的「牛肉炖南瓜」和库里的「牛肉末炖南瓜」差一个字,
// 互相都不是对方的子串。按子序列比(短的字按顺序出现在长的里),再要求重合度够高。
const alike = (a, b) => {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length < 2 || s.length / l.length < 0.6) return false;
  let i = 0;
  for (const ch of l) if (ch === s[i]) i++;
  return i === s.length;
};
const notes = [];
const checkList = (list, label, has, nearOf) => {
  for (const name of list || []) {
    if (has(name)) continue;
    const near = nearOf(name);
    if (near.length) err(`${label} 里的「${name}」对不上库里的名字,写了不生效;是不是想写「${near.join('」「')}」?`);
    else notes.push(`${label} 的「${name}」库里没有,当作「别加进来」的备忘留着`);
  }
};
checkList(taste.exclude, 'taste.exclude',
  (n) => recNames.has(n) || ids.has(n),
  (n) => recipes.items.filter((r) => alike(n, r.name)).map((r) => r.name));
checkList(taste.exclude_ingredients, 'taste.exclude_ingredients',
  (n) => ingNames.has(n),
  (n) => [...ingNames].filter((i) => alike(n, i)));

if (errors.length) {
  console.error(`校验失败,${errors.length} 处:\n` + errors.map((e) => '  ✗ ' + e).join('\n'));
  process.exit(1);
}
notes.forEach((n) => console.log('  · ' + n));
const offIng = new Set(taste.exclude_ingredients || []);
const offDish = new Set(taste.exclude || []);
const off = recipes.items.filter((r) => offDish.has(r.name) || offDish.has(r.id) ||
  r.main_ingredients.some((m) => offIng.has(m.name)));
console.log(`✓ 校验通过:菜谱 ${recipes.items.length} 道,食材 ${ingredients.items.length} 项` +
  (off.length ? `;忌口下架 ${off.length} 道,剩 ${recipes.items.length - off.length} 道可排` : ''));

if (process.argv.includes('--validate')) process.exit(0);

// ---------- 构建 ----------
const template = fs.readFileSync(path.join(ROOT, 'app/template.html'), 'utf8');
const DATA = { config, babyRules, ingredients, recipes, builtAt: new Date().toISOString().slice(0, 10) };
const marker = '/*__DATA__*/null';
if (!template.includes(marker)) {
  console.error(`构建失败:template.html 中找不到占位符 ${marker}`);
  process.exit(1);
}
// GitHub Pages 只能从仓库根目录或 /docs 发布,不支持 /app,故产物落在 docs/
const html = template.replace(marker, JSON.stringify(DATA));
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/index.html'), html);
fs.writeFileSync(path.join(ROOT, 'docs/.nojekyll'), '');
console.log(`✓ 构建完成:docs/index.html(${(html.length / 1024).toFixed(0)} KB)`);
