import { Module } from '@nestjs/common'
import { ApplicationsModule } from './applications/applications.module.js'
import { CrmModule } from './crm/crm.module.js'
import { DatabaseModule } from './database/database.module.js'
import { HealthModule } from './health/health.module.js'
import { IdentityVerificationModule } from './identity-verification/identity-verification.module.js'

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    ApplicationsModule,
    IdentityVerificationModule,
    CrmModule,
  ],
})
export class AppModule {}
