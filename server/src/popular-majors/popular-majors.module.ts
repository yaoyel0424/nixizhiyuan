import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PopularMajor } from '@/entities/popular-major.entity';
import { PopularMajorsService } from './popular-majors.service';
import { PopularMajorsController } from './popular-majors.controller';

/**
 * 热门专业模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([PopularMajor])],
  controllers: [PopularMajorsController],
  providers: [PopularMajorsService],
  exports: [PopularMajorsService],
})
export class PopularMajorsModule {}

