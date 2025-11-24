import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

/**
 * 日志服务
 * 基于 Pino 的高性能日志服务
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @InjectPinoLogger(LoggerService.name)
    private readonly logger: PinoLogger,
  ) {}

  error(message: string, trace?: string, context?: string): void {
    this.logger.error({ trace, context }, message);
  }

  warn(message: string, context?: string): void {
    this.logger.warn({ context }, message);
  }

  log(message: string, context?: string): void {
    this.logger.info({ context }, message);
  }

  debug(message: string, context?: string): void {
    this.logger.debug({ context }, message);
  }

  verbose(message: string, context?: string): void {
    this.logger.trace({ context }, message);
  }
}

