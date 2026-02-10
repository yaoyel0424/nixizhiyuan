import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentPlan } from '@/entities/enrollment-plan.entity';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { Major } from '@/entities/major.entity';
import { User } from '@/entities/user.entity';
import { School } from '@/entities/school.entity';
import { SchoolDetail } from '@/entities/school-detail.entity';
import { MajorScore } from '@/entities/major-score.entity';
import { ProvinceFavorite } from '@/entities/province-favorite.entity';
import { Province } from '@/entities/province.entity';
import { ProvinceBatch } from '@/entities/province_batch.entity';
import { ScoresModule } from '@/scores/scores.module';
import { EnrollPlanController } from './enroll-plan.controller';
import { ConfigModule } from '@nestjs/config';
import { EnrollPlanService } from './enroll-plan.service';

/**
 * 招生计划模块
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      EnrollmentPlan,
      MajorFavorite,
      Major,
      User,
      School,
      SchoolDetail,
      MajorScore,
      ProvinceFavorite,
      Province,
      ProvinceBatch,
    ]),
    ScoresModule,
  ],
  controllers: [EnrollPlanController],
  providers: [EnrollPlanService],
  exports: [EnrollPlanService],
})
export class EnrollPlanModule {}


