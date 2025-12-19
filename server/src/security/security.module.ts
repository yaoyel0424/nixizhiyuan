import { Module, Global, MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';
import { RedisModule } from '@/redis/redis.module';
import { SecurityLogService } from '@/common/services/security-log.service';
import { IpBlockGuard } from '@/common/guards/ip-block.guard';
import { RateLimitGuard } from '@/common/guards/rate-limit.guard';
import { SecurityMiddleware } from '@/common/middleware/security.middleware';

/**
 * 安全模块
 * 提供 IP 封禁、速率限制、安全日志等功能
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [SecurityLogService, IpBlockGuard, RateLimitGuard, SecurityMiddleware],
  exports: [SecurityLogService, IpBlockGuard, RateLimitGuard, SecurityMiddleware],
})
export class SecurityModule implements NestModule, OnModuleInit {
  constructor(
    private readonly securityLogService: SecurityLogService,
    private readonly ipBlockGuard: IpBlockGuard,
  ) {}

  onModuleInit() {
    // 设置 IpBlockGuard 到 SecurityLogService，避免循环依赖
    this.securityLogService.setIpBlockGuard(this.ipBlockGuard);
  }

  configure(consumer: MiddlewareConsumer) {
    // 安全中间件已在 AppModule 中注册，这里不需要重复注册
  }
}

