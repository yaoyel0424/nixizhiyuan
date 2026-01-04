import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvinceFavorite } from '@/entities/province-favorite.entity';
import { Province } from '@/entities/province.entity';
import { School } from '@/entities/school.entity';
import { ProvincesController } from './provinces.controller';
import { ProvincesService } from './provinces.service';

/**
 * 省份模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([Province, ProvinceFavorite, School])],
  controllers: [ProvincesController],
  providers: [ProvincesService],
  exports: [ProvincesService],
})
export class ProvincesModule {}

