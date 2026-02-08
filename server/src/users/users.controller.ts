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
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRelatedDataResponseDto } from './dto/user-related-data-response.dto';
import { ProvinceBatchesResponseDto } from './dto/province-batches-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator'; 
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

  /**
   * 获取当前用户相关数据的数量统计
   * @param user 当前用户
   * @returns 用户相关数据的数量统计
   */
  @Get('/related-data-count')
  @ApiOperation({ summary: '获取当前用户相关数据的数量统计' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: UserRelatedDataResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '用户不存在',
  })
  async getUserRelatedDataCount(
    @CurrentUser() user: any,
  ): Promise<UserRelatedDataResponseDto> {
    return await this.usersService.getUserRelatedDataCount(user.id);
  }

  /**
   * 查询指定省份、年份下所有批次，并标记最符合分数的批次（可选传入 score，不传则用当前用户分数）
   */
  @Get('province-batches')
  @ApiOperation({ summary: '查询省份年份下所有批次并标记最符合分数批次' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: ProvinceBatchesResponseDto,
  })
  @ApiResponse({ status: 400, description: '缺少省份或年份' })
  async getProvinceBatches(
    @CurrentUser() user: any,
    @Query('province') province: string,
    @Query('year') year: string,
    @Query('score') scoreStr?: string,
  ): Promise<ProvinceBatchesResponseDto> {
    if (!province?.trim() || !year?.trim()) {
      throw new BadRequestException('请提供省份(province)和年份(year)');
    }
    const score =
      scoreStr !== undefined && scoreStr !== ''
        ? parseInt(scoreStr, 10)
        : (user.score ?? undefined);
    if (scoreStr !== undefined && scoreStr !== '' && Number.isNaN(score)) {
      throw new BadRequestException('分数(score)必须为数字');
    }
    return this.usersService.getProvinceBatchesWithMatch(
      province.trim(),
      year.trim(),
      score,
    );
  }

  /**
   * 更新当前用户昵称
   * @param user 当前用户
   * @param updateNicknameDto 更新昵称 DTO
   * @returns 更新后的用户信息
   */
  @Patch('/nickname')
  @ApiOperation({ summary: '更新当前用户昵称' })
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
  async updateNickname(
    @CurrentUser() user: any,
    @Body() updateNicknameDto: UpdateNicknameDto,
  ): Promise<UserResponseDto> {
    const nickname = (updateNicknameDto.nickname || '').trim();
    if (!nickname) {
      throw new BadRequestException('昵称不能为空');
    }

    const updatedUser = await this.usersService.updateNickname(user.id, nickname);
    return plainToInstance(UserResponseDto, updatedUser, {
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
    // await this.usersService.remove(id);
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

    // 验证分数范围（根据省份设置不同的最高分限制）
    if (updateData.score !== undefined && updateData.score < 0) {
      throw new BadRequestException('分数不能小于0');
    }
    
    if (updateData.score !== undefined) {
      // 获取省份（优先使用 updateData.province，否则从数据库获取当前用户的省份）
      let province: string | null = updateData.province || null;
      if (!province) {
        const currentUser = await this.usersService.findOne(user.id);
        province = currentUser?.province || null;
      }
      
      // 根据省份设置不同的最高分限制
      let maxScore: number;
      if (province === '海南') {
        maxScore = 900;
      } else if (province === '上海') {
        maxScore = 660;
      } else {
        maxScore = 750;
      }
      
      if (updateData.score > maxScore) {
        const provinceName = province || '当前省份';
        throw new BadRequestException(
          `无效的分数范围（0-${maxScore}），${provinceName}的最高分不能超过${maxScore}分`,
        );
      }
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

