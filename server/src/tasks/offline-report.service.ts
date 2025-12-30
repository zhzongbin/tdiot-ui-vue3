import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class OfflineReportService {
  private readonly logger = new Logger(OfflineReportService.name);
  private token: string | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // 每天凌晨 1 点执行
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron() {
    this.logger.debug('开始执行离线设备统计任务...');
    await this.generateReport();
  }

  // 手动触发方法 (支持传入外部 Token 以实现鉴权一致性)
  async generateReport(providedToken?: string) {
    const startTime = Date.now();
    try {
      if (providedToken) {
        this.token = providedToken;
        this.logger.log('使用前端传递的 Token 进行统计');
      } else {
        await this.login();
      }
      const devices = await this.fetchDevicesByQuery();
      const report = await this.processDevices(devices);

      // 保存到 JSON 文件 (保持兼容前端)
      await this.saveJsonReport(report);

      // 保存到 SQLite 数据库 (新功能)
      await this.saveToDatabase(report);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `统计完成！耗时: ${duration}秒, 总设备: ${report.summary.total}, 离线: ${report.summary.offline}`,
      );

      return report;
    } catch (error) {
      this.logger.error('统计任务失败', error);
      throw error;
    }
  }

  private async login() {
    const baseURL =
      this.configService.get<string>('VITE_TB_BASE_URL') || 'http://61.131.1.193:9090';
    const username = this.configService.get<string>('TB_USERNAME') || 'tenant@thingsboard.org';
    const password = this.configService.get<string>('TB_PASSWORD') || 'tenant';

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${baseURL}/api/auth/login`, { username, password }),
      );
      this.token = response.data.token;
      this.logger.log('ThingsBoard 登录成功');
    } catch (error) {
      this.logger.error('登录失败', error.message);
      throw error;
    }
  }

  private async fetchDevicesByQuery() {
    const baseURL =
      this.configService.get<string>('VITE_TB_BASE_URL') || 'http://61.131.1.193:9090';
    const pageSize = 500;
    let allRows = [];
    let page = 0;
    let hasNext = true;

    this.logger.log('正在批量拉取设备数据...');

    while (hasNext) {
      const queryBody = {
        entityFilter: {
          type: 'entityType',
          entityType: 'DEVICE',
          resolveInherited: false,
        },
        pageLink: {
          pageSize: pageSize,
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
          { type: 'ENTITY_FIELD', key: 'id' },
        ],
        latestValues: [
          { type: 'ATTRIBUTE', key: 'lastActivityTime' },
          { type: 'SERVER_ATTRIBUTE', key: 'project' },
        ],
      };

      try {
        const response = await firstValueFrom(
          this.httpService.post(`${baseURL}/api/entitiesQuery/find`, queryBody, {
            headers: { 'X-Authorization': `Bearer ${this.token}` },
          }),
        );

        const { data: rows, hasNext: next } = response.data;
        allRows = allRows.concat(rows);
        hasNext = next;
        page++;
      } catch (error) {
        this.logger.error(`第 ${page} 页查询失败`, error.message);
        hasNext = false;
      }
    }
    return allRows;
  }

  private async processDevices(rows: any[]) {
    const now = Date.now();
    const thresholdMs = 20 * 60 * 60 * 1000; // 20 hours

    const report = {
      generatedAt: new Date().toISOString(),
      summary: { total: rows.length, offline: 0, online: 0 },
      projects: {} as Record<string, any>,
      allDevices: [] as any[], // 用于数据库存储的扁平列表
    };

    for (const row of rows) {
      const getValue = (type: string, key: string) => row.latest?.[type]?.[key]?.value;

      const name = getValue('ENTITY_FIELD', 'name') || 'Unknown';
      const label = getValue('ENTITY_FIELD', 'label') || '';
      const id = row.entityId.id;
      const project = getValue('SERVER_ATTRIBUTE', 'project') || '未分类';
      const lastActivityStr = getValue('ATTRIBUTE', 'lastActivityTime');
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : 0;

      const offlineTimeMs = now - lastActivity;
      const isOffline = lastActivity === 0 || offlineTimeMs > thresholdMs;

      // Project Grouping
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

      const deviceData = {
        name,
        label,
        id,
        lastActivityTime: lastActivity ? new Date(lastActivity).toLocaleString() : '无记录',
        offlineHours: lastActivity ? (offlineTimeMs / 3600000).toFixed(1) : null, // database float
        offlineHoursStr: lastActivity ? (offlineTimeMs / 3600000).toFixed(1) : '∞', // json string
        status: isOffline ? '离线' : '在线',
        project,
        lastActivityTs: lastActivity || null,
      };

      pData.devices.push({
        ...deviceData,
        offlineHours: deviceData.offlineHoursStr, // JSON use string
      });

      report.allDevices.push(deviceData);
    }

    return report;
  }

  private async saveJsonReport(report: any) {
    // 假设运行在 server 目录，需要往上写到 public/data
    const reportPath = path.resolve(process.cwd(), '../public/data/offline_report.json');
    await fs.ensureDir(path.dirname(reportPath));
    // 移除 allDevices 字段以减小 JSON 体积，只保留分组数据
    const { allDevices, ...jsonReport } = report;
    await fs.writeJson(reportPath, jsonReport, { spaces: 2 });
    this.logger.log(`JSON 报告已更新: ${reportPath}`);
  }

  private async saveToDatabase(report: any) {
    const dateStr = new Date().toISOString().split('T')[0];

    // 1. 保存任务记录
    await this.prisma.reportTask.upsert({
      where: { date: dateStr },
      update: {
        totalDevices: report.summary.total,
        onlineCount: report.summary.online,
        offlineCount: report.summary.offline,
        createdAt: new Date(),
      },
      create: {
        date: dateStr,
        totalDevices: report.summary.total,
        onlineCount: report.summary.online,
        offlineCount: report.summary.offline,
      },
    });

    // 2. 批量保存设备状态 (为了性能，先删除当天的旧数据再插入，或者只插入离线记录？这里全量插入)
    // 注意：SQLite 批量插入有参数限制，需要分批
    await this.prisma.deviceStatus.deleteMany({ where: { reportId: dateStr } });

    const batchSize = 100;
    const devices = report.allDevices;

    for (let i = 0; i < devices.length; i += batchSize) {
      const batch = devices.slice(i, i + batchSize).map((d) => ({
        deviceId: d.id,
        name: d.name,
        label: d.label,
        project: d.project,
        status: d.status,
        lastActivityTime: d.lastActivityTs ? new Date(d.lastActivityTs) : null,
        offlineHours: d.offlineHours ? parseFloat(d.offlineHours) : null,
        reportId: dateStr,
      }));

      // 使用事务包裹单个插入以增强兼容性（部分环境下 SQLite 的 createMany 可能存在 TS 报错）
      await this.prisma.$transaction(
        batch.map((data) => this.prisma.deviceStatus.create({ data })),
      );
    }

    this.logger.log(`数据库记录已更新: ${dateStr}`);
  }
}
