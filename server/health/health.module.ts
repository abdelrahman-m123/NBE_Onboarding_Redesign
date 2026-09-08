import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { HealthController } from './health.controller.js'
import { HealthService } from './health.service.js'
import { MetricsController } from './metrics.controller.js'

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, MetricsController],
  providers: [HealthService],
})
export class HealthModule {}
