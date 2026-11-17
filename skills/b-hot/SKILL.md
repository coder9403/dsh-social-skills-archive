---
name: b-hot
slug: b-hot-list
displayName: B站热门榜单采集
version: 1.0.0
description: B站热门页榜单采集工具。当用户需要获取B站（bilibili/哔哩哔哩）热门视频榜、综合热门、每周必看、入站必刷、全站排行榜及各分区排行（番剧/国创/动画/游戏/鬼畜/音乐/舞蹈/影视/娱乐/知识/科技数码/美食/汽车/时尚美妆/体育运动/动物等），或导出B站热榜 CSV，或提到"B站热门/B站热榜/哔哩哔哩热门/每周必看/入站必刷/B站排行榜/热门视频采集"时使用本 skill。全部榜单由内网浏览器节点在B站热门页上下文拦截接口采集（无需在服务端算 WBI 签名，也不要求用户提供B站账号），需节点在线。每次采集 1 点数，失败全额返还。
---

# B站热门榜单采集 Skill（b-hot）

## AI 调用来源参数（必填）

所有会访问后端 API 的命令必须携带 `--skill-name b-hot` 和 `--ai-entry <AI工具标识>`（例如 `claude-code`、`codex`、`workbuddy`）。IP 无需传递，由服务端自动获取。首次缺参会告警放行，第二次起拒绝。

示例：`node cli.js quota --skill-name b-hot --ai-entry claude-code`。

封装「社媒采集平台」（FastAPI，`/api/v1`）的零依赖 Node CLI。提交任务后返回 B 站热门榜单。

- **榜单选项**（`--board`）：`all`=综合热门（默认，无限滚动页，可加 `--pages N` 翻页，每页 20 条、上限 10 页）；`weekly`=每周必看（默认最新一期，可加 `--number N` 指定期数）；`history`=入站必刷（约 100 条）；`rank`=排行榜（可加 `--partition` 选分区）。
- **排行分区**（`--partition`，仅 `--board rank` 有效）：`all`=全部（默认）；UGC 分区 `douga`=动画、`game`=游戏、`kichiku`=鬼畜、`music`=音乐、`dance`=舞蹈、`cinephile`=影视、`ent`=娱乐、`knowledge`=知识、`tech`=科技数码、`food`=美食、`car`=汽车、`fashion`=时尚美妆、`sports`=体育运动、`animal`=动物；PGC 分区 `anime`=番剧、`guochuang`=国创、`documentary`=纪录片、`movie`=电影、`tv`=电视剧、`variety`=综艺（PGC 榜是剧集，无 bvid/互动数，链接为 bangumi 播放页）。
- **能采什么**：排名（`rank`）、BV号（`bvid`）、标题（`title`）、分区（`tname`）、UP主（`author`/`mid`）、播放（`view`）、弹幕（`danmaku`）、评论（`reply`）、收藏（`favorite`）、投币（`coin`）、分享（`share`）、点赞（`like`）、时长秒（`duration`）、发布时间戳（`pubdate`）、视频链接（`url`）。
- **采集方式**：全部榜单走**内网插件节点**（节点浏览器打开B站热门页、拦截接口响应），需节点在线，耗时约 1~2 分钟；不要求用户提供B站账号。
- **收费**：**每次采集 = 1 点数**，注册送 10 点；失败或零结果全额返还。
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
- **主动充值**：`node cli.js pay --yuan 50 --skill-name b-hot --ai-entry <ai-entry>`（不传 `--yuan` 默认 10 元；可加 `--channel alipay` 或 `--channel wechat`）。
- **不想自动充值**：设环境变量 `XHS_NO_AUTO_PAY=1`，则恢复旧行为（只提示点数不足）。
- 换算：**1 元 = 10 点**，注册送 10 点。

## 客服支持

- 客服微信（扫码添加）：http://st.aidata366.com/assets/concat.png
- 客服电话：**18722121663**

## 前置条件

采集由内网节点代采，不要求用户提供B站账号。平台任务接口需要平台账号和点数：

1. 首次使用执行 `node cli.js register --link --skill-name b-hot --ai-entry <ai-entry>`（新用户）或 `node cli.js login --link --skill-name b-hot --ai-entry <ai-entry>`（已有账号）。
2. 把 stderr 中的注册/登录引导**原样发给用户**；用户完成后执行对应的 `--check --access-token "<串>"`。
3. token 保存于 `~/.xhs-platform/config.json`，与其他社媒 skill 共用账号体系；不要泄露或提交 git。
4. 默认后端为 `http://st.aidata366.com`，可执行 `node cli.js config set base-url <url>` 修改。默认地址为明文 HTTP，token 会明文传输；条件允许时切换 HTTPS。

## 命令

### version / quota / logout / config

```bash
node cli.js version
node cli.js quota --skill-name b-hot --ai-entry <ai-entry>
node cli.js logout --skill-name b-hot --ai-entry <ai-entry>
node cli.js config show
node cli.js config set base-url http://127.0.0.1:8084
```

`version` 输出：

```json
{"ok":true,"data":{"name":"b-hot","version":"1.0.0","capability":"b_hot"}}
```

### submit — 采集热门榜单

```bash
node cli.js submit --wait --skill-name b-hot --ai-entry <ai-entry>                                    # 综合热门（默认, 首页 20 条）
node cli.js submit --board all --pages 3 --wait --skill-name b-hot --ai-entry <ai-entry>              # 综合热门翻 3 页（约 60 条）
node cli.js submit --board weekly --wait --skill-name b-hot --ai-entry <ai-entry>                     # 每周必看（最新一期）
node cli.js submit --board weekly --number 397 --wait --skill-name b-hot --ai-entry <ai-entry>        # 每周必看第 397 期
node cli.js submit --board history --wait --skill-name b-hot --ai-entry <ai-entry>                    # 入站必刷
node cli.js submit --board rank --wait --skill-name b-hot --ai-entry <ai-entry>                       # 排行榜-全部
node cli.js submit --board rank --partition game --wait --force --skill-name b-hot --ai-entry <ai-entry>  # 排行榜-游戏分区 + 已失效
```

- `--board`：`all`=综合热门（默认）/ `weekly`=每周必看 / `history`=入站必刷 / `rank`=排行榜；白名单外的值回落 `all`。
- `--pages`：仅综合热门有效，默认 1（每页 20 条，上限 10 页）。
- `--partition`：仅排行榜有效，见上方分区列表；白名单外的值回落 `all`。
- `--number`：仅每周必看有效，缺省采最新一期；指定期数不存在时报错返还点数。
- 每次预扣 1 点；`--wait` 默认最多等待 120 秒（节点采集较慢，可适当 `--timeout 180`）。
- 每次提交都是新任务并扣点；要拿最新榜单直接再提交一次即可（`--force` 已失效）。
- 可选 `--interval <秒>`、`--timeout <秒>` 调整轮询。

成功结果示例（数组仅示意一条，实际返回完整榜单）：

```json
{"ok":true,"data":{"task_id":"t_20261112_abc123","status":"done","success_count":1,
 "items":[{"id":"1","status":"success","result":{"board":"all","board_label":"综合热门",
 "collected_count":20,"fetched_at":"2026-11-12 15:30:00",
 "hot_list":[{"rank":1,"bvid":"BV1DJWy66EXr","aid":"117597043428825","title":"示例标题",
 "tname":"影视杂谈","author":"示例UP主","mid":"479820935","view":326964,"danmaku":1287,
 "reply":495,"favorite":3475,"coin":12964,"share":364,"like":17744,"duration":1856,
 "pubdate":1794391200,"url":"https://www.bilibili.com/video/BV1DJWy66EXr"}]}}]}}
```

Agent 应读取 `data.items[0].result.hot_list` 整理结果，并按 `collected_count` 如实汇报条数。

### query — 查询任务 / 拉取榜单

```bash
node cli.js query <task_id> --skill-name b-hot --ai-entry <ai-entry>
node cli.js query <task_id> --wait --skill-name b-hot --ai-entry <ai-entry>
```

### export — 导出 CSV

```bash
node cli.js export <task_id> --wait --out B站热榜.csv --skill-name b-hot --ai-entry <ai-entry>
```

CSV 带 BOM，Excel 可直接打开；包含任务汇总与榜单明细（排名、BV号、标题、分区、UP主、播放、弹幕、评论、收藏、投币、分享、点赞、时长、发布时间、链接）。

## 典型工作流

1. 用户要求B站热门/热榜时，直接执行 `node cli.js quota --skill-name b-hot --ai-entry <ai-entry>` 检查点数。
2. 执行 `node cli.js submit --wait --skill-name b-hot --ai-entry <ai-entry>`（按需求加 `--board/--pages/--partition/--number`）；需要最新榜单直接重提。
3. 解析 stdout JSON，将 `result.hot_list` 按 `rank` 返回给用户。
4. 用户需要文件时执行 `export <task_id> --wait --out <文件名>.csv`。

## 输出与错误

- 成功：`{"ok":true,"data":{...}}`；失败：`{"ok":false,"code":"...","message":"..."}`。
- 退出码：`0` 成功；`1` 参数错误；`2` 平台认证失败；`3` 点数不足；`4` 网络不可达；`5` 其它错误。
- `1002/1003`：重新执行平台 `login --link`，**不是让用户登录B站**。
- `3001`：点数不足，提示充值，不要盲目重试。
- `status=failed`：读取 `fail_reason`（如"节点不在线"）；服务侧失败会自动返还 1 点，可稍后重试。
- `TIMEOUT`：任务可能仍在执行，稍后 `query <task_id>`。
- `4290`：触发限流，稍后重试。

## 红线

- 仅采集公开榜单数据，不绕过登录、验证码或访问控制。
- 榜单实时变化，结果以 `fetched_at` 时点为准；不要承诺每次一定成功。
