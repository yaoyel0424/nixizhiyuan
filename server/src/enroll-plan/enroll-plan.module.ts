import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentPlan } from '@/entities/enrollment-plan.entity';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { Major } from '@/entities/major.entity';
import { User } from '@/entities/user.entity';
import { School } from '@/entities/school.entity';
import { SchoolDetail } from '@/entities/school-detail.entity';
import { MajorScore } from '@/entities/major-score.entity';
import { ScoresModule } from '@/scores/scores.module';
import { EnrollPlanController } from './enroll-plan.controller';
import { EnrollPlanService } from './enroll-plan.service';

/**
 * 招生计划模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnrollmentPlan,
      MajorFavorite,
      Major,
      User,
      School,
      SchoolDetail,
      MajorScore,
    ]),
    ScoresModule,
  ],
  controllers: [EnrollPlanController],
  providers: [EnrollPlanService],
  exports: [EnrollPlanService],
})
export class EnrollPlanModule {}


