import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 日志模块
 * 基于 Pino 的高性能日志模块
 * 支持控制台输出和文件输出
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

        // 配置 transports（多目标输出）
        const transports: any[] = [];

        // 1. 文件输出（所有环境都启用）
        transports.push({
          target: 'pino/file',
          options: {
            destination: path.join(logsDir, 'app.log'),
            mkdir: true,
          },
          level: logLevel,
        });

        // 2. 错误日志单独文件
        transports.push({
          target: 'pino/file',
          options: {
            destination: path.join(logsDir, 'error.log'),
            mkdir: true,
          },
          level: 'error',
        });

        // 3. 控制台输出（开发环境美化，生产环境 JSON）
        if (isDevelopment) {
          transports.push({
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: false,
              translateTime: 'SYS:standard',
            },
            level: logLevel,
          });
        } else {
          // 生产环境也输出到控制台（JSON 格式）
          transports.push({
            target: 'pino/file',
            options: {
              destination: 1, // stdout
            },
            level: logLevel,
          });
        }

        return {
          pinoHttp: {
            level: logLevel,
            // 使用多目标传输
            transport: {
              targets: transports,
            },
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                headers: {
                  host: req.headers.host,
                  'user-agent': req.headers['user-agent'],
                },
                remoteAddress: req.ip,
                remotePort: req.socket?.remotePort,
              }),
              res: (res) => ({
                statusCode: res.statusCode,
              }),
              err: (err) => ({
                type: err.type,
                message: err.message,
                stack: err.stack,
              }),
            },
            // 自动记录请求日志
            autoLogging: {
              ignore: (req) => {
                // 忽略健康检查请求（可选）
                return req.url === '/api/v2/health';
              },
            },
            // 自定义请求日志记录逻辑，忽略错误响应（4xx 和 5xx）
            // 错误响应由 AllExceptionsFilter 统一记录，避免重复
            customLogLevel: (req, res, err) => {
              // 如果响应状态码 >= 400，返回 'silent' 不记录（由 AllExceptionsFilter 记录）
              if (res.statusCode >= 400) {
                return 'silent';
              }
              // 如果有错误，返回 'silent'（由 AllExceptionsFilter 记录）
              if (err) {
                return 'silent';
              }
              // 正常请求记录为 info
              return 'info';
            },
          },
        };
      },
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}

