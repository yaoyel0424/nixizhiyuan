import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { Scale } from '@/entities/scale.entity';
import { ScaleOption } from '@/entities/scale-option.entity';
import { User } from '@/entities/user.entity';
import { Snapshot } from '@/entities/snapshot.entity';
import { MajorElementAnalysis } from '@/entities/major-analysis.entity';
import { PopularMajor } from '@/entities/popular-major.entity';
import { PopularMajorAnswer } from '@/entities/popular-major-answer.entity';
import { PayModule } from '@/pay/pay.module';
import { EntitlementGuard } from '@/common/guards/entitlement.guard';
import { ScalesService } from './scales.service';
import { ScalesController } from './scales.controller';

/**
 * 量表模块
 */
@Module({
  imports: [
    PayModule,
    TypeOrmModule.forFeature([
      ScaleAnswer,
      Scale,
      ScaleOption,
      User,
      Snapshot,
      MajorElementAnalysis,
      PopularMajor,
      PopularMajorAnswer,
    ]),
  ],
  controllers: [ScalesController],
  providers: [ScalesService, EntitlementGuard],
  exports: [ScalesService],
})
export class ScalesModule {}

