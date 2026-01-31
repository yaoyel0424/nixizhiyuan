import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Portrait } from '@/entities/portrait.entity';
import { Element } from '@/entities/element.entity';
import { Scale } from '@/entities/scale.entity';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { FourQuadrant } from '@/entities/four-quadrant.entity';
import { QuadrantChallenge } from '@/entities/quadrant-1-challenge.entity';
import { QuadrantNiche } from '@/entities/quadrant-1-niche.entity';
import { Quadrant2LifeChallenge } from '@/entities/quadrant-2-life-challenge.entity';
import { Quadrant2FeasibilityStudy } from '@/entities/quadrant-2-feasibility-study.entity';
import { Quadrant3Weakness } from '@/entities/quadrant-3-weakness.entity';
import { Quadrant3Compensation } from '@/entities/quadrant-3-compensation.entity';
import { Quadrant4Dilemma } from '@/entities/quadrant-4-dilemma.entity';
import { Quadrant4GrowthPath } from '@/entities/quadrant-4-growth-path.entity';
import { PortraitsController } from './portraits.controller';
import { PortraitsService } from './portraits.service';

/**
 * 画像模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Portrait,
      Element,
      Scale,
      ScaleAnswer,
      FourQuadrant,
      QuadrantChallenge,
      QuadrantNiche,
      Quadrant2LifeChallenge,
      Quadrant2FeasibilityStudy,
      Quadrant3Weakness,
      Quadrant3Compensation,
      Quadrant4Dilemma,
      Quadrant4GrowthPath,
    ]),
  ],
  controllers: [PortraitsController],
  providers: [PortraitsService],
  exports: [PortraitsService],
})
export class PortraitsModule {}

