import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Choice } from '@/entities/choices.entity';
import { User } from '@/entities/user.entity';
import { MajorGroup } from '@/entities/major-group.entity';
import { School } from '@/entities/school.entity';
import { SchoolDetail } from '@/entities/school-detail.entity';
import { ChoicesService } from './choices.service';
import { ChoicesController } from './choices.controller';

/**
 * 志愿选择模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Choice, User, MajorGroup, School, SchoolDetail]),
    ConfigModule,
  ],
  controllers: [ChoicesController],
  providers: [ChoicesService],
  exports: [ChoicesService],
})
export class ChoicesModule {}
