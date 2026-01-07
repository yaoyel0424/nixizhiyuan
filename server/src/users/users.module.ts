import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '@/entities/user.entity';
import { ProvincialControlLine } from '@/entities/provincial-control-line.entity';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { ProvinceFavorite } from '@/entities/province-favorite.entity';
import { Alternative } from '@/entities/alternative.entity';
import { UsersRepository } from './repositories/users.repository';

/**
 * 用户模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ProvincialControlLine,
      ScaleAnswer,
      MajorFavorite,
      ProvinceFavorite,
      Alternative,
    ]),
    ConfigModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}

