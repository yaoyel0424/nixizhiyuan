import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import pino from 'pino';
import { createStream as createRotatingStream } from 'rotating-file-stream';

/** rotating-file-stream 要求的 size 格式 */
type RotatingSize = `${number}B` | `${number}K` | `${number}M` | `${number}G`;

/**
 * 支付与分账专用日志服务
 * 所有日志写入 logs/pay.log（轮转，与 app.log 同目录）
 */
@Injectable()
export class PayLoggerService implements OnModuleInit {
  private pinoLogger: pino.Logger;

  constructor(private configService: ConfigService) {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFileSizeRaw = this.configService.get<string>('LOG_FILE_SIZE') || '20M';
    const logFileSize: RotatingSize = /^\d+[BKMG]$/i.test(logFileSizeRaw)
      ? (logFileSizeRaw as RotatingSize)
      : '20M';
    const logMaxFiles = this.configService.get<number>('LOG_MAX_FILES') ?? 5;
    const payStream = createRotatingStream('pay.log', {
      path: logsDir,
      size: logFileSize,
      maxFiles: logMaxFiles,
    });
    this.pinoLogger = pino(
      {
        level: this.configService.get<string>('LOG_LEVEL') || 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level: (label) => ({ level: label }),
        },
      },
      payStream,
    );
  }

  onModuleInit() {
    this.pinoLogger.info({ context: 'PayLogger' }, 'pay.log 已就绪');
  }

  log(message: string, context?: string): void {
    this.pinoLogger.info({ context }, message);
  }

  warn(message: string, context?: string): void {
    this.pinoLogger.warn({ context }, message);
  }

  error(message: string, trace?: string, context?: string): void {
    this.pinoLogger.error({ trace, context }, message);
  }
}
