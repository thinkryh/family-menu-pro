# SOP — 开工流程与发布流程

配套 `CLAUDE.md`(项目规格)使用。本文只讲**怎么干**,不讲菜谱规则。

---

## 一、环境与分支

一个仓库两条分支,`main` 永远是「已验证」状态。

| | 位置 | 说明 |
|---|---|---|
| 仓库 | `thinkryh/family-menu-pro` | Public,唯一的代码来源 |
| 正式站 | <https://thinkryh.github.io/family-menu-pro/> | Pages 发布源 = `main` 分支 `/docs`,push 后自动更新 |
| `main` | 只接受来自 `dev` 的合并 | 不直接在上面提交 |
| `dev` | 日常干活分支 | 加菜谱、改 UI、改数据都在这里 |
| 预览站 | <https://claude.ai/code/artifact/20d2b178-fc09-4bfe-bd0d-d6a1792381f0> | 绑 `dev`,私有链接,手机可开;合并前先在这里看 |

**两个环境的分工:`dev` → 私有预览链接,`main` → 公开正式站。** 预览链接默认只有你能看,想给家里人试用就在页面右上角分享菜单里单独开。

### 发布流程

```bash
git checkout dev
# ... 改数据或模板 ...
node scripts/build.js          # 校验 + 构建 docs/index.html
node scripts/artifact.js       # 生成 .artifact/preview.html
# 让 Claude 用固定 URL 发布预览(URL 见上表,务必传 url 参数,否则会新开一个链接)
# 或本地直接用浏览器打开 docs/index.html
git add -A && git commit -m "..."
git push origin dev

# 确认没问题,才推正式站
git checkout main
git merge dev                  # 同一条历史,永远是 fast-forward
git push origin main           # Pages 1-2 分钟后更新
git checkout dev               # 切回来继续干活
```

**验证手段**(按成本排序,通常第一条就够):

1. 本地打开 `docs/index.html` — 单文件零依赖,和线上完全一致
2. 无头浏览器自检 — 让 Claude 跑一遍生成菜单、切页面、看有无 JS 报错
3. 手机上看 → `node scripts/artifact.js` 后让 Claude 重发预览链接

> 预览页与仓库版有一处**故意的差异**:artifact 容器的 iframe 高度随内容自适应,固定在视口底部的导航会掉到整页最底部,所以预览版改成顶部吸附;仓库版保持底部导航,手机上拇指够得着。这个转换由 `scripts/artifact.js` 完成,`template.html` 的导航样式若改动,脚本会报错提醒同步。

### 回滚

正式站出问题,不要手忙脚乱改:

```bash
git checkout main && git revert <坏提交> && git push origin main
```

Pages 会自动重新部署。因为两条分支同源,回滚不会让 `dev` 和 `main` 产生分叉。

> **为什么不用两个仓库做测试站/正式站:** 试过,不划算。两个仓库没有共同祖先时,同步只能 force-push,没有三方合并也没有冲突提示;还要维护两份文档、两套设置。这个页面是单文件零后端,本地打开就是完整预览,不需要第二个线上环境。若哪天真的需要可访问的预览地址,正确做法是同一仓库配 Actions 把 `dev` 发到同站点的 `/preview/` 子路径,而不是拆仓库。

---

## 二、每次新开会话的开工流程

1. **挂载仓库**,让 Claude 读 `CLAUDE.md`、本文件和 `data/` 现状
2. **切到 `dev`**:`git checkout dev && git pull origin dev`
3. **验证推送权限**——每个新会话都要跑,凭证不跨会话继承:
   ```bash
   git commit --allow-empty -m "chore: verify write access"
   git push origin dev
   ```
   推成功 → `git reset --hard HEAD~1` 撤掉,开始干活;返回 403 → **停下来先解决权限**(见附录 A),不要往下做内容
4. **对账**:如果你这次上传了 zip,先让 Claude `diff` 对比再覆盖。压缩包常常基于更早的快照,直接解压会冲掉已完成的工作
5. 明确本次目标(例:"加 10 道秋冬时令素菜")
6. 干活 → 校验 → 构建 → 提交 → 推 `dev`
7. **收尾**:确认已推上远端;验证通过后按第一节合并到 `main` 发布

---

## 三、菜谱量产的每批标准动作

每批 ≤ 10 道,顺序执行:

| 步骤 | 命令 / 动作 | 卡点 |
|---|---|---|
| 1. 补食材 | 编辑 `data/ingredients.json` | 主料必须先入食材库,菜谱才能引用 |
| 2. 写菜谱 | 编辑 `data/recipes.json` | 按 `_schema`;`baby_variant` 逐条对照 `baby_rules.json` |
| 3. 校验 | `node scripts/build.js --validate` | 必须零报错才继续 |
| 4. 构建 | `node scripts/build.js` | 生成 `docs/index.html`,**禁止手改该文件**(改 `app/template.html`) |
| 5. 页面自检 | 浏览器打开 `docs/index.html`,点「生成本周菜单」 | 确认无 JS 报错、排菜跑通 |
| 6. 呈报 | 表格列出菜名 / 类别 / 辣度 / 宝宝适配 | 宝宝不适配的必须说明理由 |
| 7. 入库 | 你确认后 commit + push `dev` | commit message 用英文 |
| 8. 发布 | 验证通过后 merge 到 `main` 并 push | 见第一节 |

### 已知卡点(build.js 会拦下的)

- **辣菜措辞**:`spicy ≥ 1` 且宝宝适配的菜,`split_point` 必须含「前盛出」或「先盛」字样,正则硬匹配。写「分菜在下辣椒之前完成」会被拦,要写成「下辣椒和盐之前盛出宝宝份」
- **时令交集**:`season_months` 必须是所有主料时令的子集。番茄是 6-9 月,那么番茄菜就不能写 `"all"`
- **baby_ok=false 的主料**:若菜品仍标 `suitable: true`,`split_point`/`modification` 里必须点名说明宝宝份如何排除它
- **耗时超标**:`cook_time_min > 60` 必须标 `prep_ahead: true`

### 宝宝规则的红线

`data/baby_rules.json` 是硬规则库,**AI 不得自行修改**,任何改动要你人工确认。生成 `baby_variant` 时有疑问一律从严:做不到「加盐加辣前分菜」就标 `suitable: false` 并写明原因,不硬凑。

---

## 四、进度台账

目标 70 道 = 家常 30 + 补充荤菜 10 + 时令素菜 20 + 宝宝重点 5 + 面食主食 5。

| 批次 | 内容 | 状态 |
|---|---|---|
| 0 | 样例 4 道(冬瓜烧排骨 / 青椒炒肉丝 / 蒜蓉空心菜 / 番茄龙利鱼) | 已入库 |
| 1 | 家常 10 | 已入库 |
| 2 | 家常 10 + 构建系统 | 已入库 |
| 3 | 家常 8(补齐 30) | 已入库 |
| 4 | 补充荤菜 6 + 面食 4 | 已入库 |
| 5 | 时令素菜 10 | 已入库 |
| 6 | 时令素菜 9 + 补充荤菜 1 | 已入库 |
| 7 | 宝宝重点 4 + 补充荤菜 3 + 面食 1 | 已入库 |

**菜谱 70 道 / 食材 58 项,全部品类达标。**
每周营养区间:鱼 2-3 次、猪肝 1-2 次(写在 baby_rules,页面体检条实时核对)。
不隔夜的鲜货(鲈鱼/虾/鲫鱼/猪肝)标 `same_day`,只排在采购当天。
按 category:荤 15、半荤 15、素 25、小菜 5、汤 5、主食 5。
按 tag:家常 38、补充荤菜 10、时令素菜 19、宝宝重点 5、面食 5。
8 道按「宁严勿松」标 `suitable: false`(红烧肉 / 鲫鱼豆腐汤 / 酸辣土豆丝 / 地锅鸡 / 韭菜炒鸡蛋 / 虎皮青椒 / 凉拌木耳 / 糖醋排骨)。

后续新增菜谱继续按批次追加本表。

### 时令覆盖现状

食材库已跨季:夏季(秋葵、西葫芦、红薯叶、豇豆、毛豆、玉米、茭白)与秋冬季(白菜、娃娃菜、茼蒿、菜心、莴笋、油麦菜)都有。
**当前 7 月在季可排的菜约占全库 2/3**,秋冬菜到季自动进池,无需改代码。

### 尚未实现

`CLAUDE.md` 里写的评分函数(时令分 + 营养缺口填补 + 耗时匹配 + 食材复用 − 重复惩罚)还没做,当前是「随机取候选 + 硬约束过滤」。70 道菜的池子够大,随机效果尚可;觉得排得不够聪明时再做。

---

## 五、月度时令更新

每月一次:检索下月本地(`config.location`)应季蔬果(多信源交叉,不依赖单一来源)→ 更新 `ingredients.json` 的 `season_months` 并补新食材 → 重新构建 → 推 `dev` → 验证后合并 `main`。此流程后续沉淀为 skill。

---

## 附录 A — 仓库与权限排障

### 授权 ≠ 安装(本项目卡了一整轮的坑)

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

### 会话内做不到的事

以下操作被会话代理拦截,只能你在网页上点:

- 创建 / 删除仓库,改仓库可见性
- 删除远端分支(`git push origin --delete` 会被代理直接断连,`DELETE /git/refs/*` 返回 403)
- 开启 / 配置 GitHub Pages(`POST /repos/{owner}/{repo}/pages`)

规律:会话只被允许改**文件内容**,凡是改仓库结构的操作都要你在网页上点。

### Pages 的限制

- 发布源只能是**仓库根目录**或 **`/docs`**,不支持 `/app`——所以构建产物落在 `docs/`
- 一个仓库只能挂一个 Pages 站点
- 站点一律公开可访问;私有仓库配 GitHub Pro 只是允许「从私有仓库构建」,带访问控制的 Pages 是 Enterprise 才有的
- `docs/.nojekyll` 必须保留,否则 Jekyll 会吞掉下划线开头的文件

### 迁移历史(留作参考)

需要把子目录提升为仓库根、同时保留历史:

```bash
git subtree split --prefix=<子目录> -b extracted
git clone <新仓库> /path/new
cd /path/new && git fetch /path/old extracted && git reset --hard FETCH_HEAD
git push -u origin main
```

需要丢弃旧历史、只留干净的一次提交(本项目公开仓库就是这么建的):

```bash
git checkout --orphan clean-main && git add -A && git commit -m "..."
git push <新仓库> clean-main:main
```
