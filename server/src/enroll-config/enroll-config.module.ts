import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EnrollConfigController } from './enroll-config.controller';
import { EnrollConfigService } from './enroll-config.service';
import { UsersModule } from '@/users/users.module';
import { ScoreRange } from '@/entities/score-range.entity';
import { ProvincialControlLine } from '@/entities/provincial-control-line.entity';
import { User } from '@/entities/user.entity';
import { Province } from '@/entities/province.entity';

/**
 * 招生配置模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ScoreRange, ProvincialControlLine, User, Province]),
    ConfigModule,
    UsersModule,
  ],
  controllers: [EnrollConfigController],
  providers: [EnrollConfigService],
  exports: [EnrollConfigService],
})
export class EnrollConfigModule {}

