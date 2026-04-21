import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Major } from '@/entities/major.entity';
import { MajorDetail } from '@/entities/major-detail.entity';
import { EnrollmentPlan } from '@/entities/enrollment-plan.entity';
import { Province } from '@/entities/province.entity';
import { ProvinceBatch } from '@/entities/province_batch.entity';
import { AnonymousUser } from '@/entities/anonymous-user.entity';
import { AnonymousScaleAnswer } from '@/entities/anonymous-scale-answer.entity';
import { Scale } from '@/entities/scale.entity';
import { MajorsModule } from '@/majors/majors.module';
import { EnrollPlanModule } from '@/enroll-plan/enroll-plan.module';
import { KioskController } from './kiosk.controller';
import { KioskService } from './kiosk.service';
import { KioskEnrollmentScoresService } from './kiosk-enrollment-scores.service';
import { KioskAnonymousMajorScoreService } from './kiosk-anonymous-major-score.service';

/**
 * 自助终端模块（查询展示类接口）
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Major,
      MajorDetail,
      EnrollmentPlan,
      Province,
      ProvinceBatch,
      AnonymousUser,
      AnonymousScaleAnswer,
      Scale,
    ]),
    MajorsModule,
    EnrollPlanModule,
  ],
  controllers: [KioskController],
  providers: [
    KioskService,
    KioskEnrollmentScoresService,
    KioskAnonymousMajorScoreService,
  ],
})
export class KioskModule {}
