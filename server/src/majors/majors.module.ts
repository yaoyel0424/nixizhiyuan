import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { Major } from '@/entities/major.entity';
import { MajorDetail } from '@/entities/major-detail.entity';
import { MajorElementAnalysis } from '@/entities/major-analysis.entity';
import { Element } from '@/entities/element.entity';
import { Scale } from '@/entities/scale.entity';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { PopularMajor } from '@/entities/popular-major.entity';
import { PopularMajorAnswer } from '@/entities/popular-major-answer.entity';
import { User } from '@/entities/user.entity';
import { SchoolMajor } from '@/entities/school-major.entity';
import { RedisModule } from '@/redis/redis.module';
import { ScoresModule } from '@/scores/scores.module';
import { PayModule } from '@/pay/pay.module';
import { EntitlementGuard } from '@/common/guards/entitlement.guard';
import { MajorsController } from './majors.controller';
import { MajorsService } from './majors.service';
import { CacheInterceptor } from '@/common/interceptors/cache.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

/**
 * 专业收藏模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MajorFavorite,
      Major,
      MajorDetail,
      MajorElementAnalysis,
      Element,
      Scale,
      ScaleAnswer,
      PopularMajor,
      PopularMajorAnswer,
      User,
      SchoolMajor,
    ]),
    RedisModule,
    ScoresModule,
    PayModule,
  ],
  controllers: [MajorsController],
  providers: [
    MajorsService,
    EntitlementGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
  exports: [MajorsService],
})
export class MajorsModule {}

