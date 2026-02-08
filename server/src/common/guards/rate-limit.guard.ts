import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '@/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IpBlockGuard } from './ip-block.guard';

/**
 * 速率限制元数据键
 */
export const RATE_LIMIT_KEY = 'rate_limit';
export const RATE_LIMIT_SKIP_KEY = 'rate_limit_skip';

/**
 * 速率限制装饰器
 */
export const RateLimit = (maxRequests: number, windowSeconds: number) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    require('@nestjs/common').SetMetadata(RATE_LIMIT_KEY, {
      maxRequests,
      windowSeconds,
    })(target, propertyKey, descriptor);
  };
};

/**
 * 跳过速率限制装饰器
 */
export const SkipRateLimit = () => {
  return require('@nestjs/common').SetMetadata(RATE_LIMIT_SKIP_KEY, true);
};

/**
 * DoS 防护守卫：请求超过阈值时直接封禁 IP（不返回 429 速率限制）
 * 使用 Redis 统计请求次数，超限则调用 IpBlockGuard 封禁并返回 403
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly defaultMaxRequests: number;
  private readonly defaultWindowSeconds: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly ipBlockGuard: IpBlockGuard,
  ) {
    // 从环境变量读取默认配置
    this.defaultMaxRequests =
      parseInt(this.configService.get<string>('RATE_LIMIT_MAX_REQUESTS', '300'), 10) || 300;
    this.defaultWindowSeconds =
      parseInt(this.configService.get<string>('RATE_LIMIT_WINDOW_SECONDS', '60'), 10) || 60;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // 检查是否跳过速率限制
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      RATE_LIMIT_SKIP_KEY,
      [handler, controller],
    );

    if (skipRateLimit) {
      return true;
    }

    // 获取速率限制配置
    const rateLimitConfig = this.reflector.getAllAndOverride<{
      maxRequests: number;
      windowSeconds: number;
    }>(RATE_LIMIT_KEY, [handler, controller]);

    const maxRequests = rateLimitConfig?.maxRequests || this.defaultMaxRequests;
    const windowSeconds = rateLimitConfig?.windowSeconds || this.defaultWindowSeconds;

    // 获取客户端 IP
    const ip = this.getClientIp(request);
    const key = `rate_limit:${ip}:${request.path}`;

    try {
      // 获取当前请求计数
      const currentCount = await this.redisService.get(key);
      const count = currentCount ? parseInt(currentCount, 10) : 0;

      if (count >= maxRequests) {
        // DoS 防护：超限直接封禁 IP，不返回 429
        this.logger.warn(
          `DoS 防护: 请求超限，封禁 IP - ${ip}, 路径 ${request.path}, 限制: ${maxRequests}/${windowSeconds}秒`,
        );
        await this.ipBlockGuard.blockIp(ip);
        throw new HttpException(
          {
            success: false,
            code: 'IP_BLOCKED',
            message: '请求异常频繁，IP 已被封禁',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      // 增加计数
      if (count === 0) {
        // 第一次请求，设置计数和过期时间
        await this.redisService.set(key, '1', windowSeconds);
      } else {
        // 增加计数，保持原有的过期时间
        const newCount = (count + 1).toString();
        await this.redisService.set(key, newCount, windowSeconds);
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // Redis 连接失败时，允许请求通过（容错处理）
      this.logger.warn(`Redis 连接失败，跳过速率限制: ${error.message}`);
      return true;
    }
  }

  /**
   * 获取客户端真实 IP
   */
  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }
}

