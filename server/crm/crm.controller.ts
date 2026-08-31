import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { CrmService } from './crm.service.js'
import type { JsonRecord } from './types.js'

@Controller('api/crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('applications')
  listApplications(@Query() filter: { status?: string; search?: string } = {}) {
    return this.crmService.listApplications(filter)
  }

  @Get('applications/:id')
  getApplication(@Param('id') id: string) {
    return this.crmService.getApplication(id)
  }

  @Patch('applications/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: JsonRecord = {}) {
    return this.crmService.updateStatus(id, body)
  }
}
