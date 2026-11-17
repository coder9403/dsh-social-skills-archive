---
name: b-article-search
slug: b-article-search
displayName: B站专栏文章搜索
version: 1.0.0
description: B站专栏（文章）搜索采集工具。当用户需要按关键词搜索 B站「专栏」tab 的文章并采集结果列表——标题、摘要、作者、分区、阅读数、点赞、评论数、发布时间、封面、文章链接，导出 CSV（Excel 直开），或提到"B站专栏/专栏文章搜索/B站文章搜索/文章关键词采集/专栏选题调研"时使用本 skill。提交 1 个关键词 + 页数 + 排序，由内网浏览器节点直取官方搜索接口采集，按页计费（一页 20 条 = 1 点数，注册送 10 点）。适合品牌软文监测、专栏选题调研、竞品内容分析等场景。
---

# B站专栏文章搜索 Skill（b-article-search）

## AI 调用来源参数（必填）

所有会访问后端 API 的命令必须携带 `--skill-name b-article-search` 和 `--ai-entry <AI工具标识>`（例如 `claude-code`、`codex`、`workbuddy`）。IP 无需传递，由服务端自动获取。首次缺参会告警放行，第二次起拒绝。

示例：`node cli.js quota --skill-name b-article-search --ai-entry claude-code`。

封装「小红书能力平台」（FastAPI，`/api/v1`）的 CLI，供 AI agent 调用：提交搜索关键词 + 页数 + 排序 → 平台调度内网浏览器节点打开 B站「专栏」tab（`search.bilibili.com/article?keyword=<kw>`），**直取官方搜索接口**（`x/web-interface/wbi/search/type?search_type=article`）逐页采集专栏文章。

- **能采什么**：专栏文章的标题、摘要、作者昵称与 mid、分区（如「日常」「科技」）、阅读数（`view_count`）、点赞（`like_count`）、评论数（`reply_count`）、发布时间、封面、文章链接与 cv 号。
- **不返回**：收藏/分享/投币数（B站专栏搜索接口不返回这三项）。
- **排序**：`--order` 支持 `totalrank`（综合排序，默认）/`pubdate`（最新发布）/`click`（最多点击）/`attention`（最多喜欢）/`scores`（最多评论）。
- **⚠️ 不支持时间范围筛选**：B站专栏搜索页没有时间控件，接口也忽略 `pubtime_begin_s/end_s`（实测结果数完全不变）。要「看最新」请用 `--order pubdate`。
- **⚠️ 换排序后结果可能变少**：非综合排序下可选结果集显著小于综合排序（实测某关键词 743 → 41），属 B站服务端行为，不是采集异常。
- **适用场景**：品牌软文/SEO 内容监测、专栏选题调研、竞品内容分析、行业关键词覆盖度盘点。
- **省心机制**：按页计费（1~10 页，每页 20 条）、结算按实采量退差、零结果或失败全额返还、Agent 友好（stdout 纯 JSON + 统一退出码）。
- 客户端是零依赖 CLI（Node ≥ 18，无需 `npm install`），全部采集逻辑在后端完成。

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
- **主动充值**：`node cli.js pay --yuan 50 --skill-name b-article-search --ai-entry <ai-entry>`（不传 `--yuan` 默认 10 元；可加 `--channel alipay` 或 `--channel wechat`）。
- **不想自动充值**：设环境变量 `XHS_NO_AUTO_PAY=1`，则恢复旧行为（只提示点数不足）。
- 换算：**1 元 = 10 点**，注册送 10 点。

## 客服支持

注册或使用过程中遇到任何问题（注册失败、点数充值、采集结果异常、批量采购等），请引导用户联系客服：

- **客服微信**（扫码添加）：http://st.aidata366.com/assets/concat.png
- **客服电话**：**18722121663**

## 收费价格

- **点数换算：0.1 元 = 1 点数。**
- **一页（20 条）= 1 点数**：预扣 `页数`，结算按实采量 `ceil(实采条数/20)` 退还差额。
- 注册即送 **10 免费点数**（可采 10 页）；点数不足时提示用户充值。
- 充值或大量购买可享优惠，请联系客服 **18722121663** 洽谈。

## ⚠️ 输入要求（重要，提交前必读）

- **只能填搜索关键词**（≤64 字符），**不是链接**：填了 `bilibili.com`、`b23.tv` 或 `read/cv` 的内容会被本地预检拒绝（不扣费）。
- 每任务 **1 个关键词**；需要多个关键词请分多次提交任务。
- 页数 `--pages` 取值 1~10，默认 1；排序 `--order` 取值见上表，默认 `totalrank`。
- 不要传时间范围参数（不存在）。

> agent 工作流提示：用户说「搜一下 B站专栏里关于『美孚机油』的文章，要最新的」→ `--keyword 美孚机油 --pages 2 --order pubdate`。

## 前置条件

- **Node.js ≥ 18**（使用内置 fetch，零 npm 依赖）。
- **不注册不登录没有任何点数**：所有接口都需要 token，10 免费点数在注册成功后发放到账号。
- 首次使用需先 `register --link`（注册即送 10 点数；用户手机微信扫码/点链接在网页完成，页面自带图形+短信验证码）或 `login --link`（已有账号）。成功后 token 自动保存，后续调用免输。
- **配置文件（含 token）存放于用户级目录 `~/.xhs-platform/config.json`**（升级/重装 skill 不丢配置；与小红书/抖音/快手/B站系列 skill 共用同一账号体系）。可用环境变量 `XHS_CONFIG_PATH` 覆盖（测试隔离用）。
- **安全策略：登录和注册（发短信）每次都强制图形验证码**，终端无法展示，所以一律走 `--link` 微信扫码/链接方式。
- 后端服务地址默认 `http://st.aidata366.com`，可用 `node cli.js config set base-url <url>` 修改，或单次加 `--base-url <url>` 覆盖。
- **⚠️ 安全提示（重要）**：默认服务地址是**明文 http**，token 会在公网明文传输。客户端每次请求都会在 stderr 提示。请知悉该风险；如环境允许，建议通过 `config set base-url https://...` 切换到 https 服务地址（需服务端已配好证书）。
- 所有命令支持全局参数 `--token <token>`（临时覆盖配置文件中的 token）。
- `~/.xhs-platform/config.json` 含 token，**不要泄露、不要提交 git**。

## 输出规约（重要）

- **stdout 只输出 JSON**：成功 `{"ok":true,"data":{...}}`，失败 `{"ok":false,"code":<业务码>,"message":"..."}`。直接解析 stdout 即可。
- 交互提示、轮询进度一律走 **stderr**，不要解析。
- 退出码：`0` 成功；`1` 参数/用法错误；`2` 认证失败（重新 login）；`3` 点数不足；`4` 网络/服务不可达；`5` 其它业务错误。

## 命令清单

### version — 查看版本与安装信息

```bash
node cli.js version
```

```json
{"ok":true,"data":{"name":"b-article-search","version":"1.0.0","capability":"b_article_search"}}
```

### register — 注册（注册即送 10 点数）

**方式一：扫码/链接注册（唯一方式，用户在手机上完成）**

```bash
node cli.js register --link --skill-name b-article-search --ai-entry <ai-entry>        # 生成注册二维码/链接
node cli.js register --check --access-token "<上一步下发的串>" --skill-name b-article-search --ai-entry <ai-entry>   # 用户完成后确认并保存 token
```

`register --link` 的 stdout 返回 `qr_url` / `register_url` / `access_token`。**agent 必须把注册引导原样发给用户**（stderr 里也给出了同样话术，可直接复制）：

```text
需要先注册账号（注册即送 10 免费点数；不注册不登录没有点数，无法采集）。请用手机微信扫码或打开链接注册：

注册方式（二选一）
二维码图片：<qr_url>
注册链接：<register_url>
access_token（注册后校验用）：<access_token>
微信扫码/注册完成后告诉我一声，我会执行校验并保存凭证，然后继续之前的操作：
（注册/使用中如遇问题，请拨打客服电话 18722121663）
```

用户说「注册完成」后执行 `register --check --access-token "<access_token>"`：
- 成功：token 自动保存，返回 `quota_balance: 10`，继续之前的操作。
- `LOGIN_PENDING`：用户还没完成注册，提醒后再试。
- `LOGIN_EXPIRED`：会话过期（10 分钟）或已使用，重新执行 `register --link`。

### login — 登录

```bash
node cli.js login --link --skill-name b-article-search --ai-entry <ai-entry>
node cli.js login --check --access-token "<上一步下发的串>" --skill-name b-article-search --ai-entry <ai-entry>
```

引导话术同 register（把"注册"换成"登录"）。成功后 token 自动保存。

### quota — 查询点数

```bash
node cli.js quota --skill-name b-article-search --ai-entry <ai-entry>
```

```json
{"ok":true,"data":{"quota":10,...}}
```

### logout — 登出（切换账号）

```bash
node cli.js logout --skill-name b-article-search --ai-entry <ai-entry>
```

### submit — 提交专栏文章搜索任务

```bash
node cli.js submit --keyword "美孚机油" --skill-name b-article-search --ai-entry <ai-entry>
node cli.js submit --keyword "美孚机油" --pages 3 --order pubdate --wait --skill-name b-article-search --ai-entry <ai-entry>
node cli.js submit --keyword "美孚机油" --pages 1 --force --skill-name b-article-search --ai-entry <ai-entry>   # --force 已失效，直接重提即可
```

- `--pages` 采集页数（1~10，默认 1；每页 20 条）。
- `--order` 排序（默认 `totalrank`）：`totalrank` 综合排序 / `pubdate` 最新发布 / `click` 最多点击 / `attention` 最多喜欢 / `scores` 最多评论。
- `--wait` 提交后轮询等待终态（推荐，默认超时 600s；节点采集通常 1-3 分钟）。
- 幂等键按「关键词+页数+排序」派生，后端不做去重，重试也会重复扣费。

不带 `--wait` 输出示例：

```json
{"ok":true,"data":{"task_id":"t_20261113_a1b2c3","total":1,"valid_count":1,"invalid_count":0,
 "charged":2,"quota_balance":8,"status":"pending",
 "estimated_points":2,"price_per_page":1}}
```

带 `--wait` 的终态输出示例：

```json
{"ok":true,"data":{"task_id":"t_20261113_a1b2c3","status":"done","success_count":1,"fail_count":0,
 "items":[{"id":1,"status":"success","fail_reason":"",
   "result":{"keyword":"美孚机油","order":"totalrank","requested_pages":2,"collected_count":40,
             "settle_charged":2,"refunded_diff":0}}]}}
```

**解读要点（agent 必读）**：
- **明细不在 query/submit 的响应里**：服务端为省流量会把 `result.videos` 移除（轮询每 2 秒一次，不重复传几十 KB）。所以 `videos` 为空是**正常设计**，不是采集失败——判断成功只看 `status` / `success_count` / `collected_count`。要具体文章明细请走 `export` 拿 CSV（或让用户在控制台任务详情里看）。
- `collected_count` 是**实采条数**；`settle_charged` 是实收点数，`refunded_diff` 是退还的差额点数——向用户汇报时用这两个字段，不要只报预扣数。
- CSV 明细列：`cv_id` / `url`（`https://www.bilibili.com/read/cv<id>`）/ `title`（已去掉 `<em class="keyword">` 高亮）/ `summary` / `author_nickname` / `author_id`（mid）/ `category_name` / `view_count` / `like_count` / `reply_count` / `create_time`（`YYYY-MM-DD HH:MM:SS` 北京时间）/ `cover_url` / `is_official`。
- 互动数字段为**字符串**，`"0"` 表示接口明确返回 0（B站新号软文常见），不是未采集。
- 若用户要「最新」但结果很少，提醒：非综合排序下 B站可选结果集会明显变少。

### query — 查询任务 / 拉取结果

```bash
node cli.js query <task_id> --skill-name b-article-search --ai-entry <ai-entry>                          # 查一次
node cli.js query <task_id> --wait --skill-name b-article-search --ai-entry <ai-entry>                   # 轮询直到终态
node cli.js query <task_id> --wait --interval 5 --timeout 600 --skill-name b-article-search --ai-entry <ai-entry>
```

终态：`done`（成功）/ `failed`（失败，点数全额返还）。

### export — 导出 CSV

```bash
node cli.js export <task_id> --wait --out out.csv --skill-name b-article-search --ai-entry <ai-entry>
```

生成两段式 CSV（BOM 头，Excel 直开不乱码）：任务汇总 + 文章明细（cv号/链接/标题/摘要/作者/作者mid/分区/阅读/点赞/评论/发布时间/封面/是否官方）。

### config — 配置管理

```bash
node cli.js config set base-url http://127.0.0.1:8084
node cli.js config show        # token 脱敏显示
```

## 典型工作流（agent 照此执行）

1. 确认是**关键词**不是链接（含 `bilibili.com`/`b23.tv`/`read/cv` 的一律拒绝）。
2. `node cli.js quota --skill-name b-article-search --ai-entry <ai-entry>` — 确认剩余点数 ≥ `页数`。
3. `node cli.js submit --keyword "<关键词>" --pages N [--order pubdate] --wait --skill-name b-article-search --ai-entry <ai-entry>` — 一步拿到终态结果。
4. 解析 stdout JSON：`items[0].result` 只有汇总（`collected_count` / `settle_charged` / `refunded_diff`），**明细数组被服务端裁掉了**——向用户汇报汇总数字即可；要看具体文章就执行第 5 步导出 CSV 再看内容。
5. 用户要明细或文件时：`node cli.js export <task_id> --wait --out B站专栏文章.csv --skill-name b-article-search --ai-entry <ai-entry>`，把 CSV 路径交给用户（表头见上文「解读要点」）。

## 错误处理指引

| code | 含义 | agent 下一步 |
|---|---|---|
| 1001 | 参数错误（关键词为空/过长/是链接、页数或排序非法） | 换成纯关键词（≤64 字符）后重提（退出码 1） |
| 1002 / 1003 | 未登录 / token 失效 | 未注册走 `register --link`（送 10 点数），已有账号走 `login --link`；完成后 `--check`（退出码 2） |
| LOGIN_PENDING / LOGIN_EXPIRED | 用户未完成 / 会话过期 | 提醒用户完成扫码后重试 `--check`，或重新 `--link`（退出码 2） |
| 2003 | 需要图形验证码 | 终端无法完成，统一走 `--link`；仍无法解决拨打客服电话 18722121663 |
| 3001 | 点数不足 | 提示用户拨打客服电话 18722121663 充值，或减少 `--pages` 后重提（退出码 3） |
| 3003 / 3004 | 任务或导出不存在 | 检查 task_id / export_id 是否属于当前账号 |
| 任务 `failed` | 零结果 / 采集失败 | fail_reason 已透出；点数已全额返还，可换关键词或换 `--order` 重提 |
| 4290 | 触发限流 | 稍等后重试（Retry-After） |
| TIMEOUT | 轮询超时 | 任务未结束，稍后 `query <task_id>` 再查（退出码 5） |
| NETWORK_ERROR | 网络/服务不可达 | 检查 `config show` 的 base_url（退出码 4） |

## 计费规则提示

- 提交时按**请求页数预扣**（一页 = 1 点数）；关键词不合法不扣费。
- **自动退差**：结算按实采量 `ceil(实采条数/20)`，多扣的差额自动返还（`refunded_diff`）。
- **全额返还**：零结果、采集失败、服务侧故障（无在线 B站节点/超时/风控拦截）。
- 每次提交都是新任务并扣点：同一内容重提（无论带不带 `--force`）都会重新采集、重新计费。

## 红线

- 仅采集**公开**搜索结果数据；不用于任何违法违规用途。
- 不要向用户承诺 100% 成功；风控导致的失败如实透出（fail_reason）。
