import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { Major } from '@/entities/major.entity';
import { MajorsController } from './majors.controller';
import { MajorsService } from './majors.service';

/**
 * 专业收藏模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([MajorFavorite, Major])],
  controllers: [MajorsController],
  providers: [MajorsService],
  exports: [MajorsService],
})
export class MajorsModule {}

