import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/redis/redis.service';
import { CACHE_KEY, CACHE_TTL_KEY } from '../decorators/cache.decorator';
import { Reflector } from '@nestjs/core';

/**
 * 缓存拦截器
 * 使用 Redis 缓存接口响应数据
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // 检查是否启用了缓存
    const isCacheEnabled = this.reflector.getAllAndOverride<boolean>(CACHE_KEY, [
      handler,
      controller,
    ]);

    if (!isCacheEnabled) {
      return next.handle();
    }

    // 获取缓存 TTL
    // 优先级：装饰器参数 > 环境变量配置 > 默认值（600秒，即10分钟）
    const defaultTtl = parseInt(
      this.configService.get<string>('CACHE_DEFAULT_TTL', '600'),
      10,
    ) || 600;
    const ttl =
      this.reflector.getAllAndOverride<number>(CACHE_TTL_KEY, [
        handler,
        controller,
      ]) || defaultTtl;

    // 生成缓存 key
    const cacheKey = this.generateCacheKey(request);

    try {
      // 尝试从 Redis 获取缓存
      const cachedData = await this.redisService.get(cacheKey);

      if (cachedData) {
        this.logger.debug(`缓存命中: ${cacheKey}`);
        return of(JSON.parse(cachedData));
      }

      // 缓存未命中，执行原方法并缓存结果
      return next.handle().pipe(
        tap(async (data) => {
          try {
            // 检查 HTTP 状态码，只有成功状态（2xx）才缓存
            const statusCode = response.statusCode;
            if (statusCode < 200 || statusCode >= 300) {
              this.logger.debug(
                `状态码 ${statusCode} 不在成功范围（2xx），跳过缓存: ${cacheKey}`,
              );
              return;
            }

            // 将响应数据序列化为 JSON 并存入 Redis
            const serializedData = JSON.stringify(data);
            await this.redisService.set(cacheKey, serializedData, ttl);
            this.logger.debug(`缓存已设置: ${cacheKey}, TTL: ${ttl}秒, 状态码: ${statusCode}`);
          } catch (error) {
            // 缓存失败不影响正常响应
            this.logger.warn(`缓存设置失败: ${cacheKey}`, error);
          }
        }),
      );
    } catch (error) {
      // Redis 连接失败时，直接执行原方法，不进行缓存
      this.logger.warn(`Redis 操作失败，跳过缓存: ${error.message}`);
      return next.handle();
    }
  }

  /**
   * 生成缓存 key
   * 格式: cache:{method}:{path}:{params}:{query}:{userId}
   */
  private generateCacheKey(request: Request): string {
    const { method, path, params, query } = request;
    const user = (request as any).user;

    // 构建参数部分
    const paramsStr = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join('|');

    // 构建查询参数部分
    const queryStr = Object.keys(query)
      .sort()
      .map((key) => `${key}:${query[key]}`)
      .join('|');

    // 构建用户ID部分（如果有用户信息）
    const userId = user?.id ? `:user:${user.id}` : '';

    // 组合缓存 key
    const keyParts = [
      'cache',
      method.toLowerCase(),
      path,
      paramsStr || 'no-params',
      queryStr || 'no-query',
      userId,
    ]
      .filter(Boolean)
      .join(':');

    return keyParts;
  }
}

