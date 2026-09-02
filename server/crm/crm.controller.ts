import { Body, Controller, Get, Param, Patch, Query, Res } from '@nestjs/common'
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

  @Get('applications/:id/documents/:documentId/download')
  async downloadDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() response,
  ) {
    const document = await this.crmService.getDocumentForDownload(id, documentId)
    if (document.mimeType) response.type(document.mimeType)
    return response.download(document.filePath, document.originalName)
  }

  @Get('applications/:id/documents/:documentId/view')
  async viewDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() response,
  ) {
    const document = await this.crmService.getDocumentForDownload(id, documentId)
    if (document.mimeType) response.type(document.mimeType)
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    response.setHeader('Content-Disposition', `inline; filename="${document.originalName.replace(/"/g, '')}"`)
    return response.sendFile(document.filePath)
  }
}
