import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PopularMajor } from '@/entities/popular-major.entity';
import { ScoresService } from './scores.service';
import { ScoresController } from './scores.controller';
import { LoggerModule } from '@/logger/logger.module';

/**
 * 专业分数模块
 * 处理专业匹配分数计算
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PopularMajor]),
    LoggerModule,
  ],
  controllers: [ScoresController],
  providers: [ScoresService],
  exports: [ScoresService],
})
export class ScoresModule {}

