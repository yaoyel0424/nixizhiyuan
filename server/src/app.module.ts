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
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
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
    RedisModule,
    LoggerModule,
    AuthModule,
    UsersModule,
    HealthModule,
    PopularMajorsModule,
    ScalesModule,
    ScoresModule,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 应用安全头中间件
    consumer.apply(helmet()).forRoutes('*');
    // 应用响应压缩中间件
    consumer.apply(compression()).forRoutes('*');
  }
}

