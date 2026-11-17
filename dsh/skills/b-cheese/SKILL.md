---
name: b-cheese
slug: b-cheese-courses
displayName: B站课堂课程采集
version: 1.0.0
description: B站课堂（bilibili 课堂 / cheese / pugv）课程采集工具。当用户需要获取B站课堂新课推荐、B站课堂排行榜、B站付费课程列表、按分类/销量/价格筛选课堂课程、某门课堂课程的详情（讲师/价格/课时/播放）或完整课时目录，或导出B站课堂课程 CSV，或提到"B站课堂/B站课程/哔哩哔哩课堂/cheese课程/课堂新课推荐/课堂排行榜/付费课程采集"时使用本 skill。全部由服务端直连B站公开接口，无需B站账号、无需浏览器节点。首页两区块与分类列表每次 1 点数，课程详情 1 门 1 点数，失败全额返还。
---

# B站课堂课程采集 Skill（b-cheese）

## AI 调用来源参数（必填）

所有会访问后端 API 的命令必须携带 `--skill-name b-cheese` 和 `--ai-entry <AI工具标识>`（例如 `claude-code`、`codex`、`workbuddy`）。IP 无需传递，由服务端自动获取。首次缺参会告警放行，第二次起拒绝。

示例：`node cli.js quota --skill-name b-cheese --ai-entry claude-code`。

封装「社媒采集平台」（FastAPI，`/api/v1`）的零依赖 Node CLI。三个子命令对应三个后端能力：

| 子命令 | 后端能力 | 采什么 | 计费 |
|---|---|---|---|
| `home` | `b_cheese_home` | 课堂首页「新课推荐」16 门 + 「排行榜」4 门 | 1 点数/次 |
| `list` | `b_cheese_list` | 分类列表（30 门/页，可翻 1~10 页 = 最多 300 门） | 1 点数/次 |
| `detail` | `b_cheese_detail` | 课程详情 + 完整课时目录（最多 50 门/次） | 1 点数/门 |

- **采集方式**：服务端直接请求 B 站课堂公开接口（`api.bilibili.com/pugv/...`），**不需要用户给B站账号、不占浏览器节点、通常 3~15 秒出结果**（详情含大课时目录时更久）。
- **能采什么**：课程标题、副标题、封面、课程链接、课时数、原价、券后价、价格单位、播放量、更新状态、榜单露出（如「影视创作榜No.2」）、首集试看标题；详情额外有：简介、UP主（mid/昵称/粉丝/简介）、已上架课时、优惠文案、券面额、有效期、完整目录（每集标题/时长/播放/上架时间/是否可试看）。
- **已知口径**：B站课堂不展示课程评分；**排行榜区块本身没有价格**（价格列为空，属正常）；未登录抓取时价格单位可能显示「B币」而不是「元」（B站自身行为，数值一致）；目录只列已上架/可试看集数，可能少于总课时数。
- **收费**：首页两区块与分类列表 **1 点数/次**，课程详情 **1 点数/门**；注册送 10 点；失败或零结果全额返还（课程已下架不返还）。
- 客户端零 npm 依赖，Node.js ≥ 18；stdout 纯 JSON，进度走 stderr。

## 收费价格

- **点数换算：0.1 元 = 1 点数。**

## 点数不足怎么办（自动扫码充值）

跑命令时如果点数不够，CLI **不会直接报错退出**，而是自己建一张充值单、把二维码打在终端里，付完自动重跑原命令：

```
点数不足，已自动创建充值单 RO2611051712281481f36de19
金额 10.00 元 → 100 点（支付宝）
<二维码色块>
[pay] 已支付
已到账：+100 点，继续执行原命令
```

非交互环境（AI agent 跑命令）不会阻塞，会直接返回 `pay_url` 和订单号，把链接给用户即可。也可以主动充值：`node cli.js pay --yuan 10 --skill-name b-cheese --ai-entry <ai-entry>`。

## 首次使用

1. 注册（送 10 点）：

```bash
node cli.js register --link --skill-name b-cheese --ai-entry <ai-entry>
node cli.js register --check --access-token "<上一步下发的串>" --skill-name b-cheese --ai-entry <ai-entry>
```

2. 已有账号则登录：`node cli.js login --link --skill-name b-cheese --ai-entry <ai-entry>` → `node cli.js login --check --access-token "<串>" --skill-name b-cheese --ai-entry <ai-entry>`（`--check` 那步同样要带来源参数）。

## 常用命令

```bash
# 1) 首页两区块（截图里的「新课推荐」+「排行榜」）
node cli.js home --wait --skill-name b-cheese --ai-entry <ai-entry>

# 2) 分类列表：考研/数学，按销量排序，取 2 页（60 门）
node cli.js list --sub 105 --sort sales --pages 2 --wait --skill-name b-cheese --ai-entry <ai-entry>

# 3) 分类列表：AI·互联网大类，最新上架，只看已完结课程
node cli.js list --class 89 --cond finished --sort newest --pages 1 --wait --skill-name b-cheese --ai-entry <ai-entry>

# 4) 课程详情 + 完整课时目录（一门课 1 点）
node cli.js detail --url https://www.bilibili.com/cheese/play/ss633889254 --wait --skill-name b-cheese --ai-entry <ai-entry>

# 5) 批量详情（每行一条，最多 50 条）
node cli.js detail --file courses.txt --wait --skill-name b-cheese --ai-entry <ai-entry>

# 6) 查结果 / 导出 CSV
node cli.js query <task_id> --wait --skill-name b-cheese --ai-entry <ai-entry>
node cli.js export <task_id> --wait --out bili_cheese.csv --skill-name b-cheese --ai-entry <ai-entry>
```

## 参数说明

- `--class`：一级分类。`-1` 全部分类（默认）、`95` 通识科普、`94` 兴趣生活、`93` 语言学习、`88` 考研、`87` 考试·考证、`164` 影视·创作、`89` AI·互联网、`92` 职业职场、`181` 个人成长。
- `--sub`：二级分类 id（如 `106` 考研/政治、`105` 考研/数学、`165` 影视·创作/剪辑·特效、`113` AI·互联网/数据分析），**选了就覆盖 `--class`**。
- `--sort`：`totalrank` 综合排序（默认）/ `sales` 销量最高 / `newest` 最新上架 / `cheapest` 售价最低。
- `--cond`：`none` 不限（默认）/ `live` 含直播课 / `group` 含课程群 / `finished` 已完结。
- `--type`：`none` 不限（默认）/ `selected` 课堂臻选 / `exclusive` B站独家。
- `--pages`：分类列表采集页数，每页 30 门，`1~10`，默认 1。**计费不随页数增加**，但单次上限 300 门。
- `--url` / `--file`：课程链接，支持 `/cheese/play/ss<id>`、`/cheese/play/ep<id>`，也可直接填纯数字 `season_id`；单次最多 50 条。
- 非法参数值会回落默认值（不报错），与服务端白名单一致。

## 输出与导出

`--wait` 时 stdout 返回完整任务 JSON：`home` 有 `new_courses` / `rank_courses`（各 16 / 4 条），`list` 有 `matched_total`（该筛选条件全站总数）、`collected_count`、以及前 20 门的 `preview`（`preview_truncated` 表示还有多少门未回传），`detail` 有 `detail`（课程全字段）与 `episodes`（目录预览最多 30 条）。**完整明细一律走 `export`**，避免轮询时重复传输几百 KB。

`export` 出的 CSV：任务汇总 + 明细（`home` 两区块合一段并标 `section`，`detail` 额外附「课时目录」段落），UTF-8 带 BOM，Excel 直接打开不乱码。

## 常见问题

- **排行榜价格为空**：B站排行榜区块接口与页面都不提供价格，非采集失败。
- **课时目录条数少于总课时**：目录只列已上架/可试看集，`ep_count` 才是课程标称总课时。
- **价格显示 B币**：未登录抓取时 B 站返回 B币单位，数值与「元」价一致。
- **零结果**：分类+筛选组合无课程时全额返还点数，换条件或放宽筛选再试。
- **课程已下架**：`detail` 返回 `fail_kind=unavailable`，该门不返还点数。
