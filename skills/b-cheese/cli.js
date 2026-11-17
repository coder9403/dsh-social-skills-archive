#!/usr/bin/env node
'use strict';
/** B站课堂（cheese / pugv）采集 CLI
 *  - home   首页两区块：新课推荐 16 门 + 排行榜 4 门，1 点/次
 *  - list   分类列表：30 门/页，单次最多 10 页，1 点/次（不按页）
 *  - detail 课程详情 + 完整课时目录，1 点/门
 *  全部由服务端直连 B 站公开接口（免登录、免签名），不依赖浏览器节点。 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ApiClient, BizError, allowInsecureTls, skillHeaders, warnSkillResponse } = require('./src/client');
const { loadConfig, saveConfig, resolveConfig, maskToken, configPaths, DEFAULT_BASE_URL } = require('./src/config');
const { UsageError, printOk, printFail, exitWithError, pollTask, parsePositiveNumber } = require('./src/output');
const { handleFatal } = require('./src/pay');

const SKILL_NAME = 'b-cheese';
const VERSION = '1.0.0';
const DEFAULT_PRICE = 1;
const DOWNLOAD_TIMEOUT_MS = 60000;
const MAX_PAGES = 10;
const MAX_URLS = 50;

const CAP_HOME = 'b_cheese_home';
const CAP_LIST = 'b_cheese_list';
const CAP_DETAIL = 'b_cheese_detail';

const VALUE_FLAGS = new Set(['yuan', 'channel', 'class', 'sub', 'sort', 'cond', 'type',
  'pages', 'url', 'file', 'interval', 'timeout', 'token', 'base-url', 'access-token',
  'out', 'skill-name', 'ai-entry']);
const BOOL_FLAGS = new Set(['wait', 'help', 'link', 'check', 'version']);

// 与服务端 b_cheese_list.SORT_TYPES / COND_TYPES / FILTER_TYPES 保持一致
const SORT_ALIAS = { totalrank: -1, sales: 1, newest: 2, cheapest: 3 };
const COND_ALIAS = { none: -1, live: 1, group: 2, finished: 3 };
const CTYPE_ALIAS = { none: -1, selected: 1, exclusive: 2 };
const SORT_LABELS = { totalrank: '综合排序', sales: '销量最高', newest: '最新上架', cheapest: '售价最低' };
const COND_LABELS = { none: '不限', live: '含直播课', group: '含课程群', finished: '已完结' };
const CTYPE_LABELS = { none: '不限', selected: '课堂臻选', exclusive: 'B站独家' };
// 大类（子类用数字 id，服务端还有完整白名单校验）
const CLASS_LABELS = {
  '-1': '全部分类', 95: '通识科普', 94: '兴趣生活', 93: '语言学习', 88: '考研',
  87: '考试·考证', 164: '影视·创作', 89: 'AI·互联网', 92: '职业职场', 181: '个人成长',
};

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

const USAGE = `B站课堂（cheese）采集 CLI —— 服务端直连B站公开接口，无需登录、无需节点

用法: node cli.js <命令> [参数]

命令:
  register --link                      生成注册二维码/链接（注册即送 10 点数）
  register --check --access-token <串>  完成注册后确认并保存 token
  login --link                         生成登录二维码/链接
  login --check --access-token <串>    完成授权后确认并保存 token
  home [--wait]                        采集首页两区块：新课推荐(16门) + 排行榜(4门)，1 点数/次
  list [--class ID] [--sub ID] [--sort S] [--cond C] [--type T] [--pages N] [--wait]
                                       采集分类列表，1 点数/次（不按页数）
                                       --class 一级分类: -1全部分类(默认) 95通识科普 94兴趣生活
                                                93语言学习 88考研 87考试·考证 164影视·创作
                                                89AI·互联网 92职业职场 181个人成长
                                       --sub 二级分类 id（如 106 考研/政治、105 考研/数学），选后覆盖 --class
                                       --sort totalrank=综合(默认) sales=销量 newest=最新 cheapest=售价最低
                                       --cond none=不限(默认) live=含直播课 group=含课程群 finished=已完结
                                       --type none=不限(默认) selected=课堂臻选 exclusive=B站独家
                                       --pages 采集页数，每页 30 门，1~${MAX_PAGES}，默认 1
  detail [--url U ...] [--file F] [--wait]
                                       采集课程详情 + 完整课时目录，1 点数/门（最多 ${MAX_URLS} 条）
                                       --url  /cheese/play/ss<id> 或 /cheese/play/ep<id>，可重复
                                       --file 每行一条链接的文本文件
  query <task_id> [--wait]             查询任务状态与完整结果
  export <task_id> [--wait] [--out <文件路径>]
                                       导出 CSV
  quota                                查询点数与个人信息
  pay [--yuan N]                       扫码充值点数（终端出二维码，付完自动继续）
  logout                               登出当前账号
  config set base-url <url>            设置后端服务地址
  config set insecure true|false       忽略 HTTPS 证书校验（自签证书时开）
  config show                          查看当前配置（token 脱敏）
  version                              显示版本

全局参数: --token <token>  --base-url <url>（默认 ${DEFAULT_BASE_URL}）
          --interval <秒> --timeout <秒>（等待任务时可用，默认 2 / 180）

AI 来源参数（所有 API 命令必填）: --skill-name ${SKILL_NAME} --ai-entry <AI工具标识>`;

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
      ? '需要先注册平台账号（注册即送 10 免费点数）。这不是B站登录，采集课堂课程不需要B站账号。请用手机扫码或打开链接注册：\n\n'
      : '需要登录平台账号。这不是B站登录，采集课堂课程不需要B站账号。请用手机扫码或打开链接登录：\n\n') +
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

async function fetchPrice(baseUrl, capability) {
  try {
    const data = await new ApiClient({ baseUrl }).request('GET', '/platform/capabilities');
    const cap = ((data && data.items) || []).find((c) => c.name === capability);
    return cap && Number(cap.price) > 0 ? Number(cap.price) : DEFAULT_PRICE;
  } catch { return DEFAULT_PRICE; }
}

async function waitTask(client, taskId, opts) {
  return pollTask(client, taskId, {
    intervalSec: parsePositiveNumber(opts.interval, 'interval', 2),
    timeoutSec: parsePositiveNumber(opts.timeout, 'timeout', 180),
  });
}

async function runSubmit(capability, items, idemSource, opts, notice) {
  const cfg = resolveConfig(opts);
  requireToken(cfg);
  const price = await fetchPrice(cfg.baseUrl, capability);
  const idempotencyKey = crypto.createHash('sha256').update(idemSource).digest('hex').slice(0, 32);
  process.stderr.write(`${notice}，共 ${items.length} 项，${price} 点数/项，失败全额返还\n`);
  const client = new ApiClient({ baseUrl: cfg.baseUrl, token: cfg.token });
  const data = await client.submitTask(capability, items, idempotencyKey, false);
  if (!opts.wait) { printOk({ ...data, estimated_points: price * items.length }); return; }
  const task = await waitTask(client, data.task_id, opts);
  const first = (task.items && task.items[0] && task.items[0].result) || {};
  process.stderr.write(`任务完成: status=${task.status}，采集 ${first.collected_count || 0} 条\n`);
  printOk(task);
}

async function cmdHome(opts) {
  await runSubmit(CAP_HOME, [{ id: 1, payload: {} }], 'bili-cheese|home',
    opts, '提交B站课堂首页采集（新课推荐 + 排行榜）');
}

async function cmdList(opts) {
  const sort = Object.prototype.hasOwnProperty.call(SORT_ALIAS, opts.sort) ? opts.sort : 'totalrank';
  const cond = Object.prototype.hasOwnProperty.call(COND_ALIAS, opts.cond) ? opts.cond : 'none';
  const ctype = Object.prototype.hasOwnProperty.call(CTYPE_ALIAS, opts.type) ? opts.type : 'none';
  const pages = Math.max(1, Math.min(parseInt(opts.pages, 10) || 1, MAX_PAGES));
  const category = String(opts.class || '-1');
  const sub = String(opts.sub || '-1');
  const payload = { category, sub_category: sub, sort, condition: cond,
    course_type: ctype, pages };
  const desc = `分类=${sub !== '-1' ? `子类${sub}` : (CLASS_LABELS[category] || category)} `
    + `排序=${SORT_LABELS[sort]} 条件=${COND_LABELS[cond]} 类型=${CTYPE_LABELS[ctype]} ${pages}页`;
  await runSubmit(CAP_LIST, [{ id: 1, payload }],
    `bili-cheese|list|${category}|${sub}|${sort}|${cond}|${ctype}|${pages}`,
    opts, `提交B站课堂分类列表采集（${desc}）`);
}

function parseCourseUrl(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return { season_id: s };
  let m = s.match(/\/cheese\/play\/ss(\d+)/i);
  if (m) return { season_id: m[1] };
  m = s.match(/\/cheese\/play\/ep(\d+)/i);
  if (m) return { ep_id: m[1] };
  return null;
}

function collectUrls(opts) {
  const urls = [];
  if (opts.url) urls.push(...[].concat(opts.url));
  if (opts.file) {
    const text = fs.readFileSync(opts.file, 'utf-8');
    urls.push(...text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  }
  return urls;
}

async function cmdDetail(opts) {
  const raw = collectUrls(opts);
  if (!raw.length) throw new UsageError('detail 需要 --url <课程链接>（可重复）或 --file <文件>');
  if (raw.length > MAX_URLS) throw new UsageError(`单次最多 ${MAX_URLS} 条课程链接，当前 ${raw.length} 条`);
  const items = [];
  const bad = [];
  raw.forEach((u, i) => {
    const parsed = parseCourseUrl(u);
    if (!parsed) { bad.push(u); return; }
    items.push({ id: items.length + 1, payload: { course_url: u } });
  });
  if (bad.length) {
    process.stderr.write(`[warn] 跳过 ${bad.length} 条无法识别的链接: ${bad.slice(0, 3).join(' , ')}\n`);
  }
  if (!items.length) {
    throw new UsageError('没有可用的课程链接（需 /cheese/play/ss<id> 或 /cheese/play/ep<id>）');
  }
  const idem = 'bili-cheese|detail|' + crypto.createHash('sha256')
    .update(items.map((it) => it.payload.course_url).join('\n')).digest('hex').slice(0, 16);
  await runSubmit(CAP_DETAIL, items, idem, opts,
    '提交B站课堂课程详情采集（详情 + 完整课时目录）');
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
  const out = opts.out || `${taskId}_b_cheese.csv`;
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
    printOk({ name: SKILL_NAME, version: VERSION,
      capabilities: [CAP_HOME, CAP_LIST, CAP_DETAIL] });
    return;
  }
  if (opts.help || !cmd) throw new UsageError('缺少命令');
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
    case 'home': return cmdHome(opts);
    case 'list': return cmdList(opts);
    case 'detail': return cmdDetail(opts);
    case 'query': return cmdQuery(args, opts);
    case 'export': return cmdExport(args, opts);
    case 'quota': return cmdQuota(opts);
    case 'pay': {
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
