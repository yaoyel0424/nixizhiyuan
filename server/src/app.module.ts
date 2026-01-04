import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { LoggerModule } from './logger/logger.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { PopularMajorsModule } from './popular-majors/popular-majors.module';
import { ScalesModule } from './scales/scales.module';
import { ScoresModule } from './scores/scores.module';
import { MajorsModule } from './majors/majors.module';
import { ProvincesModule } from './provinces/provinces.module';
import { PortraitsModule } from './portraits/portraits.module';
import { EnrollConfigModule } from './enroll-config/enroll-config.module';
import { SecurityModule } from './security/security.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { IpBlockGuard } from './common/guards/ip-block.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { ResponseFormatInterceptor } from './common/interceptors/response-format.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helmet = require('helmet');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const compression = require('compression');

/**
 * 应用根模块
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule, // 启用 Redis 模块（安全功能需要）
    LoggerModule,
    SecurityModule, // 安全模块
    AuthModule,
    UsersModule,
    HealthModule,
    PopularMajorsModule,
    ScalesModule,
    ScoresModule,
    MajorsModule,
    ProvincesModule,
    PortraitsModule,
    EnrollConfigModule,
  ],
  providers: [
    // 全局异常过滤器
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // 全局拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseFormatInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    // 全局管道
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    // 全局守卫
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IpBlockGuard, // IP 封禁守卫
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard, // 速率限制守卫
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 应用安全中间件（恶意路径检测）- 最先执行
    consumer.apply(SecurityMiddleware).forRoutes('*');
    // 应用安全头中间件
    consumer.apply(helmet()).forRoutes('*');
    // 应用响应压缩中间件
    consumer.apply(compression()).forRoutes('*');
  }
}

