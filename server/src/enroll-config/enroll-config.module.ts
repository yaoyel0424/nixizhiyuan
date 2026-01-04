import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EnrollConfigController } from './enroll-config.controller';
import { EnrollConfigService } from './enroll-config.service';
import { ScoreRange } from '@/entities/score-range.entity';

/**
 * 招生配置模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ScoreRange]),
    ConfigModule,
  ],
  controllers: [EnrollConfigController],
  providers: [EnrollConfigService],
  exports: [EnrollConfigService],
})
export class EnrollConfigModule {}

