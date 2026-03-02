import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '@/entities/agent.entity';
import { User } from '@/entities/user.entity';
import { RedisModule } from '@/redis/redis.module';
import { PayModule } from '@/pay/pay.module';
import { UsersModule } from '@/users/users.module';
import { EntitlementGuard } from '@/common/guards/entitlement.guard';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

/**
 * 代理商模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, User]),
    RedisModule,
    forwardRef(() => PayModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [AgentController],
  providers: [AgentService, EntitlementGuard],
  exports: [AgentService],
})
export class AgentModule {}
