import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query, 
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MajorsService } from './majors.service';
import { CreateMajorFavoriteDto } from './dto/create-major-favorite.dto';
import { QueryMajorFavoriteDto } from './dto/query-major-favorite.dto';
import {
  MajorFavoriteResponseDto,
  MajorFavoriteDetailResponseDto,
  UserFavoritesResponseDto,
} from './dto/major-favorite-response.dto';
import { MajorDetailResponseDto } from './dto/major-detail-response.dto';
import { ScoreResponseDto } from '@/scores/dto/score-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Cache } from '@/common/decorators/cache.decorator';
import { User } from '@/entities/user.entity';
import { plainToInstance } from 'class-transformer';
import { Request } from 'express';

/**
 * 专业收藏控制器
 */
@ApiTags('专业')
@Controller('majors')
@ApiBearerAuth()
export class MajorsController {
  constructor(private readonly majorsService: MajorsService) {}

  /**
   * 通过专业代码获取专业详细信息
   * 支持可选认证：如果用户已登录，会返回用户对元素的分数
   * 使用 Redis 缓存，默认缓存 10 分钟
   */
  @Get('detail/:majorCode')
  @Cache(600) // 缓存 10 分钟（600秒），可通过环境变量配置
  @ApiOperation({ summary: '通过专业代码获取专业详细信息' })
  @ApiParam({
    name: 'majorCode',
    description: '专业代码',
    example: '010101',
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: MajorDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: '专业详情不存在' })
  async getMajorDetail(
    @Param('majorCode') majorCode: string,
    @Req() req: Request,
  ): Promise<MajorDetailResponseDto> {
    // 尝试从请求中获取用户信息（如果已认证）
    const user = req.user as User | undefined;
    const majorDetail = await this.majorsService.getMajorDetailByCode(
      majorCode,
      user?.id,
    );
    return plainToInstance(MajorDetailResponseDto, majorDetail, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * 收藏专业
   */
  @Post('favorites')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '收藏专业' })
  @ApiResponse({
    status: 201,
    description: '收藏成功',
    type: MajorFavoriteResponseDto,
  })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 404, description: '专业不存在' })
  @ApiResponse({ status: 409, description: '该专业已收藏' })
  async createFavorite(
    @CurrentUser() user: any,
    @Body() createDto: CreateMajorFavoriteDto,
  ): Promise<MajorFavoriteResponseDto> {
    const favorite = await this.majorsService.createFavorite(
      user.id,
      createDto,
    );
    return plainToInstance(MajorFavoriteResponseDto, favorite, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * 取消收藏专业
   */
  @Delete('favorites/:majorCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消收藏专业' })
  @ApiParam({
    name: 'majorCode',
    description: '专业代码',
    example: '010101',
  })
  @ApiResponse({ status: 200, description: '取消收藏成功' })
  @ApiResponse({ status: 404, description: '收藏记录不存在' })
  async removeFavorite(
    @CurrentUser() user: any,
    @Param('majorCode') majorCode: string,
  ): Promise<{ message: string }> {
    await this.majorsService.removeFavorite(user.id, majorCode);
    return { message: '取消收藏成功' };
  }

  /**
   * 查询用户的收藏列表（分页）
   * 返回用户信息和收藏专业的列表，包括专业的匹配分数
   */
  @Get('favorites')
  @ApiOperation({ summary: '查询用户的收藏列表（包含用户信息和专业分数）' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: UserFavoritesResponseDto,
  })
  async findFavorites(
    @CurrentUser() user: any,
    @Query() queryDto: QueryMajorFavoriteDto,
  ): Promise<UserFavoritesResponseDto> {
    const result = await this.majorsService.findFavorites(user.id, queryDto);
    
    // 转换用户信息
    const userInfo = { 
      nickname: result.user.nickname, 
    };

    // 转换收藏列表，包含专业信息和分数
    const items = result.items.map((item) => {
      // 先转换主要字段（使用 DTO）
      const itemDto = plainToInstance(MajorFavoriteDetailResponseDto, {
        id: item.id,
        userId: item.userId,
        majorCode: item.majorCode,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        score: item.score,
        lexueScore: item.lexueScore,
        shanxueScore: item.shanxueScore,
        yanxueDeduction: item.yanxueDeduction,
        tiaozhanDeduction: item.tiaozhanDeduction,
      }, {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      });

      // 手动添加 major 对象（不使用 DTO 转换，避免嵌套对象字段被过滤）
      if (item.major) {
        itemDto.major = {
          id: item.major.id,
          name: item.major.name,
          code: item.major.code,
          level: item.major.level,
          eduLevel: item.major.eduLevel,
          brief: item.major.majorDetail?.majorBrief || null,
        };
      }

      return itemDto;
    });

    // 直接返回对象，不使用 plainToInstance 转换顶层对象
    // 因为嵌套对象的字段无法通过 @Expose() 正确过滤
    return {
      user: userInfo,
      items,
      meta: result.meta,
    } as UserFavoritesResponseDto;
  }

  /**
   * 检查是否已收藏某个专业
   */
  @Get('favorites/check/:majorCode')
  @ApiOperation({ summary: '检查是否已收藏某个专业' })
  @ApiParam({
    name: 'majorCode',
    description: '专业代码',
    example: '010101',
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      type: 'object',
      properties: {
        isFavorite: {
          type: 'boolean',
          description: '是否已收藏',
        },
      },
    },
  })
  async checkFavorite(
    @CurrentUser() user: any,
    @Param('majorCode') majorCode: string,
  ): Promise<{ isFavorite: boolean }> {
    const isFavorite = await this.majorsService.isFavorite(
      user.id,
      majorCode,
    );
    return { isFavorite };
  }

  /**
   * 获取用户的收藏数量
   */
  @Get('favorites/count')
  @ApiOperation({ summary: '获取用户的收藏数量' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: '收藏数量',
        },
      },
    },
  })
  async getFavoriteCount(
    @CurrentUser() user: any,
  ): Promise<{ count: number }> {
    const count = await this.majorsService.getFavoriteCount(user.id);
    return { count };
  }

  /**
   * 通过学校代码查询专业并返回专业分数
   * @param user 当前用户
   * @param schoolCode 学校代码
   * @returns 专业分数列表
   */
  @Get('school-majors/:schoolCode/scores')
  @ApiOperation({ summary: '通过学校代码查询专业并返回专业分数' })
  @ApiParam({
    name: 'schoolCode',
    description: '学校代码',
    example: '10001',
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: [ScoreResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: '参数错误',
  })
  async getSchoolMajorsWithScores(
    @CurrentUser() user: any,
    @Param('schoolCode') schoolCode: string,
  ): Promise<ScoreResponseDto[]> {
    const scores = await this.majorsService.getSchoolMajorsWithScores(
      user.id,
      schoolCode,
    );

    return plainToInstance(ScoreResponseDto, scores, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * 通过专业代码获取热门专业详细信息
   * 支持可选认证：如果用户已登录，会返回用户对元素的分数（从 popular_major_answers 表查询）
   * 使用 Redis 缓存，默认缓存 10 分钟
   */
  @Get('popular-majors/detail/:majorCode')
  @Cache(10) // 缓存 10 分钟（600秒），可通过环境变量配置
  @ApiOperation({ summary: '通过专业代码获取热门专业详细信息' })
  @ApiParam({
    name: 'majorCode',
    description: '专业代码',
    example: '010101',
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: MajorDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: '热门专业详情不存在' })
  async getPopularMajorDetail(
    @Param('majorCode') majorCode: string,
    @Req() req: Request,
  ): Promise<MajorDetailResponseDto> {
    // 尝试从请求中获取用户信息（如果已认证）
    const user = req.user as User | undefined;
    const majorDetail = await this.majorsService.getPopularMajorDetailByCode(
      majorCode,
      user?.id,
    );
    return plainToInstance(MajorDetailResponseDto, majorDetail, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }
}

