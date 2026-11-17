#!/usr/bin/env node
'use strict';
/** 全平台热榜采集 CLI：服务端已聚合各平台公开榜单，
 *  无插件/无节点/无登录态；每次提交 1 点数，失败全额返还。 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ApiClient, BizError, allowInsecureTls, skillHeaders, warnSkillResponse } = require('./src/client');
const { loadConfig, saveConfig, resolveConfig, maskToken, configPaths, DEFAULT_BASE_URL } = require('./src/config');
const { UsageError, printOk, printFail, exitWithError, pollTask, parsePositiveNumber } = require('./src/output');
const { handleFatal } = require('./src/pay');

const CAPABILITY = 'rebang_hot';
const VERSION = '1.1.0';
const DEFAULT_PRICE = 1;
const MAX_PAGES = 3;
const DOWNLOAD_TIMEOUT_MS = 60000;
const VALUE_FLAGS = new Set(['yuan', 'channel', 'board', 'pages', 'interval', 'timeout', 'token', 'base-url', 'access-token', 'out', 'skill-name', 'ai-entry']);
const BOOL_FLAGS = new Set(['wait', 'help', 'link', 'check', 'force', 'version']);

// 榜单目录（与服务端 app/capabilities/rebang_hot.py 的 CATALOG 逐项一致；
// 报表下拉 96 项 = 36 个主榜 + 59 个子榜 + 全平台（列在末尾）
const BOARDS = {
  top: ['全站', [['today', '今日'], ['weekly', '本周'], ['monthly', '本月']]],
  zhihu: ['知乎', []],
  weibo: ['微博', [['search', '热搜'], ['ent', '文娱']]],
  ithome: ['IT之家', [['today', '日榜'], ['latest', '最新'], ['weekly', '周榜'], ['monthly', '月榜']]],
  hupu: ['虎扑', [['all-gambia', '步行街'], ['all-nba', 'NBA'], ['all-gg', '游戏'], ['all-digital', '数码'], ['all-ent', '影视娱乐'], ['all-soccer', '国际足球']]],
  'tencent-news': ['腾讯新闻', []],
  'douban-community': ['豆瓣社区', [['discussion', '精选讨论'], ['topic', '热门话题'], ['group', '发现小组']]],
  huxiu: ['虎嗅', [['hot', '热文'], ['latest', '最新'], ['event', '号外']]],
  sspai: ['少数派', [['recommend', '推荐'], ['hottest', '最热']]],
  thepaper: ['澎湃新闻', [['hot', '热榜']]],
  'ifeng-news': ['凤凰新闻', [['hot', '热榜']]],
  xiaohongshu: ['小红书', [['read-3d', '阅读榜'], ['like-3d', '点赞榜'], ['collect-3d', '收藏榜']]],
  '36kr': ['36氪', [['hotlist', '热榜'], ['latest', '最新'], ['newsflashes', '快讯']]],
  toutiao: ['今日头条', []],
  ifanr: ['爱范儿', []],
  'douban-media': ['豆瓣书影音', [['movie', '电影'], ['tv', '电视'], ['book', '读书'], ['music', '音乐']]],
  penti: ['喷嚏网', [['tugua', '喷嚏图卦'], ['fushihui', '浮世汇'], ['lehuo', '乐活'], ['caijing', '财经风云'], ['leying', '乐影'], ['shijieguan', '世界观']]],
  baidu: ['百度', [['realtime', '热搜'], ['novel', '小说'], ['movie', '电影'], ['teleplay', '电视剧']]],
  'ne-news': ['网易新闻', [['htd', '热议榜'], ['news', '新闻榜'], ['video', '视频榜']]],
  weread: ['微信读书', [['rising', '飙升榜'], ['newbook', '新书榜'], ['general_novel_rising', '小说榜'], ['all', '总榜'], ['newrating_publish', '神作榜'], ['newrating_potential_publish', '神作潜力榜'], ['hot_search', '热搜榜']]],
  'zhihu-daily': ['知乎日报', []],
  '360-hot-search': ['360热搜', [['hot', '热搜榜']]],
  'baidu-tieba': ['百度贴吧', [['topic', '热门话题']]],
  'guancha-user': ['观风闻', [['hot-3', '24小时'], ['hot-6', '3天'], ['hot-7', '7天'], ['hot-8', '3个月']]],
  '52pojie': ['吾爱破解', [['today', '今日'], ['thisweek', '本周'], ['thismonth', '本月']]],
  tonghuashun: ['同花顺', [['toutiao', '头条']]],
  xueqiu: ['雪球', [['topic', '话题'], ['news', '新闻'], ['notice', '公告']]],
  landian: ['蓝点网', [['article', '文章'], ['download', '下载']]],
  appinn: ['小众软件', []],
  zhibo8: ['直播吧', []],
  douyin: ['抖音', []],
  bilibili: ['哔哩哔哩', [['popular', '热门'], ['weekly', '每周必看'], ['rank', '排行榜']]],
  iqiyi: ['爱奇艺', [['hot', '热播榜'], ['rising', '飙升榜']]],
  xmyp: ['小米有品', [['zhongchou', '众筹']]],
  gamersky: ['游民星空', [['rec', '今日推荐'], ['spg', '单机电玩'], ['ns', 'NS'], ['mobile', '手游'], ['online', '网游'], ['industry', '业界'], ['hardware', '硬件'], ['tech', '科技']]],
  oschina: ['开源中国', [['recommend', '推荐'], ['weekly', '周榜'], ['monthly', '月榜']]],
};

function boardOptions() {
  const out = [];
  for (const [tab, [name, subs]] of Object.entries(BOARDS)) {
    if (!subs.length) { out.push({ value: tab, label: name }); continue; }
    for (const [sub, subName] of subs) out.push({ value: `${tab}|${sub}`, label: `${name} · ${subName}` });
  }
  out.push({ value: 'all', label: `全平台（${Object.keys(BOARDS).length} 个主榜全量，请求较多）` });
  return out;
}

function camel(s) { return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

function parseArgs(argv) {
  const opts = {}, positional = [];
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    if (!arg.startsWith('-')) { positional.push(arg); continue; }
    if (!arg.startsWith('--')) throw new UsageError(`未知参数: ${arg}`);
    let inline;
    const eq = arg.indexOf('=');
    if (eq > 2) { inline = arg.slice(eq + 1); arg = arg.slice(0, eq); }
    const name = arg.slice(2);
    if (VALUE_FLAGS.has(name)) {
      const value = inline !== undefined ? inline : argv[++i];
      if (value === undefined) throw new UsageError(`缺少参数值: ${arg}`);
      opts[camel(name)] = value;
    } else if (BOOL_FLAGS.has(name)) {
      if (inline !== undefined) throw new UsageError(`参数 ${arg} 不接受值`);
      opts[camel(name)] = true;
    } else throw new UsageError(`未知参数: ${arg}`);
  }
  return { cmd: positional.shift() || '', args: positional, opts };
}

const USAGE = `全平台热榜采集 CLI（36 个平台 / 95 个榜单）

用法: node cli.js <命令> [参数]

命令:
  register --link                     生成注册二维码/链接（注册即送 10 点数）
  register --check --access-token <串> 完成注册后确认并保存 token
  login --link                        生成登录二维码/链接
  login --check --access-token <串>   完成授权后确认并保存 token
  submit [--board B] [--pages N] [--wait] [--force]
                                      提交一次热榜采集（每次 1 点数）
                                      --board: 要看哪个平台就填哪个，只请求这一个榜
                                               单榜 tab (zhihu)、子榜 tab|sub (weibo|search)
                                               多榜逗号分隔 (zhihu,weibo|search,douyin)
                                               all=全平台 36 个主榜（需全量时显式指定）
                                               不填=只取全站今日榜（1 个榜）
                                      --pages: 每榜页数 1-${MAX_PAGES}（每页 50 条，默认 1）
                                      --force 已失效（重提即重新采集最新榜单）
  boards                              列出全部可选榜单（value/label）
  query <task_id> [--wait]            查询任务状态与完整热榜
  export <task_id> [--wait] [--out <文件路径>]
                                      导出 CSV（榜单汇总 + 各榜请求结果 + 明细）
  quota                               查询点数与个人信息
  pay                               扫码充值点数（终端出二维码，付完自动继续）
  logout                              登出当前账号
  config set base-url <url>           设置后端服务地址
  config set insecure true|false      忽略 HTTPS 证书校验（自签证书时开）
  config show                         查看当前配置（token 脱敏）
  version                             显示版本

全局参数: --token <token>  --base-url <url>（默认 ${DEFAULT_BASE_URL}）
          --interval <秒> --timeout <秒>（等待任务时可用，默认 2 / 120）

AI 来源参数（所有 API 命令必填）: --skill-name <本Skill名> --ai-entry <AI工具标识>`;

function requireToken(cfg) {
  if (!cfg.token) throw new BizError(1002, '未登录：缺少 token');
}

async function cmdSessionLink(cfg, scene) {
  const client = new ApiClient({ baseUrl: cfg.baseUrl });
  const data = await client.createCliSession();
  const isRegister = scene === 'register';
  const pageUrl = cfg.baseUrl + (isRegister ? data.register_path : data.login_path);
  const qrUrl = cfg.baseUrl + (isRegister ? data.register_qr_path : data.qr_path);
  const action = isRegister ? '注册' : '登录';
  process.stderr.write(
    `请把下面这段${action}引导原样发给用户：\n----\n` +
    (isRegister
      ? '需要先注册平台账号（注册即送 10 免费点数）。这不是任何平台的账号登录，采集公开热榜不需要平台账号。请用手机扫码或打开链接注册：\n\n'
      : '需要登录平台账号。采集公开热榜不需要各平台账号。请用手机扫码或打开链接登录：\n\n') +
    `${action}方式（二选一）\n二维码图片：${qrUrl}\n${action}链接：${pageUrl}\n` +
    `access_token（${action}后校验用）：${data.access_token}\n` +
    `扫码/${action}完成后告诉我一声，我会执行校验并保存凭证：\n\n` +
    `node cli.js ${scene} --check --access-token "${data.access_token}"\n----\n`);
  printOk({ qr_url: qrUrl, [isRegister ? 'register_url' : 'login_url']: pageUrl,
    access_token: data.access_token, expires_in: data.expires_in });
}

async function cmdSessionCheck(cfg, opts, scene) {
  const action = scene === 'register' ? '注册' : '登录';
  if (!opts.accessToken || !/^[0-9a-f]{16,64}$/.test(opts.accessToken)) {
    throw new UsageError(`${scene} --check 需要 --access-token（--link 下发的十六进制串）`);
  }
  const client = new ApiClient({ baseUrl: cfg.baseUrl });
  const data = await client.checkCliSession(opts.accessToken);
  if (data.status === 'pending') {
    printFail('LOGIN_PENDING', `用户尚未完成${action}，请提醒用户完成后再试`);
    process.exit(2);
  }
  if (data.status !== 'ready' || !data.token) {
    printFail('LOGIN_EXPIRED', `${action}会话已过期或已使用，请重新执行 ${scene} --link`);
    process.exit(2);
  }
  saveConfig({ base_url: cfg.baseUrl, token: data.token });
  process.stderr.write(`${action}成功，token 已保存到配置文件\n`);
  printOk({ phone: data.phone, quota_balance: data.quota_balance });
}

async function fetchPrice(baseUrl) {
  try {
    const data = await new ApiClient({ baseUrl }).request('GET', '/platform/capabilities');
    const cap = ((data && data.items) || []).find((c) => c.name === CAPABILITY);
    return cap && Number(cap.price) > 0 ? Number(cap.price) : DEFAULT_PRICE;
  } catch { return DEFAULT_PRICE; }
}

async function waitTask(client, taskId, opts) {
  return pollTask(client, taskId, {
    intervalSec: parsePositiveNumber(opts.interval, 'interval', 2),
    timeoutSec: parsePositiveNumber(opts.timeout, 'timeout', 120),
  });
}

function normalizeBoard(raw) {
  // 不传 --board 时交给服务端回落到「全站今日榜」单榜，不再默认拉全平台
  return String(raw || '').trim();
}

async function cmdSubmit(opts) {
  const cfg = resolveConfig(opts);
  requireToken(cfg);
  const board = normalizeBoard(opts.board);
  let pages = 1;
  if (opts.pages !== undefined) {
    pages = parsePositiveNumber(opts.pages, 'pages', 1);
    if (pages < 1 || pages > MAX_PAGES) throw new UsageError(`pages 取值范围 1-${MAX_PAGES}`);
  }
  const price = await fetchPrice(cfg.baseUrl);
  const payload = { board, pages };
  const idempotencyKey = crypto.createHash('sha256')
    .update('zlh-hot|' + board + '|' + pages + (opts.force ? `|${Date.now()}` : ''))
    .digest('hex').slice(0, 32);
  process.stderr.write(`提交热榜采集：榜单=${board || '全站今日榜(默认)'}，每榜 ${pages} 页，`
    + `${price} 点数/次，失败全额返还；服务端已聚合，无需登录态\n`);
  const client = new ApiClient({ baseUrl: cfg.baseUrl, token: cfg.token });
  const data = await client.submitTask(CAPABILITY, [{ id: 1, payload }], idempotencyKey, !!opts.force);
  if (!opts.wait) { printOk({ ...data, estimated_points: price }); return; }
  const task = await waitTask(client, data.task_id, opts);
  const result = task.items && task.items[0] && task.items[0].result;
  process.stderr.write(`任务完成: status=${task.status}，采集 ${(result && result.collected_count) || 0} 条，`
    + `榜单 ${(result && result.ok_board_count) || 0}/${(result && result.board_count) || 0} 个成功\n`);
  printOk(task);
}

async function cmdQuery(args, opts) {
  if (!args[0]) throw new UsageError('query 需要 task_id 参数');
  const cfg = resolveConfig(opts);
  requireToken(cfg);
  const client = new ApiClient({ baseUrl: cfg.baseUrl, token: cfg.token });
  printOk(opts.wait ? await waitTask(client, args[0], opts) : await client.getTask(args[0]));
}

async function cmdExport(args, opts) {
  const taskId = args[0];
  if (!taskId) throw new UsageError('export 需要 task_id 参数');
  const cfg = resolveConfig(opts);
  requireToken(cfg);
  const client = new ApiClient({ baseUrl: cfg.baseUrl, token: cfg.token });
  if (opts.wait) await waitTask(client, taskId, opts);
  const created = await client.createExport(taskId);
  if (!opts.wait) { printOk(created); return; }
  const deadline = Date.now() + 120000;
  let info;
  for (;;) {
    info = await client.getExport(created.export_id);
    if (info.status !== 'pending' && info.status !== 'running') break;
    if (Date.now() + 1000 > deadline) {
      printFail('TIMEOUT', '等待导出超时，可稍后重试');
      process.exit(5);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (info.status !== 'done') {
    printFail('EXPORT_FAILED', `导出未完成 (status=${info.status})`);
    process.exit(5);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
  let buf;
  try {
    const res = await fetch(`${cfg.baseUrl}/api/v1/platform/exports/${encodeURIComponent(info.export_id)}/file`,
      { headers: { Authorization: `Bearer ${cfg.token}`, ...skillHeaders() }, signal: ctrl.signal });
    warnSkillResponse(res);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    printFail('EXPORT_FAILED', `下载失败: ${err.message || err}`);
    process.exit(5);
  } finally { clearTimeout(timer); }
  const out = opts.out || `${taskId}_zlh_hot.csv`;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  if (fs.existsSync(out)) process.stderr.write(`[warn] 目标文件已存在，将覆盖: ${out}\n`);
  fs.writeFileSync(out, buf);
  printOk({ export_id: info.export_id, file: out, size: buf.length });
}

async function cmdQuota(opts) {
  const cfg = resolveConfig(opts);
  requireToken(cfg);
  printOk(await new ApiClient({ baseUrl: cfg.baseUrl, token: cfg.token }).profile());
}

async function cmdLogout(opts) {
  const cfg = resolveConfig(opts);
  if (!cfg.token) throw new BizError(1002, '未登录：本地没有已保存的 token');
  try { await new ApiClient({ baseUrl: cfg.baseUrl, token: cfg.token }).logout(); }
  catch (err) { process.stderr.write(`服务端登出异常（已忽略）: ${err.message}\n`); }
  saveConfig({ token: '' });
  printOk({ logged_out: true });
}

async function cmdConfig(args, opts) {
  if (args[0] === 'set' && args[1] === 'base-url') {
    const url = args[2];
    if (!url || !/^https?:\/\//.test(url)) throw new UsageError('base-url 需要 http(s):// 开头的地址');
    saveConfig({ base_url: url.replace(/\/+$/, '') });
    printOk({ base_url: loadConfig().base_url });
    return;
  }
  if (args[0] === 'set' && args[1] === 'insecure') {
    if (!['true', 'false'].includes(args[2])) throw new UsageError('insecure 需要 true 或 false');
    saveConfig({ insecure: args[2] === 'true' });
    printOk({ insecure: loadConfig().insecure === true });
    return;
  }
  if (args[0] === 'show') {
    const cfg = resolveConfig(opts);
    printOk({ base_url: cfg.baseUrl, insecure: cfg.insecure, token: maskToken(cfg.token),
      config_path: configPaths.configPath });
    return;
  }
  throw new UsageError('config 仅支持 set base-url / set insecure / show');
}

async function main() {
  const { cmd, args, opts } = parseArgs(process.argv.slice(2));
  if (opts.version || cmd === 'version') {
    printOk({ name: 'zlh-hot', version: VERSION, capability: CAPABILITY });
    return;
  }
  if (opts.help) { process.stderr.write(USAGE + '\n'); return; }
  if (cmd === 'boards') { printOk({ total: boardOptions().length, boards: boardOptions() }); return; }
  if (!cmd) throw new UsageError('缺少命令');
  if (resolveConfig(opts).insecure) allowInsecureTls();
  switch (cmd) {
    case 'register':
      if (opts.link) return cmdSessionLink(resolveConfig(opts), 'register');
      if (opts.check) return cmdSessionCheck(resolveConfig(opts), opts, 'register');
      throw new UsageError('register 仅支持 --link / --check');
    case 'login':
      if (opts.link) return cmdSessionLink(resolveConfig(opts), 'login');
      if (opts.check) return cmdSessionCheck(resolveConfig(opts), opts, 'login');
      throw new UsageError('login 仅支持 --link / --check');
    case 'submit': return cmdSubmit(opts);
    case 'query': return cmdQuery(args, opts);
    case 'export': return cmdExport(args, opts);
    case 'quota': return cmdQuota(opts);
    case 'pay': {
      // 主动充值: 建单 → 终端二维码 → (交互)等到账
      const { rechargeFlow } = require('./src/pay');
      const res = await rechargeFlow({ yuan: opts.yuan, channel: opts.channel });
      return printOk({
        order_no: res.order.order_no, points: res.order.points,
        status: res.order.status, paid: !res.pending, pay_url: res.payUrl,
      });
    }
    case 'logout': return cmdLogout(opts);
    case 'config': return cmdConfig(args, opts);
    default: throw new UsageError(`未知命令: ${cmd}`);
  }
}

main().catch((e) => handleFatal(e, main, { usage: USAGE }));
