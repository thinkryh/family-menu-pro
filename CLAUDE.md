# family-menu — 家庭每日食谱系统

为一个带幼儿的家庭生成周菜单与分批购物清单;家庭画像(人数、幼儿月龄、口味、地区)全部读 `data/config.json`,本文档不复述。
口味基调:咸鲜为主、吃辣,偏北方面食;时令按华东。

## 核心原则

1. **宝宝安全高于一切**:`data/baby_rules.json` 是硬规则库,任何改动必须由用户人工确认后才能提交,AI 不得即兴修改或绕过。菜谱的 baby_variant 生成后必须逐条对照 baby_rules 校验。
2. **一菜两做**:同一道菜,宝宝份在「加盐、加辣之前」盛出改造,不做两桌菜。做不到就标 `suitable: false` 并写明原因,宁严勿松。
3. **菜谱是决策单元,不是教程**:掌勺者会做家常菜,不写详细步骤;仅「宝宝重点」标签菜和生僻菜写 `steps_brief`。
4. **系统承担复杂性**:排菜、份量换算、采购批次分组、储存提示全部自动;用户操作只有三步:看菜单 → 换一换 → 拿清单。

## 目录结构

```
family-menu/
├── CLAUDE.md
├── data/
│   ├── config.json        # 家庭画像、餐次模板、排菜约束、采购批次
│   ├── baby_rules.json    # 幼儿喂养硬规则(改动需用户人工确认)
│   ├── ingredients.json   # 食材库:时令月份 + 储存 + 宝宝适配
│   └── recipes.json       # 菜谱库(70 道)
├── app/
│   └── template.html      # 页面模板(唯一手改入口)
├── docs/
│   └── index.html         # 构建产物,单文件数据内嵌;GitHub Pages 发布目录
└── scripts/
    └── build.js           # 校验 + 数据内嵌 + 构建
```

## 数据规范

- 所有 id 用拼音 snake_case(如 `dongua_shao_paigu`),全库唯一
- 份量字段 `qty_g` 一律为「全家一餐」的量(4 成人 + 娃),购物清单直接按批次累加
- `season_months` 用数字数组 [1-12],全年可用写 `"all"`
- 菜谱的 `main_ingredients` 中每个食材必须存在于 ingredients.json,不存在先补食材库再入菜谱
- 新增/修改字段:先改本文档和对应 `_schema` 说明,再改数据

## 菜谱量产流程(在 Claude Code 中执行)

目标 70 道:家常 30(约 20 荤、10 素/小菜)+ 补充荤菜 10 + 时令素菜 20 + 宝宝重点菜 5 + 面食主食 5。
排除项:臭鳜鱼等发酵重味菜。辣菜正常入库(标 spicy 等级)。
**状态:70 道已全部入库**,后续新增走同一流程(见 SOP.md 进度台账)。
面食主食用 `category: 主食` + `meal_type: ["dinner"]`,面条本身带荤带素;排菜命中面食夜时不再另排荤菜。

流程:
1. 按 recipes.json 已有样例的 schema 批量生成,**每批 ≤ 10 道**
2. 每批生成后立即校验(build.js --validate 建成前用人工清单):
   - baby_variant 逐条对照 baby_rules.json 的 forbidden / texture 规则
   - spicy ≥ 1 的菜必须写明确的分菜时机(参考样例 `qingjiao_chao_rousi` 的写法);写不明确 → `suitable: false`
   - 主料在 ingredients.json 中可查
   - 荤菜 cook_time 与 config 的单餐 60 分钟预算兼容(炖菜标 prep_ahead)
3. 校验通过 → 呈现给用户确认 → 入库。宝宝相关字段有任何疑问一律从严处理。

## 排菜约束(算法硬约束)

- 早餐不上炒菜:饮品 + 主食 + 蛋,全部走 config 的轮换表,不占菜谱池
- 面食仅晚餐,≤ 3 次/周;午餐固定米饭
- 汤 ≤ 2 次/周,插入项不占固定位
- 同菜冷却 7 天;同主料每周 ≤ 2 次且须不同做法
- 单餐总耗时 ≤ 60 分钟
- 每周:猪肝 1-2 次(少量,宝宝补铁)、鱼 2-3 次(优先宝宝可用鱼种);区间从 baby_rules 的文案解析
  → 上限在选菜时由 `okHere()` 挡住,下限由 `enforceWeekly()` 生成后补位;补位优先于「同主料 ≤2 次」的软约束
- **不隔夜的鲜货**(ingredients 里 `same_day: true`:鲈鱼/虾/鲫鱼/猪肝)只能排在采购当天(周日或周三),这是硬约束
- 叶菜按采购批次分配,不跨批
- 评分函数:时令分 + 营养缺口填补 + 耗时匹配 + 食材复用 − 重复惩罚(尚未实现,当前为随机取候选 + 硬约束过滤)

页面顶部的「本周体检」条实时显示这些约束的达成情况,超标/缺口标暖色。

## 采购批次

每批从**采购当天**管起(周日批管周日-周二,周三批管周三-周六),这样不隔夜的鱼虾能排在采购当天吃;覆盖范围写在 `config.shopping.batch_coverage`,算法读它、不写死。耐储类(batch_priority 3)按全周用量并入周日批。

## 时令指南(页面第三个标签)

月份选择器 + 食材全年上市热力条 + 当月可做菜谱清单,支持「宝宝能吃 / 不辣 / 30 分内 / 当天吃」四个筛选。数据全部来自 `ingredients.season_months` 与菜谱的时令交集,不需要单独维护。

## 月度时令更新

每月 1 次:检索下月本地(config.location)应季蔬果(信源:农业上市数据、权威营养媒体,不依赖单一来源)→ 更新 ingredients.json 的 season_months 与新增食材 → 重新构建。此流程沉淀为 skill。

## 开发与部署

- 改完必跑校验与构建;报错找根因,不注释绕过
- 密钥不进代码(本项目应无密钥需求,出现即设计错误)
- commit message 英文简洁;git push 等用户明确指示
- 分支流:日常改动提交到 `dev`,验证通过后合并到 `main` 发布;不直接在 `main` 上提交(详见 SOP.md 第一节)
- 构建:`node scripts/build.js`(校验 + 生成 docs/index.html);量产时每批跑 `node scripts/build.js --validate`
- 页面机制:排菜算法在浏览器端运行,localStorage 记住本周菜单与冷却历史;build.js 只负责校验和数据注入。**docs/index.html 是构建产物,禁止手改,改 app/template.html 后重新构建**
- 部署:GitHub Pages 发布源 = `main` 分支 `/docs`(Pages 只支持根目录或 /docs,不支持 /app)。合并到 `main` 后 Pages 自动更新,1-2 分钟生效;回滚用 `git revert`
