import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';
import * as path from 'path';
import * as fs from 'fs';
import pino from 'pino';
import { createStream as createRotatingStream } from 'rotating-file-stream';

/**
 * 日志模块
 * 基于 Pino 的高性能日志模块
 * 使用主进程 multistream + rotating-file-stream 写文件，确保请求日志与 LoggerService 日志都落盘
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDevelopment = configService.get('app.env') === 'development';
        const logLevel = configService.get('LOG_LEVEL') || 'info';

        // 确保 logs 目录存在
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }

        const logFileSize = configService.get('LOG_FILE_SIZE') || '20M';
        const logMaxFiles = configService.get('LOG_MAX_FILES') != null
          ? Number(configService.get('LOG_MAX_FILES')) : 5;

        // 主进程内创建轮转流，避免 worker 导致日志不落盘
        const appStream = createRotatingStream('app.log', {
          path: logsDir,
          size: logFileSize,
          maxFiles: logMaxFiles,
        });
        const errorStream = createRotatingStream('error.log', {
          path: logsDir,
          size: logFileSize,
          maxFiles: logMaxFiles,
        });

        // 控制台：开发用 pretty，生产用 stdout（JSON）
        const consoleStream = isDevelopment
          ? pino.transport({ target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } })
          : pino.destination(1);

        // 多目标：全量写 app，error 级再写 error.log，同时写控制台
        const multistream = pino.multistream([
          { stream: appStream, level: 'info' as const },
          { stream: errorStream, level: 'error' as const },
          { stream: consoleStream, level: 'info' as const },
        ]);

        // 当前时区时间戳（用于日志 time 字段，不用 UTC）
        const localTime = () => {
          const d = new Date();
          const pad = (n: number) => (n < 10 ? '0' + n : String(n));
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
        };

        const pinoOptions = {
          level: logLevel,
          timestamp: localTime,
          serializers: {
            req: (req) => {
              const user = (req as any).user;
              return {
                id: req.id,
                method: req.method,
                url: req.url,
                userId: user?.id ?? null,
                headers: {
                  host: req.headers.host,
                  'user-agent': req.headers['user-agent'],
                },
                remoteAddress: req.ip,
                remotePort: req.socket?.remotePort,
              };
            },
            res: (res) => ({
              statusCode: res.statusCode,
            }),
            err: (err) => ({
              type: err.type,
              message: err.message,
              stack: err.stack,
            }),
          },
          // 关闭 pino-http 的自动请求日志，避免与 LoggingInterceptor 重复；请求日志仅由 LoggingInterceptor 记录
          autoLogging: false,
          customLogLevel: (_req, res, err) => {
            if (res.statusCode >= 400 || err) return 'silent';
            return 'info';
          },
        };

        // nestjs-pino 支持 [Options, DestinationStream]，同一 stream 保证请求日志与 LoggerService 都落盘
        return {
          pinoHttp: [pinoOptions, multistream],
        };
      },
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}

