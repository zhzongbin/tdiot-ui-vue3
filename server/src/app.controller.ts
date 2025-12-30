import { Controller, Get, Post, Headers } from '@nestjs/common';
import { AppService } from './app.service';
import { OfflineReportService } from './tasks/offline-report.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly offlineReportService: OfflineReportService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('refresh-report')
  async refreshReport(@Headers('X-Authorization') authHeader: string) {
    // 提取 Bearer Token (如果有)
    const token = authHeader?.replace('Bearer ', '');
    return await this.offlineReportService.generateReport(token);
  }
}
