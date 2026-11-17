---
name: wb-hot-list
slug: wb-hot-list-weibo
displayName: 微博热门榜单采集
version: 1.0.0
description: 微博「热门榜单」采集工具。当用户需要采集微博热门榜单（小时榜/昨日/前日/周榜/男榜/女榜）的上榜微博列表（正文/互动数/作者/链接），或导出榜单 CSV，或提到"微博热门榜单/微博小时榜/微博周榜/男榜女榜"时使用本 skill。采集走内网浏览器节点（微博榜单接口需登录态），需节点在线；每 10 条 1 点数，按实采退差，失败全额返还。只要热搜词条榜请用 wb-hot skill。
---

# 微博热门榜单采集 Skill（wb-hot-list）

## AI 调用来源参数（必填）

所有会访问后端 API 的命令必须携带 `--skill-name wb-hot-list` 和 `--ai-entry <AI工具标识>`（例如 `claude-code`、`codex`、`workbuddy`）。IP 无需传递，由服务端自动获取。首次缺参会告警放行，第二次起拒绝。

示例：`node cli.js quota --skill-name wb-hot-list --ai-entry claude-code`。

封装「社媒采集平台」（FastAPI，`/api/v1`）的零依赖 Node CLI。提交任务后，平台调度**内网浏览器节点**（已登录微博的采集节点）在微博热门榜单页上下文直取官方接口，按 `max_id` 游标翻页采集上榜微博。

- **能采什么**：上榜微博正文（`text`）、转发/评论/点赞数、作者昵称与 ID、发布时间、封面图、微博链接，是否转发及原微博信息。
- **榜单选项**（`--board`）：`hour`=小时榜（默认）、`yesterday`=昨日、`before_yesterday`=前日、`week`=周榜、`male`=男榜、`female`=女榜。
- **采集数量**（`--count`）：1~100 条，默认 10 条；榜单本身深度有限，采到榜尾自动停止。
- **收费**：**每 10 条 = 1 点数**，预扣 ceil(条数/10)、结算按实采量退差（零头按一次计），注册送 10 点；零结果或失败全额返还。
- **依赖节点**：微博榜单接口未登录不返回数据，采集必须走登录态节点；节点不在线时任务会等待直至超时返还。
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
- **主动充值**：`node cli.js pay --yuan 50 --skill-name wb-hot-list --ai-entry <ai-entry>`（不传 `--yuan` 默认 10 元；可加 `--channel alipay` 或 `--channel wechat`，此处 `--channel` 指支付渠道）。
- **不想自动充值**：设环境变量 `XHS_NO_AUTO_PAY=1`，则恢复旧行为（只提示点数不足）。
- 换算：**1 元 = 10 点**，注册送 10 点。

## 客服支持

- 客服微信（扫码添加）：http://st.aidata366.com/assets/concat.png
- 客服电话：**18722121663**

## 前置条件

1. 首次使用执行 `node cli.js register --link --skill-name wb-hot-list --ai-entry <ai-entry>`（新用户）或 `node cli.js login --link --skill-name wb-hot-list --ai-entry <ai-entry>`（已有账号）。
2. 把 stderr 中的注册/登录引导**原样发给用户**；用户完成后执行对应的 `--check --access-token "<串>"`。
3. token 保存于 `~/.xhs-platform/config.json`，与其他社媒 skill 共用账号体系；不要泄露或提交 git。
4. 默认后端为 `http://st.aidata366.com`，可执行 `node cli.js config set base-url <url>` 修改。默认地址为明文 HTTP，token 会明文传输；条件允许时切换 HTTPS。

## 命令

### version / quota / logout / config

```bash
node cli.js version
node cli.js quota --skill-name wb-hot-list --ai-entry <ai-entry>
node cli.js logout --skill-name wb-hot-list --ai-entry <ai-entry>
node cli.js config show
node cli.js config set base-url http://127.0.0.1:8084
```

`version` 输出：

```json
{"ok":true,"data":{"name":"wb-hot-list","version":"1.0.0","capability":"wb_hot_list"}}
```

### submit — 采集热门榜单

```bash
node cli.js submit --wait --skill-name wb-hot-list --ai-entry <ai-entry>                           # 小时榜 10 条
node cli.js submit --board week --count 30 --wait --skill-name wb-hot-list --ai-entry <ai-entry>   # 周榜 30 条
node cli.js submit --board female --count 50 --wait --force --skill-name wb-hot-list --ai-entry <ai-entry>
```

- `--board`：`hour`=小时榜（默认）/ `yesterday`=昨日 / `before_yesterday`=前日 / `week`=周榜 / `male`=男榜 / `female`=女榜；白名单外的值回落 `hour`。
- `--count`：1~100 条，默认 10；预扣 ceil(count/10) 点，按实采退差。
- 每次提交都是新任务并扣点；需要重新采集最新榜单时使用 `--force`。
- `--wait` 默认最多等待 600 秒；可选 `--interval <秒>`、`--timeout <秒>` 调整轮询。

成功结果示例（数组仅示意一条）：

```json
{"ok":true,"data":{"task_id":"t_20261112_xxx","status":"done","success_count":1,
 "items":[{"id":"1","status":"success","result":{"board":"hour","requested_count":10,
 "collected_count":10,"settle_charged":1,"refunded_diff":0,
 "videos":[{"post_id":"5364024939381553","bid":"RqRA1Dmzn","title":"示例正文",
 "share_count":"54","comment_count":"908","like_count":"10234",
 "author_nickname":"示例作者","create_time":"2026-11-11 11:11:07",
 "url":"https://weibo.com/7646393680/RqRA1Dmzn"}]}}]}}
```

Agent 应读取 `data.items[0].result.videos` 整理结果，并按 `collected_count` 如实汇报条数；`settle_charged`/`refunded_diff` 如实告知用户实收与退差点数。

### query — 查询任务 / 拉取结果

```bash
node cli.js query <task_id> --skill-name wb-hot-list --ai-entry <ai-entry>
node cli.js query <task_id> --wait --skill-name wb-hot-list --ai-entry <ai-entry>
```

### export — 导出 CSV

```bash
node cli.js export <task_id> --wait --out 微博热门榜单.csv --skill-name wb-hot-list --ai-entry <ai-entry>
```

CSV 带 BOM，Excel 可直接打开；包含任务汇总与微博明细（榜单、排名、正文、互动数、作者、时间、链接）。

## 典型工作流

1. 用户要求采集微博热门榜单时，先执行 `node cli.js quota --skill-name wb-hot-list --ai-entry <ai-entry>` 检查点数。
2. 执行 `node cli.js submit --board hour --count 30 --wait --skill-name wb-hot-list --ai-entry <ai-entry>`；需要最新数据直接重提。
3. 解析 stdout JSON，将 `result.videos` 按顺序返回给用户。
4. 用户需要文件时执行 `export <task_id> --wait --out <文件名>.csv`。

## 输出与错误

- 成功：`{"ok":true,"data":{...}}`；失败：`{"ok":false,"code":"...","message":"..."}`。
- 退出码：`0` 成功；`1` 参数错误；`2` 平台认证失败；`3` 点数不足；`4` 网络不可达；`5` 其它错误。
- `1002/1003`：重新执行平台 `login --link`，**不是让用户登录微博**。
- `3001`：点数不足，提示充值，不要盲目重试。
- `status=failed`：读取 `fail_reason`；常见原因：无在线微博采集节点、节点微博登录态失效（需在节点浏览器重新登录微博）、触发风控。服务侧失败会自动返还点数，可稍后重试。
- `TIMEOUT`：任务可能仍在执行，稍后 `query <task_id>`。
- `4290`：触发限流，稍后重试。

## 红线

- 仅采集公开榜单内容，不绕过登录、验证码或访问控制。
- 榜单按周期更新，结果以 `fetched_at` 时点为准；不要承诺每次一定成功。
