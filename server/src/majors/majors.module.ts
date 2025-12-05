import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { Major } from '@/entities/major.entity';
import { MajorDetail } from '@/entities/major-detail.entity';
import { MajorElementAnalysis } from '@/entities/major-analysis.entity';
import { Element } from '@/entities/element.entity';
import { Scale } from '@/entities/scale.entity';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { MajorsController } from './majors.controller';
import { MajorsService } from './majors.service';

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
    ]),
  ],
  controllers: [MajorsController],
  providers: [MajorsService],
  exports: [MajorsService],
})
export class MajorsModule {}

