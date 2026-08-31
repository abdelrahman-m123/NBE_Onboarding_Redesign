import { Controller, Get } from '@nestjs/common'
import { HealthService } from './health.service.js'

@Controller('api')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  health() {
    return this.healthService.health()
  }

  @Get('db/health')
  databaseHealth() {
    return this.healthService.databaseHealth()
  }
}
