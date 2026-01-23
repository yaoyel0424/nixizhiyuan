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
import { Choice } from '@/entities/choices.entity';
import { UsersRepository } from './repositories/users.repository';
import { ContentSecurityService } from '@/common/services/content-security.service';

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
      Choice,
    ]),
    ConfigModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, ContentSecurityService],
  exports: [UsersService],
})
export class UsersModule {}

