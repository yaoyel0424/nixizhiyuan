import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '@/entities/agent.entity';
import { User } from '@/entities/user.entity';
import { RedisModule } from '@/redis/redis.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

/**
 * 代理商模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([Agent, User]), RedisModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
