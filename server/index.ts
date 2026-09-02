import './common/load-env.js'
import 'reflect-metadata'
import helmet from 'helmet'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js'
import { pool } from './database/db.js'
import { SMS_SERVICE, type SmsService } from './identity-verification/sms/sms.interface.js'
import { logger, requestLogger } from './common/logger.js'

const port = Number(process.env.PORT || 4000)

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, { logger: false })
    app.use(helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }))
    app.enableCors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' })
    app.use(requestLogger)
    app.useGlobalFilters(new GlobalExceptionFilter())

    const server = await app.listen(port)
    server.ref()
    logger.info('server.started', { port, url: `http://localhost:${port}` })
    const smsService = app.get<SmsService>(SMS_SERVICE)
    smsService.startListener()

    server.on('close', () => {
      logger.info('server.closed')
    })

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error('server.port_in_use', {
          port,
          message: `Port ${port} is already in use. Stop the existing server or run npm run port:4000 to find it.`,
        })
        process.exit(1)
      }

      logger.error('server.error', { error })
    })

    async function shutdown(signal: string) {
      logger.info('server.shutdown_started', { signal })

      await app.close()
      await pool.end()
      logger.info('server.shutdown_finished', { signal })
      process.exit(0)
    }

    process.on('SIGINT', () => { shutdown('SIGINT') })
    process.on('SIGTERM', () => { shutdown('SIGTERM') })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
      logger.error('server.port_in_use', {
        port,
        message: `Port ${port} is already in use. Stop the existing server or run npm run port:4000 to find it.`,
      })
      process.exit(1)
    }

    logger.error('server.bootstrap_failed', { error })
    process.exit(1)
  }
}

process.on('uncaughtException', (error) => {
  logger.error('process.uncaught_exception', { error })
  process.exit(1)
})
process.on('unhandledRejection', (error) => {
  logger.error('process.unhandled_rejection', { error })
  process.exit(1)
})

bootstrap()
