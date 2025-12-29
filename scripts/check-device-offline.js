import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载环境变量
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const TB_BASE_URL = process.env.VITE_TB_BASE_URL || 'http://61.131.1.193:9090';
const USERNAME = process.env.TB_USERNAME || 'tenant@thingsboard.org';
const PASSWORD = process.env.TB_PASSWORD || 'tenant';
const OFFLINE_THRESHOLD_HOURS = 20;
const PAGE_SIZE = 500; // 调大分页大小，减少请求次数

const apiClient = axios.create({
  baseURL: TB_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

async function login() {
  console.log('正在登录 ThingsBoard...');
  try {
    const response = await apiClient.post('/api/auth/login', { username: USERNAME, password: PASSWORD });
    apiClient.defaults.headers.common['X-Authorization'] = `Bearer ${response.data.token}`;
    console.log('登录成功！');
  } catch (error) {
    console.error('登录失败:', error.response?.data || error.message);
    process.exit(1);
  }
}

// 使用 Entity Query API 批量获取设备 + 属性
async function fetchDevicesByQuery() {
  console.log('正在通过 Entity Query 批量获取设备及属性...');
  let allRows = [];
  let page = 0;
  let hasNext = true;

  while (hasNext) {
    const queryBody = {
      entityFilter: {
        type: 'entityType',
        entityType: 'DEVICE',
        resolveInherited: false,
      },
      pageLink: {
        pageSize: PAGE_SIZE,
        page: page,
        sortOrder: {
          key: { type: 'ENTITY_FIELD', key: 'createdTime' },
          direction: 'DESC',
        },
      },
      entityFields: [
        { type: 'ENTITY_FIELD', key: 'name' },
        { type: 'ENTITY_FIELD', key: 'label' },
        { type: 'ENTITY_FIELD', key: 'createdTime' },
        { type: 'ENTITY_FIELD', key: 'id' }, // 这里的 key id 其实是 entityId
      ],
      latestValues: [
        { type: 'ATTRIBUTE', key: 'lastActivityTime' },
        { type: 'SERVER_ATTRIBUTE', key: 'project' },
      ],
    };

    try {
      const { data } = await apiClient.post('/api/entitiesQuery/find', queryBody);
      const { data: rows, hasNext: next } = data;

      allRows = allRows.concat(rows);
      hasNext = next;
      page++;

      // 简单进度条
      process.stdout.write(`\r已获取页数: ${page} (总数: ${allRows.length})`);
    } catch (error) {
      console.error('\n查询失败:', error.message);
      hasNext = false;
    }
  }
  console.log('\n数据拉取完成。');
  return allRows;
}

async function run() {
  const start = Date.now();
  await login();

  // 1. 批量获取数据（替代之前的 N+1 循环）
  const rows = await fetchDevicesByQuery();

  const now = Date.now();
  const thresholdMs = OFFLINE_THRESHOLD_HOURS * 60 * 60 * 1000;

  const report = {
    generatedAt: new Date().toISOString(),
    summary: { total: rows.length, offline: 0, online: 0 },
    projects: {},
  };

  console.log('正在处理数据...');

  for (const row of rows) {
    // 解析 Entity Query 返回的结构
    // row 结构: { entityId, latest: { ENTITY_FIELD: {...}, ATTRIBUTE: {...}, SERVER_ATTRIBUTE: {...} } }

    // 提取字段辅助函数
    const getValue = (type, key) => row.latest?.[type]?.[key]?.value;

    const name = getValue('ENTITY_FIELD', 'name') || 'Unknown';
    const label = getValue('ENTITY_FIELD', 'label') || '';
    const id = row.entityId.id;

    // 获取 project (服务端属性)
    const project = getValue('SERVER_ATTRIBUTE', 'project') || '未分类';

    // 获取最后活跃时间 (属性)
    const lastActivityStr = getValue('ATTRIBUTE', 'lastActivityTime');
    const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : 0;

    // 计算状态
    const offlineTimeMs = now - lastActivity;
    const isOffline = lastActivity === 0 || offlineTimeMs > thresholdMs;

    // 统计
    if (!report.projects[project]) {
      report.projects[project] = { total: 0, offline: 0, online: 0, devices: [] };
    }
    const pData = report.projects[project];
    pData.total++;

    if (isOffline) {
      pData.offline++;
      report.summary.offline++;
    } else {
      pData.online++;
      report.summary.online++;
    }

    // 添加到列表
    pData.devices.push({
      name,
      label,
      id,
      lastActivityTime: lastActivity ? new Date(lastActivity).toLocaleString() : '无记录',
      offlineHours: lastActivity ? (offlineTimeMs / 3600000).toFixed(1) : '∞',
      status: isOffline ? '离线' : '在线',
    });
  }

  // 保存
  const reportPath = path.join(__dirname, '../public/data/offline_report.json');
  await fs.ensureDir(path.dirname(reportPath));
  await fs.writeJson(reportPath, report, { spaces: 2 });

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log('-----------------------------------');
  console.log(`统计完成！耗时: ${duration}秒`);
  console.log(`总设备: ${report.summary.total}`);
  console.log(`离线数: ${report.summary.offline}`);
  console.log(`报告路径: ${reportPath}`);
}

run();
