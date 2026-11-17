---
name: zlh-hot
slug: zlh-hot-all
displayName: 全平台热榜采集
version: 1.1.0
description: 全网热榜/热搜采集工具（按需取榜：用户要哪个平台就只取哪个平台）。覆盖知乎、微博、百度、抖音、小红书、B站、今日头条、36氪、虎扑、雪球、微信读书、豆瓣、澎湃、网易、凤凰、IT之家、少数派、爱奇艺、游民星空、开源中国等 36 个平台、95 个榜单。当用户要看某个平台的热榜/热搜/热文排行、或按子榜取榜、或一次取多个指定平台、或导出热榜 CSV，或提到"热榜/热搜榜/全网热搜/多平台热榜/热榜聚合/热搜榜采集"时使用本 skill。服务端已聚合各平台公开榜单，不需要任何平台登录态、Cookie 或浏览器节点；每次采集 1 点数，失败全额返还。
---

# 全平台热榜采集 Skill（zlh-hot）

## AI 调用来源参数（必填）

所有会访问后端 API 的命令必须携带 `--skill-name zlh-hot` 和 `--ai-entry <AI工具标识>`（例如 `claude-code`、`codex`、`workbuddy`）。IP 无需传递，由服务端自动获取。首次缺参会告警放行，第二次起拒绝。

示例：`node cli.js quota --skill-name zlh-hot --ai-entry claude-code`。

封装「社媒采集平台」（FastAPI，`/api/v1`）的零依赖 Node CLI。提交任务后，**服务端只按用户点名的榜单取回对应数据**（要知乎就只取知乎，要几个平台就取几个），不会把全部榜单一次拉下来；不打开浏览器、不需要任何平台账号。

## 能采什么

一条热榜记录：所属平台（`tab_name`）、子榜（`sub_name`）、榜内排名（`rank`）、标题（`title`）、热度原文（`hot_text`，如 `"4285万热度"`、`"74.8万播放"`、`"170弹幕"`）、热量化值（`hot_value` 整数）、原文链接（`url` / `mobile_url`）、作者（`author` / `author_url`，有的平台没有）、摘要（`desc`）、封面（`cover_url`）、是否视频（`is_video`）、发布时间（`publish_time`，有的平台没有）、条目 ID（`item_key`）。

## 覆盖范围

- **36 个平台、95 个榜单**（2026-11-12 全量实测可用）：全站综合、知乎、微博（热搜/文娱）、百度（热搜/小说/电影/电视剧）、抖音、小红书（阅读/点赞/收藏）、B站（热门/每周必看/排行榜）、今日头条、36氪、虎扑（步行街/NBA/游戏/数码/影视娱乐/国际足球）、雪球、微信读书、豆瓣书影音、豆瓣社区、澎湃、凤凰、网易新闻、腾讯新闻、IT之家、少数派、虎嗅、喷嚏网、直播吧、爱奇艺、游民星空、开源中国、同花顺、吾爱破解、蓝点网、小众软件、爱范儿、知乎日报、观风闻、360热搜、百度贴吧、小米有品、什么值得买（个别榜单偶发不可用，服务端会逐榜报错，不影响其它榜）。
- **按需取榜（核心原则）**：用户要看哪个平台，就只请求那个平台的榜，一次只打一个榜的请求。
  - 不传 `--board` → 只取**全站今日榜**（1 个榜），不会自动拉全部。
  - 单榜：`zhihu`；子榜：`weibo|search`；多榜（用户明确要多个平台时）：`zhihu,weibo|search,douyin`。
  - `all` = 36 个主榜全量，**只有用户明确说"所有平台/全部榜单/全平台"时才用**，别自作主张。
- 全部榜单选项执行 `node cli.js boards --skill-name zlh-hot --ai-entry <ai-entry>` 查看（`value` 直接给 `--board`）。
- **收费**：**每次提交 = 1 点数**（取 1 个榜和取多个榜都是 1 点），注册送 10 点；失败或零结果全额返还。
- 出结果快：单榜约 1 秒（只请求该榜），`all` 全量约 1~3 秒（服务端并发拉取）。
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
- **主动充值**：`node cli.js pay --yuan 50 --skill-name zlh-hot --ai-entry <ai-entry>`（不传 `--yuan` 默认 10 元；可加 `--channel alipay` 或 `--channel wechat`）。
- **不想自动充值**：设环境变量 `XHS_NO_AUTO_PAY=1`，则恢复旧行为（只提示点数不足）。
- 换算：**1 元 = 10 点**，注册送 10 点。

## 客服支持

- 客服微信（扫码添加）：http://st.aidata366.com/assets/concat.png
- 客服电话：**18722121663**

## 前置条件

采集本身不需要任何平台账号，但平台任务接口需要平台账号和点数：

1. 首次使用执行 `node cli.js register --link --skill-name zlh-hot --ai-entry <ai-entry>`（新用户）或 `node cli.js login --link --skill-name zlh-hot --ai-entry <ai-entry>`（已有账号）。
2. 把 stderr 中的注册/登录引导**原样发给用户**；用户完成后执行对应的 `--check --access-token "<串>"`。
3. token 保存于 `~/.xhs-platform/config.json`，与其他社媒 skill 共用账号体系；不要泄露或提交 git。
4. 默认后端为 `http://st.aidata366.com`，可执行 `node cli.js config set base-url <url>` 修改。默认地址为明文 HTTP，token 会明文传输；条件允许时切换 HTTPS。

## 命令

### version / boards / quota / logout / config

```bash
node cli.js version
node cli.js boards --skill-name zlh-hot --ai-entry <ai-entry>                       # 列出全部榜单 value/label（本地常量，不请求服务端）
node cli.js quota --skill-name zlh-hot --ai-entry <ai-entry>
node cli.js logout --skill-name zlh-hot --ai-entry <ai-entry>
node cli.js config show
node cli.js config set base-url http://127.0.0.1:8084
```

`version` 输出：

```json
{"ok":true,"data":{"name":"zlh-hot","version":"1.1.0","capability":"rebang_hot"}}
```

### submit — 采集热榜

```bash
node cli.js submit --board zhihu --wait --skill-name zlh-hot --ai-entry <ai-entry>                    # 只看知乎（只请求知乎这一个榜）
node cli.js submit --board weibo|search --wait --skill-name zlh-hot --ai-entry <ai-entry>             # 微博热搜子榜
node cli.js submit --board douyin --wait --skill-name zlh-hot --ai-entry <ai-entry>                   # 只看抖音
node cli.js submit --wait --skill-name zlh-hot --ai-entry <ai-entry>                                  # 不指定平台 → 只取全站今日榜
node cli.js submit --board zhihu,douyin,bilibili|popular --wait --skill-name zlh-hot --ai-entry <ai-entry>  # 用户明确要多平台时，取这几个
node cli.js submit --board all --wait --skill-name zlh-hot --ai-entry <ai-entry>                      # 用户明说「所有平台」才用：36 主榜全量
node cli.js submit --board weibo|search --pages 2 --wait --skill-name zlh-hot --ai-entry <ai-entry>   # 该榜多翻 1 页
```

- `--board`：**填哪个平台就只取哪个平台**。单榜 `tab` / 子榜 `tab|sub` / 逗号分隔多榜 / `all`（全量，慎用）；不填或填了不认识的值 → 只取全站今日榜，不报错。
- `--pages`：每个榜的页数 1~3（每页 50 条），默认 1。
- 每次预扣 1 点；`--wait` 默认最多等待 120 秒（单榜实际 1 秒左右出结果）。
- 每次提交都是新任务并扣点；同一参数要再拿最新榜必须加 `--force`。
- 可选 `--interval <秒>`、`--timeout <秒>` 调整轮询。

成功结果示例（单榜，数组仅示意一条，实际返回完整榜单）：

```json
{"ok":true,"data":{"task_id":"t_20261112_ab12cd34","status":"done","success_count":1,
 "items":[{"id":"1","status":"success","result":{
  "mode":"single","board_count":1,"ok_board_count":1,"pages":1,
  "collected_count":30,"fetched_at":"2026-11-12 17:38:00",
  "boards":[{"tab":"zhihu","tab_name":"知乎","sub_tab":"","sub_name":"","count":30,"ok":1,"error":""}],
  "hot_list":[{"rank":1,"tab":"zhihu","tab_name":"知乎","sub_tab":"","sub_name":"",
   "title":"示例问题标题","hot_text":"4351万热度","hot_value":43510000,
   "url":"https://www.zhihu.com/question/2104132164308530649","mobile_url":"",
   "desc":"摘要文本","cover_url":"https://cdn.example.com/hot/cover/xxx.jpg",
   "author":"","author_url":"","is_video":0,"item_key":"e3f36f79e4b81d3d",
   "publish_time":""}]}}]}}
```

Agent 应读取 `data.items[0].result.hot_list` 整理结果：先按 `tab_name` 分组，组内按 `rank` 升序；如实汇报 `collected_count`，并检查 `boards` 里 `ok=0` 的榜（`error` 为原因），不要把这些榜说成"没热度"。

### query — 查询任务 / 拉取榜单

```bash
node cli.js query <task_id> --skill-name zlh-hot --ai-entry <ai-entry>
node cli.js query <task_id> --wait --skill-name zlh-hot --ai-entry <ai-entry>
```

### export — 导出 CSV

```bash
node cli.js export <task_id> --wait --out 全平台热榜.csv --skill-name zlh-hot --ai-entry <ai-entry>
```

CSV 带 BOM，Excel 可直接打开；三段结构：任务汇总 / 各榜单请求结果（含失败原因）/ 热榜明细（平台、子榜、排名、标题、热度、作者、链接、摘要、封面、发布时间）。

## 典型工作流

1. **先确定平台**：用户说了平台（"知乎热榜""微博热搜"）就直接 `--board <那个榜>`，只请求那一个榜。
2. 用户没说平台、只说"看看热榜" → 先问一句要哪个平台；用户不想选就 `submit --wait` 走默认的全站今日榜（1 个榜）。
3. 平台 key 对照：知乎 `zhihu`、微博热搜 `weibo|search`、百度热搜 `baidu|realtime`、抖音 `douyin`、小红书 `xiaohongshu|read-3d`、B站热门 `bilibili|popular`、头条 `toutiao`、36氪热榜 `36kr|hotlist`、虎扑步行街 `hupu|all-gambia`、雪球话题 `xueqiu|topic`；不确定先跑 `boards`。
4. 用户明确要多个平台 → `--board a,b|c` 一次取这些；**只有用户说"所有平台/全部榜单"才用 `--board all`**。
5. 解析 stdout JSON，按平台分组按 `rank` 返回；主动指出失败的榜。
6. 用户要文件时执行 `export <task_id> --wait --out <文件名>.csv`。

## 输出与错误

- 成功：`{"ok":true,"data":{...}}`；失败：`{"ok":false,"code":"...","message":"..."}`。
- 退出码：`0` 成功；`1` 参数错误；`2` 平台认证失败；`3` 点数不足；`4` 网络不可达；`5` 其它错误。
- `1002/1003`：重新执行平台 `login --link`，**不是让用户登录任何第三方平台**。
- `3001`：点数不足，提示充值，不要盲目重试。
- `status=failed`：读取 `fail_reason`（如"热榜数据源暂时不可用"）；服务侧失败会自动返还 1 点，可稍后重试。
- 请求的榜全部失败 → `status=failed` + 全额返还；部分失败 → `status=done`，看 `boards[].ok` 与 `error`。
- `TIMEOUT`：任务可能仍在执行，稍后 `query <task_id>`。
- `4290`：触发限流，稍后重试。

## 红线

- 仅提供各平台已公开的榜单排行数据，不绕过登录、验证码或访问控制。
- 热榜实时变化，结果以 `fetched_at` 时点为准；不要承诺每次一定成功。
- 热度值 `hot_value` 是从榜单展示文本（如 `"4285万热度"`）折算的近似整数，跨平台不可直接比较口径。
