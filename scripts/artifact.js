#!/usr/bin/env node
/**
 * artifact.js — 把 docs/index.html 转成 Claude artifact 私有预览页
 *
 *   node scripts/build.js && node scripts/artifact.js
 *   → 生成 .artifact/preview.html,再让 Claude 用固定 URL 发布
 *
 * 为什么要转:artifact 容器会把页面包进自己的 <!doctype>/<head>/<body>,
 * 所以产物里不能再有这些标签;而且容器 iframe 高度随内容自适应,
 * 固定在视口底部的导航会掉到整页最底部,预览版改成顶部吸附。
 * 仓库版(docs/index.html)保持底部导航不变——手机上拇指够得着。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'docs/index.html');
const OUT_DIR = path.join(ROOT, '.artifact');
const OUT = path.join(OUT_DIR, 'preview.html');

if (!fs.existsSync(SRC)) {
  console.error('找不到 docs/index.html,先跑 node scripts/build.js');
  process.exit(1);
}
const src = fs.readFileSync(SRC, 'utf8');

const pick = (re, name) => {
  const m = src.match(re);
  if (!m) { console.error(`构建产物里找不到 ${name},artifact.js 需要跟着 template.html 一起改`); process.exit(1); }
  return m;
};
const title = pick(/<title>([\s\S]*?)<\/title>/, '<title>')[1];
let style = pick(/<style>[\s\S]*?<\/style>/, '<style>')[0];
let body = pick(/<body>([\s\S]*)<\/body>/, '<body>')[1].trim();

// 底部固定导航 → 顶部吸附
const NAV_FIXED = `position: fixed; bottom: 0; left: 0; right: 0; z-index: 5;
    display: flex; background: var(--card); border-top: 1px solid var(--line);
    padding-bottom: env(safe-area-inset-bottom);`;
const NAV_STICKY = `position: sticky; top: 0; z-index: 5;
    display: flex; background: var(--card); border-bottom: 1px solid var(--line);`;
if (!style.includes(NAV_FIXED)) {
  console.error('导航样式与预期不符,artifact.js 的替换规则需要更新');
  process.exit(1);
}
style = style.replace(NAV_FIXED, NAV_STICKY)
             .replace(/padding-bottom: calc\(66px \+ env\(safe-area-inset-bottom\)\);/, 'padding-bottom: 24px;');

// 导航移到内容之前
const nav = pick(/<nav>[\s\S]*?<\/nav>/, '<nav>')[0];
body = body.replace(nav, '').replace('<div class="wrap">', nav + '\n<div class="wrap">');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, `<title>${title} · 家庭菜单</title>\n${style}\n${body.trim()}\n`);
console.log(`✓ 预览页已生成:.artifact/preview.html(${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
console.log('  接下来让 Claude 用固定 URL 发布,保持链接不变');
