import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '@/entities/user.entity';
import { ProvincialControlLine } from '@/entities/provincial-control-line.entity';
import { UsersRepository } from './repositories/users.repository';

/**
 * 用户模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, ProvincialControlLine]),
    ConfigModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}

