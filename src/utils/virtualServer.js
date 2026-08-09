/**
 * 虚拟服务器指标生成模块
 *
 * 通过 seededRandom + 多频率正弦波叠加算法，
 * 生成与真实服务器几乎无差别的动态指标数据。
 */

// ─── 基础工具 ───────────────────────────────────────

/**
 * 将服务器 ID 哈希为 32 位整数种子
 * @param {string} str
 * @returns {number}
 */
function hashSeed(str) {
  let hash = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

/**
 * 线性同余生成器（LCG），可种子化的伪随机数
 * @param {number} seed
 * @returns {function(): number} 返回 0..1 的随机数
 */
function seededRandom(seed) {
  let state = seed | 0;
  return function () {
    state = (state * 1664525 + 1013904223) | 0;
    return ((state >>> 0) % 100000) / 100000;
  };
}

/**
 * 把值限制在 [min, max] 区间
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 把角度转弧度
 */
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * 在 [min, max] 之间做线性插值
 */
function lerp(min, max, t) {
  return min + (max - min) * t;
}

// ─── 配置解析 ───────────────────────────────────────

/**
 * 默认虚拟服务器配置（所有字段都有合理默认值，
 * 即使 virtual_config 为空也能正常工作）
 */
const DEFAULT_CONFIG = {
  os: 'Ubuntu 22.04 LTS',
  arch: 'x86_64',
  cpu_cores: 2,
  cpu_info: 'Intel Xeon E5-2680 v4 @ 2.40GHz',
  kernel_version: '5.15.0-91-generic',
  agent_version: '1.0.0',
  ram_total: 2048,       // MB
  disk_total: 20,       // GB
  swap_total: 512,      // MB
  cpu_min: 3,
  cpu_max: 25,
  ram_usage_min: 25,
  ram_usage_max: 55,
  disk_usage: 45,
  net_in_min: 1024,     // B/s
  net_in_max: 524288,   // 512 KB/s
  net_out_min: 512,     // B/s
  net_out_max: 262144,  // 256 KB/s
  ping_ct: 5,
  ping_cu: 10,
  ping_cm: 15,
  ping_bd: 20,
  processes: 85,
  tcp_conn: 30,
  udp_conn: 5,
  ip_v4: '1',
  ip_v6: '0',
  boot_time: '',
  net_rx: 1073741824,   // 1 GB
  net_tx: 536870912     // 512 MB
};

/**
 * 解析服务器上的 virtual_config JSON
 * @param {object} server
 * @returns {object} 合并了默认值的完整配置
 */
export function parseVirtualConfig(server) {
  const raw = String(server?.virtual_config || '').trim();
  let parsed = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // OK
      } else {
        parsed = {};
      }
    } catch (_) {
      parsed = {};
    }
  }
  return { ...DEFAULT_CONFIG, ...parsed };
}

/**
 * 判断一个服务器是否为虚拟服务器
 */
export function isVirtualServer(server) {
  if (!server) return false;
  return server.is_virtual === '1' || server.is_virtual === 1 || server.is_virtual === true;
}

// ─── 指标生成 ───────────────────────────────────────

/**
 * 为虚拟服务器生成当前时刻的指标数据
 * 返回的对象结构与 metrics_history 行兼容，
 * 可直接传给 mergeMetricsIntoServer()。
 *
 * @param {object} server - 服务器记录（含 virtual_config）
 * @returns {object} 指标对象
 */
export function generateVirtualMetrics(server) {
  const cfg = parseVirtualConfig(server);
  const seed = hashSeed(server.id);
  const now = Date.now();

  // 用分钟级时间戳做波动基准——每分钟变化一次，平滑且不跳变
  const t = Math.floor(now / 60000); // 分钟序号
  const rng = seededRandom(seed + t * 7919);

  // ── CPU：多频率正弦波叠加 ──
  // 三条不同频率/相位的正弦波 + 随机抖动，模拟真实负载波动
  const baseOffset = seed % 360;
  const cpuWave1 = Math.sin(rad((t * 7 + baseOffset) % 360)) * 0.35;
  const cpuWave2 = Math.sin(rad((t * 13 + baseOffset * 2) % 360)) * 0.25;
  const cpuWave3 = Math.sin(rad((t * 3 + baseOffset * 3) % 360)) * 0.20;
  const cpuNoise = (rng() - 0.5) * 0.2;
  const cpuT = clamp(cpuWave1 + cpuWave2 + cpuWave3 + cpuNoise + 0.5, 0, 1);
  const cpu = parseFloat(lerp(cfg.cpu_min, cfg.cpu_max, cpuT).toFixed(2));

  // ── RAM 使用率 ──（波动比 CPU 小）
  const ramWave = Math.sin(rad((t * 5 + baseOffset) % 360)) * 0.3;
  const ramNoise = (rng() - 0.5) * 0.1;
  const ramT = clamp(ramWave + ramNoise + 0.5, 0, 1);
  const ramUsagePercent = lerp(cfg.ram_usage_min, cfg.ram_usage_max, ramT);
  const ram_total = cfg.ram_total;
  const ram_used = parseFloat((ram_total * ramUsagePercent / 100).toFixed(2));

  // ── Swap ──（少量使用，跟随 RAM）
  const swap_total = cfg.swap_total;
  const swap_used = parseFloat((swap_total * Math.min(0.15, ramUsagePercent / 100 * 0.3)).toFixed(2));

  // ── Disk ──（基本固定，微小波动）
  const diskNoise = (rng() - 0.5) * 0.02;
  const diskUsagePercent = clamp(cfg.disk_usage + diskNoise * 10, 0, 99.5);
  const disk_total = cfg.disk_total;
  const disk_used = parseFloat((disk_total * diskUsagePercent / 100).toFixed(2));

  // ── 网络速度 ──（波动较大）
  const netWave1 = Math.sin(rad((t * 11 + baseOffset) % 360)) * 0.4;
  const netWave2 = Math.sin(rad((t * 17 + baseOffset * 2) % 360)) * 0.3;
  const netNoise = (rng() - 0.5) * 0.3;
  const netInT = clamp(netWave1 + netWave2 + netNoise + 0.5, 0, 1);
  const netOutT = clamp(netWave1 * 0.8 + netWave2 * 1.2 + netNoise * 0.9 + 0.5, 0, 1);
  const net_in_speed = parseFloat(lerp(cfg.net_in_min, cfg.net_in_max, netInT).toFixed(2));
  const net_out_speed = parseFloat(lerp(cfg.net_out_min, cfg.net_out_max, netOutT).toFixed(2));

  // ── 网络累计流量 ──（基于启动时间计算，更真实）
  const bootTimeMs = cfg.boot_time ? new Date(cfg.boot_time).getTime() : (now - 86400000 * 30);
  const minutesSinceBoot = Math.max(0, Math.floor((now - bootTimeMs) / 60000));
  // 平均速率 × 时间 = 总流量，添加一些随机波动使其更自然
  const avgNetInSpeed = (cfg.net_in_min + cfg.net_in_max) / 2;
  const avgNetOutSpeed = (cfg.net_out_min + cfg.net_out_max) / 2;
  const trafficNoise = 0.8 + rng() * 0.4; // 0.8 ~ 1.2 的随机系数
  const net_rx = Math.max(0, parseFloat((avgNetInSpeed * 60 * minutesSinceBoot * trafficNoise).toFixed(2)));
  const net_tx = Math.max(0, parseFloat((avgNetOutSpeed * 60 * minutesSinceBoot * trafficNoise).toFixed(2)));

  // ── 进程数、连接数 ──（小幅波动）
  const procNoise = Math.floor((rng() - 0.5) * 10);
  const processes = Math.max(1, cfg.processes + procNoise);
  const tcpNoise = Math.floor((rng() - 0.5) * 8);
  const tcp_conn = Math.max(0, cfg.tcp_conn + tcpNoise);
  const udp_conn = cfg.udp_conn;

  // ── Ping ──（固定值 + 小幅抖动）
  const pingJitter = (val) => Math.max(1, val + Math.floor((rng() - 0.5) * 2));
  const ping_ct = pingJitter(cfg.ping_ct);
  const ping_cu = pingJitter(cfg.ping_cu);
  const ping_cm = pingJitter(cfg.ping_cm);
  const ping_bd = pingJitter(cfg.ping_bd);

  // ── Load Average ──（跟随 CPU）
  const load1 = parseFloat((cpu / 100 * cfg.cpu_cores * 0.8).toFixed(2));
  const load5 = parseFloat((cpu / 100 * cfg.cpu_cores * 0.6).toFixed(2));
  const load15 = parseFloat((cpu / 100 * cfg.cpu_cores * 0.5).toFixed(2));

  // ── Disk IO ──（轻微活动）
  const disk_read_bps = parseFloat((net_in_speed * 0.1 * rng()).toFixed(2));
  const disk_write_bps = parseFloat((net_out_speed * 0.1 * rng()).toFixed(2));
  const disk_read_iops = Math.floor(disk_read_bps / 4096);
  const disk_write_iops = Math.floor(disk_write_bps / 4096);
  const disk_await_ms = parseFloat((1 + rng() * 3).toFixed(2));
  const disk_util = parseFloat((cpu * 0.3 + rng() * 5).toFixed(2));

  return {
    timestamp: now,
    cpu,
    load_avg: `${load1} ${load5} ${load15}`,
    net_in_speed,
    net_out_speed,
    net_rx,
    net_tx,
    net_rx_monthly: parseFloat((net_rx * 0.3).toFixed(2)),
    net_tx_monthly: parseFloat((net_tx * 0.3).toFixed(2)),
    processes,
    tcp_conn,
    udp_conn,
    ping_ct,
    ping_cu,
    ping_cm,
    ping_bd,
    loss_ct: 0,
    loss_cu: 0,
    loss_cm: 0,
    loss_bd: 0,
    ram_total,
    ram_used,
    swap_total,
    swap_used,
    disk_total,
    disk_used,
    disk_read_bps,
    disk_write_bps,
    disk_read_iops,
    disk_write_iops,
    disk_await_ms,
    disk_util,
    cpu_cores: cfg.cpu_cores,
    cpu_info: cfg.cpu_info,
    gpu_info: '',
    arch: cfg.arch,
    os: cfg.os,
    kernel_version: cfg.kernel_version,
    region: server.region || '',
    ip_v4: cfg.ip_v4,
    ip_v6: cfg.ip_v6,
    boot_time: cfg.boot_time || new Date(now - 86400000 * 30).toISOString(),
    agent_version: cfg.agent_version
  };
}

/**
 * 在指定时间戳生成虚拟服务器指标（用于历史数据）
 */
function generateVirtualMetricsAtTime(server, timestamp) {
  const cfg = parseVirtualConfig(server);
  const seed = hashSeed(server.id);
  const t = Math.floor(timestamp / 60000);
  const rng = seededRandom(seed + t * 7919);
  const baseOffset = seed % 360;

  const cpuWave1 = Math.sin(rad((t * 7 + baseOffset) % 360)) * 0.35;
  const cpuWave2 = Math.sin(rad((t * 13 + baseOffset * 2) % 360)) * 0.25;
  const cpuWave3 = Math.sin(rad((t * 3 + baseOffset * 3) % 360)) * 0.20;
  const cpuNoise = (rng() - 0.5) * 0.2;
  const cpuT = clamp(cpuWave1 + cpuWave2 + cpuWave3 + cpuNoise + 0.5, 0, 1);
  const cpu = parseFloat(lerp(cfg.cpu_min, cfg.cpu_max, cpuT).toFixed(2));

  const ramWave = Math.sin(rad((t * 5 + baseOffset) % 360)) * 0.3;
  const ramNoise = (rng() - 0.5) * 0.1;
  const ramT = clamp(ramWave + ramNoise + 0.5, 0, 1);
  const ramUsagePercent = lerp(cfg.ram_usage_min, cfg.ram_usage_max, ramT);
  const ram_total = cfg.ram_total;
  const ram_used = parseFloat((ram_total * ramUsagePercent / 100).toFixed(2));

  const swap_total = cfg.swap_total;
  const swap_used = parseFloat((swap_total * Math.min(0.15, ramUsagePercent / 100 * 0.3)).toFixed(2));

  const diskNoise = (rng() - 0.5) * 0.02;
  const diskUsagePercent = clamp(cfg.disk_usage + diskNoise * 10, 0, 99.5);
  const disk_total = cfg.disk_total;
  const disk_used = parseFloat((disk_total * diskUsagePercent / 100).toFixed(2));

  const netWave1 = Math.sin(rad((t * 11 + baseOffset) % 360)) * 0.4;
  const netWave2 = Math.sin(rad((t * 17 + baseOffset * 2) % 360)) * 0.3;
  const netNoise = (rng() - 0.5) * 0.3;
  const netInT = clamp(netWave1 + netWave2 + netNoise + 0.5, 0, 1);
  const netOutT = clamp(netWave1 * 0.8 + netWave2 * 1.2 + netNoise * 0.9 + 0.5, 0, 1);
  const net_in_speed = parseFloat(lerp(cfg.net_in_min, cfg.net_in_max, netInT).toFixed(2));
  const net_out_speed = parseFloat(lerp(cfg.net_out_min, cfg.net_out_max, netOutT).toFixed(2));

  const pingJitter = (val) => Math.max(1, val + Math.floor((rng() - 0.5) * 2));

  const load1 = parseFloat((cpu / 100 * cfg.cpu_cores * 0.8).toFixed(2));
  const load5 = parseFloat((cpu / 100 * cfg.cpu_cores * 0.6).toFixed(2));
  const load15 = parseFloat((cpu / 100 * cfg.cpu_cores * 0.5).toFixed(2));

  // 基于启动时间计算累计流量
  const bootTimeMs = cfg.boot_time ? new Date(cfg.boot_time).getTime() : (timestamp - 86400000 * 30);
  const minutesSinceBoot = Math.max(0, Math.floor((timestamp - bootTimeMs) / 60000));
  const avgNetInSpeed = (cfg.net_in_min + cfg.net_in_max) / 2;
  const avgNetOutSpeed = (cfg.net_out_min + cfg.net_out_max) / 2;
  const trafficNoise = 0.8 + rng() * 0.4;
  const net_rx = Math.max(0, parseFloat((avgNetInSpeed * 60 * minutesSinceBoot * trafficNoise).toFixed(2)));
  const net_tx = Math.max(0, parseFloat((avgNetOutSpeed * 60 * minutesSinceBoot * trafficNoise).toFixed(2)));

  return {
    timestamp,
    cpu,
    load_avg: `${load1} ${load5} ${load15}`,
    net_in_speed,
    net_out_speed,
    net_rx,
    net_tx,
    processes: Math.max(1, cfg.processes + Math.floor((rng() - 0.5) * 10)),
    tcp_conn: Math.max(0, cfg.tcp_conn + Math.floor((rng() - 0.5) * 8)),
    udp_conn: cfg.udp_conn,
    ping_ct: pingJitter(cfg.ping_ct),
    ping_cu: pingJitter(cfg.ping_cu),
    ping_cm: pingJitter(cfg.ping_cm),
    ping_bd: pingJitter(cfg.ping_bd),
    loss_ct: 0,
    loss_cu: 0,
    loss_cm: 0,
    loss_bd: 0,
    ram_total,
    ram_used,
    swap_total,
    swap_used,
    disk_total,
    disk_used,
    disk_read_bps: parseFloat((net_in_speed * 0.1 * rng()).toFixed(2)),
    disk_write_bps: parseFloat((net_out_speed * 0.1 * rng()).toFixed(2)),
    disk_read_iops: 0,
    disk_write_iops: 0,
    disk_await_ms: parseFloat((1 + rng() * 3).toFixed(2)),
    disk_util: parseFloat((cpu * 0.3 + rng() * 5).toFixed(2)),
    cpu_cores: cfg.cpu_cores,
    cpu_info: cfg.cpu_info,
    gpu_info: '',
    arch: cfg.arch,
    os: cfg.os,
    kernel_version: cfg.kernel_version,
    region: server.region || '',
    ip_v4: cfg.ip_v4,
    ip_v6: cfg.ip_v6,
    boot_time: cfg.boot_time || '',
    agent_version: cfg.agent_version
  };
}

/**
 * 生成虚拟服务器历史数据
 * 返回与 getMetricsHistory 格式兼容的数组
 *
 * @param {object} server - 服务器记录（含 virtual_config）
 * @param {number} hours - 小时数
 * @param {number} maxPoints - 最大数据点数
 * @returns {Array<object>} 历史数据数组
 */
export function generateVirtualHistoryData(server, hours, maxPoints = 160) {
  const seed = hashSeed(server.id);
  const now = Date.now();
  const totalMs = Math.min(hours, 168) * 60 * 60 * 1000;
  const intervalMs = Math.max(10000, Math.ceil(totalMs / maxPoints));
  const count = Math.min(maxPoints, Math.ceil(totalMs / intervalMs));

  const result = [];
  for (let i = 0; i < count; i++) {
    const ts = now - totalMs + intervalMs * i;
    result.push(generateVirtualMetricsAtTime(server, ts));
  }
  return result;
}
