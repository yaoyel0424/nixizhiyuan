import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Portrait } from '@/entities/portrait.entity';
import { Element } from '@/entities/element.entity';
import { Scale } from '@/entities/scale.entity';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { FourQuadrant } from '@/entities/four-quadrant.entity';
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
    ]),
  ],
  controllers: [PortraitsController],
  providers: [PortraitsService],
  exports: [PortraitsService],
})
export class PortraitsModule {}

