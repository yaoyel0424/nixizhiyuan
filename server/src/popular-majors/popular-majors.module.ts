import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PopularMajor } from '@/entities/popular-major.entity';
import { MajorElementAnalysis } from '@/entities/major-analysis.entity';
import { Scale } from '@/entities/scale.entity';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { PopularMajorAnswer } from '@/entities/popular-major-answer.entity';
import { PopularMajorsService } from './popular-majors.service';
import { PopularMajorsController } from './popular-majors.controller';
import { ScoresModule } from '../scores/scores.module';

/**
 * 热门专业模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PopularMajor,
      MajorElementAnalysis,
      Scale,
      ScaleAnswer,
      PopularMajorAnswer,
    ]),
    ScoresModule,
  ],
  controllers: [PopularMajorsController],
  providers: [PopularMajorsService],
  exports: [PopularMajorsService],
})
export class PopularMajorsModule {}

