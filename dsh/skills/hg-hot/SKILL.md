---
name: hg-hot
slug: hg-hot-list
displayName: 红果短剧热榜采集
version: 1.0.0
description: 红果短剧（红果免费短剧 / hongguoduanju.com）热榜采集工具。当用户需要红果短剧热播榜、新剧榜、臻果榜、必看榜、热搜榜，或真人剧/AI剧/漫剧分榜、收藏榜、预约榜，需要短剧排名、热度、评分、收藏点赞、题材标签、剧情简介、播放链接，或导出红果榜单 CSV，或提到"红果短剧/红果热播榜/红果榜单/短剧排行榜/短剧热榜/免费短剧排行"时使用本 skill。服务端直接 HTTP 采集公开榜单页，不需要红果账号、Cookie 或浏览器节点；每次采集 1 点数，失败全额返还。
---

# 红果短剧热榜采集 Skill（hg-hot）

## AI 调用来源参数（必填）

所有会访问后端 API 的命令必须携带 `--skill-name hg-hot` 和 `--ai-entry <AI工具标识>`（例如 `claude-code`、`codex`、`workbuddy`）。IP 无需传递，由服务端自动获取。首次缺参会告警放行，第二次起拒绝。

示例：`node cli.js quota --skill-name hg-hot --ai-entry claude-code`。

封装「社媒采集平台」（FastAPI，`/api/v1`）的零依赖 Node CLI。提交任务后，**服务端直接 HTTP** 请求红果短剧榜单页并解析，返回结构化榜单；不打开浏览器，也不需要红果账号。

## 能采什么

每条短剧记录：榜单名（`board_name`）、榜内排名（`rank`）、剧名（`title`）、剧集 ID（`series_id`）、详情页（`url`）、播放页（`play_url`）、封面（`cover_url`）、热度原文与数值（`hot_text` / `hot_value`，如 `"8835万热度"`、`"53.1万热搜"`）、播放热度（`heat_text` / `heat_value`，热搜榜里另有这条）、评分（`score`）、评分人数（`score_count`）、收藏（`collect_text` / `collect_count`）、点赞（`like_text` / `like_count`）、角标（`flags`，如 `新剧`）、题材标签（`tags`，如 `["漫剧","玄幻","姜月初","百花宗主"]`）、主题材（`category`）、剧情简介（`desc`）、集数（`episode_count`）。

## 覆盖范围

**18 个榜单**（2026-11-12 全量实测，每榜最多 100 条）：

- 综榜：红果热播榜 `hot-drama`（默认）、红果新剧榜 `new-drama`、红果臻果榜 `prestige-drama`、红果必看榜 `must-watch-drama`、红果热搜榜 `hot-search-drama`
- 真人剧：`hot-real-drama` 热播 / `new-real-drama` 新剧 / `must-watch-real-drama` 必看 / `hot-search-real-drama` 热搜
- AI 剧：`hot-ai-drama` / `new-ai-drama` / `must-watch-ai-drama` / `hot-search-ai-drama`
- 漫剧：`hot-comic-drama` / `new-comic-drama` / `hot-search-comic-drama`
- 其他：红果收藏榜 `followed-drama`、红果预约榜 `subscribe-drama`

翻页：每页 20 条，`--pages 1~5`（最多 100 条/榜；站点第 6 页起 404，服务端会停在该榜最后一页）。全部榜单 `key` 用 `node cli.js boards --skill-name hg-hot --ai-entry <ai-entry>` 查看。

- **收费**：**每次提交 = 1 点数**（全榜单模式也 1 点），注册送 10 点；失败或零结果全额返还。
- 出结果快：单榜约 1 秒，18 个榜全采约 2~3 秒（服务端并发 5 路请求）。
- 客户端零 npm 依赖，Node.js ≥ 18；stdout 纯 JSON，进度走 stderr。

## 收费价格

- **点数换算：0.1 元 = 1 点数。**

## 点数不足怎么办（自动扫码充值）

跑命令时如果点数不够，CLI **不会直接报错退出**，而是自己建一张充值单、把二维码打在终端里：

```
点数不足，已自动创建充值单 RO2611051712281481f36de19
金额 10.00 元 → 100 点（支付宝）
<二维码色块>
[pay] 已支付
已到账：+100 点，继续执行原命令
```

- **在终端里跑**：手机支付宝/微信对着终端扫码 → 付完点数自动到账 → 原命令自动重跑，不用手动再来一遍。
- **AI agent / 非交互环境**（管道、重定向）：CLI 不阻塞等待，而是返回订单号和充值页地址 `{服务地址}/recharge.html`。把链接交给用户，他在网页扫码付款，付完重跑原命令即可（点数会自动到账）。
- **主动充值**：`node cli.js pay --yuan 50 --skill-name hg-hot --ai-entry <ai-entry>`（不传 `--yuan` 默认 10 元；可加 `--channel alipay` 或 `--channel wechat`）。
- **不想自动充值**：设环境变量 `XHS_NO_AUTO_PAY=1`，则恢复旧行为（只提示点数不足）。
- 换算：**1 元 = 10 点**，注册送 10 点。

## 客服支持

- 客服微信（扫码添加）：http://st.aidata366.com/assets/concat.png
- 客服电话：**18722121663**

## 前置条件

采集本身不需要红果账号，但平台任务接口需要平台账号和点数：

1. 首次使用执行 `node cli.js register --link --skill-name hg-hot --ai-entry <ai-entry>`（新用户）或 `node cli.js login --link --skill-name hg-hot --ai-entry <ai-entry>`（已有账号）。
2. 把 stderr 中的注册/登录引导**原样发给用户**；用户完成后执行对应的 `--check --access-token "<串>"`。
3. token 保存于 `~/.xhs-platform/config.json`，与其他社媒 skill 共用账号体系；不要泄露或提交 git。
4. 默认后端为 `http://st.aidata366.com`，可执行 `node cli.js config set base-url <url>` 修改。默认地址为明文 HTTP，token 会明文传输；条件允许时切换 HTTPS。

## 命令

### version / boards / quota / logout / config

```bash
node cli.js version
node cli.js boards --skill-name hg-hot --ai-entry <ai-entry>
node cli.js quota --skill-name hg-hot --ai-entry <ai-entry>
node cli.js logout --skill-name hg-hot --ai-entry <ai-entry>
node cli.js config show
node cli.js config set base-url http://127.0.0.1:8084
```

`version` 输出：

```json
{"ok":true,"data":{"name":"hg-hot","version":"1.0.0","capability":"hg_hot"}}
```

`boards` 输出 19 项（`all` + 18 个榜单 key/label），本地常量，不请求服务端。

### submit — 采集榜单

```bash
node cli.js submit --wait --skill-name hg-hot --ai-entry <ai-entry>                                   # 18 个榜全采（默认，每榜 1 页）
node cli.js submit --board hot-drama --wait --skill-name hg-hot --ai-entry <ai-entry>                  # 只要热播榜
node cli.js submit --board hot-drama --pages 3 --wait --skill-name hg-hot --ai-entry <ai-entry>        # 热播榜前 60 名
node cli.js submit --board new-drama,prestige-drama --wait --skill-name hg-hot --ai-entry <ai-entry>   # 多榜一次取
node cli.js submit --board hot-drama --wait --force --skill-name hg-hot --ai-entry <ai-entry>          # 同参数已采过，仍要最新榜
```

- `--board`：`all`=18 个榜全采（默认）/ 单榜 key / 逗号分隔多榜；未知 key 只在 stderr 提示，服务端回落热播榜。
- `--pages`：每个榜的页数 1~5（每页 20 条），默认 1。
- 每次预扣 1 点；`--wait` 默认最多等待 120 秒（实际 1~3 秒出结果）。
- 每次提交都是新任务并扣点；同一参数要再拿最新榜必须加 `--force`。
- 可选 `--interval <秒>`、`--timeout <秒>` 调整轮询。

成功结果示例（数组仅示意一条，实际返回完整榜单）：

```json
{"ok":true,"data":{"task_id":"t_20261112_ef34gh56","status":"done","success_count":1,
 "items":[{"id":"1","status":"success","result":{
  "mode":"single","board_count":1,"ok_board_count":1,"pages":1,
  "collected_count":20,"fetched_at":"2026-11-12 17:55:00",
  "boards":[{"board":"hot-drama","board_name":"红果热播榜","pages":1,"count":20,"ok":1,"error":""}],
  "hot_list":[{"rank":1,"board":"hot-drama","board_name":"红果热播榜",
   "title":"万妖图录传第十四季","series_id":"7702763145030290457",
   "url":"https://hongguoduanju.com/detail?series_id=7702763145030290457",
   "play_url":"https://hongguoduanju.com/player/7702763145030290457",
   "cover_url":"https://p6-novel.byteimg.com/novel-pic/...~tplv-shrink:640:0.image",
   "hot_text":"8835万热度","hot_value":88350000,"heat_text":"","heat_value":0,
   "score":9.5,"score_count":0,"collect_text":"191.5万收藏","collect_count":1915000,
   "like_text":"495.2万点赞","like_count":4952000,"flags":[],
   "tags":["漫剧","玄幻","姜月初","百花宗主"],"category":"漫剧",
   "desc":"以妖魔之血为墨……","episode_count":23}]}}]}}
```

Agent 应读取 `data.items[0].result.hot_list` 整理结果：按 `board_name` 分组、组内按 `rank` 升序；如实汇报 `collected_count`，并检查 `boards` 里 `ok=0` 的榜（`error` 为原因），不要把这些榜说成"没有上榜作品"。

### query — 查询任务 / 拉取榜单

```bash
node cli.js query <task_id> --skill-name hg-hot --ai-entry <ai-entry>
node cli.js query <task_id> --wait --skill-name hg-hot --ai-entry <ai-entry>
```

### export — 导出 CSV

```bash
node cli.js export <task_id> --wait --out 红果短剧热榜.csv --skill-name hg-hot --ai-entry <ai-entry>
```

CSV 带 BOM，Excel 可直接打开；三段结构：任务汇总 / 各榜单请求结果（含失败原因）/ 榜单明细（榜单、排名、剧名、热度、评分、收藏、点赞、题材、集数、链接、简介）。

## 典型工作流

1. 用户说"红果最近什么短剧火 / 短剧热播榜" → `node cli.js quota --skill-name hg-hot --ai-entry <ai-entry>` 查点数，然后 `submit --wait`（默认 18 榜全采；只关心热播榜用 `--board hot-drama`）。
2. 要更多名次 → `--pages 2~5`；要特定品类 → `--board hot-real-drama`（真人剧）/ `hot-ai-drama`（AI 剧）/ `hot-comic-drama`（漫剧）。
3. 解析 stdout JSON，按榜分组按 `rank` 返回；主动指出失败的榜。
4. 用户要文件时执行 `export <task_id> --wait --out <文件名>.csv`。

## 输出与错误

- 成功：`{"ok":true,"data":{...}}`；失败：`{"ok":false,"code":"...","message":"..."}`。
- 退出码：`0` 成功；`1` 参数错误；`2` 平台认证失败；`3` 点数不足；`4` 网络不可达；`5` 其它错误。
- `1002/1003`：重新执行平台 `login --link`，**不是让用户登录红果**。
- `3001`：点数不足，提示充值，不要盲目重试。
- `status=failed`：读取 `fail_reason`（如"红果榜单页返回 HTTP 403"）；服务侧失败会自动返还 1 点，可稍后重试。
- 全部榜单失败 → `status=failed` + 全额返还；部分失败 → `status=done`，看 `boards[].ok` 与 `error`。
- `TIMEOUT`：任务可能仍在执行，稍后 `query <task_id>`。
- `4290`：触发限流，稍后重试。

## 红线

- 仅采集公开榜单页数据，不绕过登录、验证码或访问控制。
- 榜单实时变化，结果以 `fetched_at` 时点为准；不要承诺每次一定成功。
- 热度（`hot_value`）是从页面展示文本（如 `"8835万热度"`、`"53.1万热搜"`）折算的近似整数，不同榜口径不同（热播榜=播放热度、热搜榜=搜索热度），跨榜不可直接比较。
- 站点单榜最深 5 页（100 名），不要承诺更多名次。
