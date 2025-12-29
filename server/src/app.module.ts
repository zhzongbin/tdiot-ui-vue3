import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { OfflineReportService } from './tasks/offline-report.service';

@Module({
  imports: [ConfigModule.forRoot(), ScheduleModule.forRoot(), HttpModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService, OfflineReportService],
})
export class AppModule {}
