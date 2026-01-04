import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { plainToInstance } from 'class-transformer';
import { isValidProvinceName } from '@/config/province';

/**
 * 用户控制器
 */
@ApiTags('用户管理')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '创建用户' })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  } 

  @Get(':id')
  @ApiOperation({ summary: '获取用户详情' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findOne(id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: '更新用户' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(id, updateUserDto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: '删除用户' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.usersService.remove(id);
    return { message: '删除成功' };
  }

  /**
   * 更新用户选科和分数信息
   * @param user 当前用户
   * @param updateData 更新数据
   * @returns 更新后的用户信息
   */
  @Put('/profile')
  @ApiOperation({ summary: '更新用户选科和分数信息' })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '参数错误',
  })
  @ApiResponse({
    status: 404,
    description: '用户不存在',
  })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateData: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    // 验证省份
    if (updateData.province && !isValidProvinceName(updateData.province)) {
      throw new BadRequestException('无效的省份');
    }

    // 验证首选科目
    const validPrimarySubjects = ['物理', '历史', '综合', '文科', '理科'];
    if (
      updateData.preferredSubjects &&
      !validPrimarySubjects.includes(updateData.preferredSubjects)
    ) {
      throw new BadRequestException('无效的首选科目');
    }

    // 验证次选科目（可以是多个，用逗号分隔）
    if (
      updateData.secondarySubjects &&
      updateData.preferredSubjects !== '文科' &&
      updateData.preferredSubjects !== '理科'
    ) {
      const validSecondarySubjects = [
        '物理',
        '化学',
        '生物',
        '政治',
        '历史',
        '地理',
        '技术',
      ];
      const subjects = updateData.secondarySubjects
        .split(',')
        .map((s) => s.trim());
      const isValid = subjects.every((s) =>
        validSecondarySubjects.includes(s),
      );
      if (!isValid) {
        throw new BadRequestException('无效的次选科目');
      }

      // 验证物理和历史的互斥关系
      if (
        updateData.preferredSubjects === '物理' &&
        subjects.includes('历史')
      ) {
        throw new BadRequestException(
          '首选科目为物理时，次选科目不能包含历史',
        );
      }
      if (
        updateData.preferredSubjects === '历史' &&
        subjects.includes('物理')
      ) {
        throw new BadRequestException(
          '首选科目为历史时，次选科目不能包含物理',
        );
      }
    }

    // 验证分数范围
    if (
      updateData.score !== undefined &&
      (updateData.score < 0 || updateData.score > 750)
    ) {
      throw new BadRequestException('无效的分数范围（0-750）');
    }

    // 验证排名范围
    if (updateData.rank !== undefined && updateData.rank < 0) {
      throw new BadRequestException('无效的位次范围（必须大于等于0）');
    }

    const updatedUser = await this.usersService.updateProfile(user.id, updateData);

    return plainToInstance(UserResponseDto, updatedUser, {
      excludeExtraneousValues: true,
    });
  }
}

