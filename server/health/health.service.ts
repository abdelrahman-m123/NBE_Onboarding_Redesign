import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service.js'
import { logger } from '../common/logger.js'

@Injectable()
export class HealthService {
  constructor(private readonly database: DatabaseService) {}

  health() {
    return { ok: true, service: 'nbe-onboarding-api' }
  }

  async databaseHealth() {
    try {
      const result = await this.database.query('select current_database() as database, current_schema() as schema, now() as checked_at')
      return { ok: true, ...result.rows[0] }
    } catch (error) {
      logger.error('database.health.failed', { error })
      throw new HttpException({ ok: false, message: 'Database connection is unavailable.' }, HttpStatus.SERVICE_UNAVAILABLE)
    }
  }
}
