import { Controller, Get, Post } from '@nestjs/common';
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
  async refreshReport() {
    return await this.offlineReportService.generateReport();
  }
}
