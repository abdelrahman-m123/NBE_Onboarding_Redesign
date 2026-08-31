import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { CrmController } from './crm.controller.js'
import { CrmService } from './crm.service.js'

@Module({
  imports: [DatabaseModule],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
