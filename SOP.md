# SOP — 新仓库搭建与每次开工流程

配套 `CLAUDE.md`(项目规格)使用。本文只讲**怎么干**,不讲菜谱规则。

---

## 一、一次性:新建仓库并打通推送权限

顺序不能反。**权限没验通之前不要开始生成内容**——本项目吃过亏:两批 20 道菜全部做完才发现推不上去。

### 1. 在 GitHub 新建仓库

<https://github.com/new> → 仓库名建议 `family-menu` → 可选 Private → **不要**勾 Add README(留空仓库,迁移时省一次合并)。

### 2. 授权 ≠ 安装(本项目卡了一整轮的坑)

GitHub 上这是两件独立的事,**只做授权不会有任何仓库权限**:

| | 位置 | 给什么 |
|---|---|---|
| Authorized | Applications → Authorized GitHub Apps | 只给身份令牌(Verify identity / Act on your behalf) |
| **Installed** | Applications → **Installed GitHub Apps** | **仓库读写权限,范围由安装时选的仓库决定** |

症状:clone / fetch 正常,`git push` 一律 403。去 Authorized GitHub Apps 点开 Claude,若显示 "Claude has not been installed on any accounts you have access to",就是这个原因。

**安装入口(关键):** <https://github.com/apps/claude> → Install → 选账号 → Repository access 选 All repositories 或勾上目标仓库 → Install。

从 claude.ai 的 Connectors 页面反复 Disconnect / 重连**解决不了**,那个流程只走授权、不含安装环节;在 GitHub 侧 Revoke 再重连也一样。

装完验证:<https://github.com/settings/installations> 的 Installed GitHub Apps 里出现 Claude 即可。注意**中途安装不会回填到已运行的会话**,当前会话若仍推不动就新开一个。

> 兜底方案(不想装 App 时):细粒度 token,<https://github.com/settings/personal-access-tokens/new> → 只勾目标仓库 → Permissions 里 **Contents: Read and write** → 有效期 7 天,用完即 Revoke。

### 3. 【关键】开工前先验证推送

新会话里第一件事,不要跳过:

```bash
git commit --allow-empty -m "chore: verify write access"
git push -u origin <branch>
```

- 推成功 → 权限没问题,`git reset --hard HEAD~1` 撤掉这个空提交,开始干活
- 返回 403 → **停下来先解决权限**,不要往下做内容

### 4. 迁移现有项目到新仓库(已完成,留作参考)

要点:项目内容作为**仓库根目录**,不嵌 `family-menu/` 子目录。想保留提交历史就用 `subtree split` 提取子目录、把它提升为根:

```bash
# 在旧仓库里,把 family-menu/ 子目录切成一段独立历史
git subtree split --prefix=family-menu -b fm-root

# 灌进新仓库(新仓库须为空仓库,建时不要勾 README)
git clone https://github.com/<你>/family-menu.git /path/new
cd /path/new && git fetch /path/old fm-root && git reset --hard FETCH_HEAD
git push -u origin main
```

若旧成果只剩补丁文件(会话容器已回收),先 `git am < family-menu-all.patch` 还原再做上面这步。

---

## 二、每次新开会话的开工流程

1. **上传/挂载仓库**,让 Claude 读 `CLAUDE.md` 和 `data/` 现状
2. **跑权限验证**(上面第 3 步)——每个新会话都要跑,凭证不跨会话继承
3. **对账**:如果你这次上传了 zip,先让 Claude `diff` 对比再覆盖。压缩包常常基于更早的快照,直接解压会冲掉已完成的批次
4. 明确本次目标(例:"第三批 10 道,补齐阜阳家常剩余")
5. 干活 → 校验 → 构建 → 提交 → 推送
6. **收尾**:确认 `git log` 已推上远端;若推送受阻,让 Claude 导出补丁发给你备份

---

## 三、菜谱量产的每批标准动作

每批 ≤ 10 道,顺序执行:

| 步骤 | 命令 / 动作 | 卡点 |
|---|---|---|
| 1. 补食材 | 编辑 `data/ingredients.json` | 主料必须先入食材库,菜谱才能引用 |
| 2. 写菜谱 | 编辑 `data/recipes.json` | 按 `_schema`;`baby_variant` 逐条对照 `baby_rules.json` |
| 3. 校验 | `node scripts/build.js --validate` | 必须零报错才继续 |
| 4. 构建 | `node scripts/build.js` | 生成 `docs/index.html`,**禁止手改该文件**(改 `app/template.html`) |
| 5. 页面自检 | 无头浏览器打开 index.html,点「生成本周菜单」 | 确认无 JS 报错、排菜跑通 |
| 6. 呈报 | 表格列出菜名 / 类别 / 辣度 / 宝宝适配 | 宝宝不适配的必须说明理由 |
| 7. 入库 | 你确认后 commit + push | commit message 用英文 |

### 已知卡点(build.js 会拦下的)

- **辣菜措辞**:`spicy ≥ 1` 且宝宝适配的菜,`split_point` 必须含「前盛出」或「先盛」字样,正则硬匹配。写「分菜在下辣椒之前完成」会被拦,要写成「下辣椒和盐之前盛出宝宝份」
- **时令交集**:`season_months` 必须是所有主料时令的子集。番茄是 6-9 月,那么番茄菜就不能写 `"all"`
- **baby_ok=false 的主料**:若菜品仍标 `suitable: true`,`split_point`/`modification` 里必须点名说明宝宝份如何排除它
- **耗时超标**:`cook_time_min > 60` 必须标 `prep_ahead: true`

### 宝宝规则的红线

`data/baby_rules.json` 是硬规则库,**AI 不得自行修改**,任何改动要你人工确认。生成 `baby_variant` 时有疑问一律从严:做不到「加盐加辣前分菜」就标 `suitable: false` 并写明原因,不硬凑。

---

## 四、进度台账

目标 70 道 = 阜阳家常 30 + 补充荤菜 10 + 时令素菜 20 + 宝宝重点 5 + 面食主食 5。

| 批次 | 内容 | 状态 |
|---|---|---|
| 0 | 样例 4 道(冬瓜烧排骨 / 青椒炒肉丝 / 蒜蓉空心菜 / 番茄龙利鱼) | 已入库 |
| 1 | 阜阳家常 10 | 已入库 |
| 2 | 阜阳家常 10 + 构建系统 | 已入库 |
| 3 | 阜阳家常 8(补齐 30) | 已入库 |
| 4 | 补充荤菜 6 + 面食 4 | 已入库 |
| 5 | 时令素菜 10 | 已入库 |
| 6 | 时令素菜 9 + 补充荤菜 1 | 已入库 |
| 7 | 宝宝重点 4 + 补充荤菜 3 + 面食 1 | 已入库 |

**菜谱 70 道 / 食材 58 项,全部品类达标。**
按 category:荤 15、半荤 15、素 25、小菜 5、汤 5、主食 5。
按 tag:阜阳家常 38、补充荤菜 10、时令素菜 19、宝宝重点 5、面食 5。
8 道按「宁严勿松」标 `suitable: false`(红烧肉 / 鲫鱼豆腐汤 / 酸辣土豆丝 / 地锅鸡 / 韭菜炒鸡蛋 / 虎皮青椒 / 凉拌木耳 / 糖醋排骨)。

后续新增菜谱继续按批次追加本表。

### 时令覆盖现状

食材库已跨季:夏季(秋葵、西葫芦、红薯叶、豇豆、毛豆、玉米、茭白)与秋冬季(白菜、娃娃菜、茼蒿、菜心、莴笋、油麦菜)都有。
**当前 7 月在季可排的菜约占全库 2/3**,秋冬菜到季自动进池,无需改代码。每月按第五节更新 `season_months` 即可。

---

## 五、月度时令更新

每月一次:检索下月本地(config.location)应季蔬果(多信源交叉,不依赖单一来源)→ 更新 `ingredients.json` 的 `season_months` 并补新食材 → 重新构建 → 推送。此流程后续沉淀为 skill。
