import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/redis/redis.service';
import { CACHE_KEY, CACHE_TTL_KEY } from '../decorators/cache.decorator';
import { Reflector } from '@nestjs/core';
import { User } from '@/entities/user.entity';

/**
 * 缓存拦截器
 * 使用 Redis 缓存接口响应数据
 * 缓存 key 会包含用户从数据库中的高考相关字段及省份收藏 id，确保用户修改信息或收藏后命中新 key
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  /** 一条 SQL 同时查用户高考字段 + 省份收藏 id 列表（string_agg），用于生成缓存 key */
  private static readonly USER_AND_PF_QUERY = `
    SELECT
      u.province AS province,
      u.preferred_subjects AS "preferredSubjects",
      u.secondary_subjects AS "secondarySubjects",
      u.rank AS rank,
      u.enroll_type AS "enrollType",
      (SELECT COALESCE(string_agg(pf.province_id::text, '|' ORDER BY pf.id), '')
       FROM province_favorites pf WHERE pf.user_id = u.id) AS "pfIds"
    FROM users u
    WHERE u.id = $1
  `;

  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

    // 生成缓存 key（含从数据库读取的用户高考相关字段）
    const cacheKey = await this.generateCacheKey(request);

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
   * 格式: cache:{method}:{path}:{params}:{query}:{userPart}
   * userPart 含 userId 及从数据库读取的 province、preferredSubjects、secondarySubjects、rank、enrollType
   */
  private async generateCacheKey(request: Request): Promise<string> {
    const { method, path, params, query } = request;
    const requestUser = (request as any).user;

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

    // 用户部分：一条 SQL 查用户高考字段 + 省份收藏 id 列表，拼入 key
    let userPart = '';
    if (requestUser?.id) {
      const rows = await this.userRepository.manager.query(
        CacheInterceptor.USER_AND_PF_QUERY,
        [requestUser.id],
      );
      const row = rows?.[0];
      const province = row?.province ?? '';
      const preferredSubjects = row?.preferredSubjects ?? '';
      const secondarySubjects = row?.secondarySubjects ?? '';
      const rank = row?.rank ?? '';
      const enrollType = row?.enrollType ?? '';
      const pfIds = row?.pfIds ?? '';
      userPart = [
        'user',
        String(requestUser.id),
        province,
        preferredSubjects,
        secondarySubjects,
        String(rank),
        enrollType,
        'pf',
        pfIds || '-',
      ].join(':');
    }

    // 组合缓存 key
    const keyParts = [
      'cache',
      method.toLowerCase(),
      path,
      paramsStr || 'no-params',
      queryStr || 'no-query',
      userPart,
    ]
      .filter(Boolean)
      .join(':');

    return keyParts;
  }
}

