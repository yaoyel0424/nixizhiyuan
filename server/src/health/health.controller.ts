import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  HealthCheckResult,
  HealthIndicatorResult,
  HealthIndicatorStatus,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RedisService } from '../redis/redis.service';

/**
 * 健康检查控制器
 */
@ApiTags('健康检查')
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private redisService: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: '健康检查' })
  async check(): Promise<HealthCheckResult> {
    // 检查 Redis 连接
    let redisStatus: HealthIndicatorStatus = 'up';
    try {
      await this.redisService.get('health-check');
    } catch (error) {
      redisStatus = 'down';
    }

    return this.health.check([
      // 数据库连接检查
      () => this.db.pingCheck('database'),
      // 内存检查
      () =>
        this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
      () =>
        this.memory.checkRSS('memory_rss', 150 * 1024 * 1024), // 150MB
      // Redis 连接检查
      async (): Promise<HealthIndicatorResult> => {
        return {
          redis: {
            status: redisStatus,
          },
        };
      },
    ]);
  }
}

