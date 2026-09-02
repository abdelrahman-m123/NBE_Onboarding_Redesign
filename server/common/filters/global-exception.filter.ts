import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { Catch, HttpException } from '@nestjs/common'
import multer from 'multer'
import { logger } from '../logger.js'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse()

    if (exception instanceof multer.MulterError || (
      exception instanceof Error && [
        'Only image files can be scanned.',
        'Upload National ID images and HR letters as image or PDF files.',
        'Upload National ID images, face captures, and HR letters as supported image or PDF files.',
      ].includes(exception.message)
    )) {
      logger.warn('request.validation_failed', { error: exception })
      response.status(400).json({ message: exception.message })
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()
      response.status(status).json(typeof payload === 'string' ? { message: payload } : payload)
      return
    }

    logger.error('request.unhandled_error', { error: exception })
    response.status(500).json({ message: 'Something went wrong. Your progress is still safe.' })
  }
}
