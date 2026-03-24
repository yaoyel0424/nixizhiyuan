import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningStepController } from './learning-step.controller';
import { LearningStepService } from './learning-step.service';
import { LearningStepCard } from '@/entities/learning-step-card.entity';
import { LearningStepPhaseTitle } from '@/entities/learning-step-phase-title.entity';
import { LearningPhaseRedlightItem } from '@/entities/learning-phase-redlight-item.entity';
import { LearningPhaseStartDoingItem } from '@/entities/learning-phase-start-doing-item.entity';
import { LearningStep4MethodItem } from '@/entities/learning-step4-method-item.entity';
import { Element } from '@/entities/element.entity';
import { GaokaoMathModuleStat } from '@/entities/gaokao-math-module-stat.entity';
import { PortraitsModule } from '@/portraits/portraits.module';

/**
 * 学习步骤模块
 */
@Module({
  imports: [
    PortraitsModule,
    TypeOrmModule.forFeature([
      LearningStepCard,
      LearningStepPhaseTitle,
      LearningPhaseRedlightItem,
      LearningPhaseStartDoingItem,
      LearningStep4MethodItem,
      Element,
      GaokaoMathModuleStat,
    ]),
  ],
  controllers: [LearningStepController],
  providers: [LearningStepService],
  exports: [LearningStepService],
})
export class LearningStepModule {}
