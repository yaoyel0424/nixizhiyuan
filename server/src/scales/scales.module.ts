import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { Scale } from '@/entities/scale.entity';
import { User } from '@/entities/user.entity';
import { MajorElementAnalysis } from '@/entities/major-analysis.entity';
import { PopularMajor } from '@/entities/popular-major.entity';
import { PopularMajorAnswer } from '@/entities/popular-major-answer.entity';
import { ScalesService } from './scales.service';
import { ScalesController } from './scales.controller';

/**
 * 量表模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScaleAnswer,
      Scale,
      User,
      MajorElementAnalysis,
      PopularMajor,
      PopularMajorAnswer,
    ]),
  ],
  controllers: [ScalesController],
  providers: [ScalesService],
  exports: [ScalesService],
})
export class ScalesModule {}

