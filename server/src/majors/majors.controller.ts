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
} from '@nestjs/swagger';
import { MajorsService } from './majors.service';
import { CreateMajorFavoriteDto } from './dto/create-major-favorite.dto';
import { QueryMajorFavoriteDto } from './dto/query-major-favorite.dto';
import {
  MajorFavoriteResponseDto,
  MajorFavoriteDetailResponseDto,
} from './dto/major-favorite-response.dto';
import { MajorDetailResponseDto } from './dto/major-detail-response.dto';
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
    @CurrentUser() user: User,
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
    @CurrentUser() user: User,
    @Param('majorCode') majorCode: string,
  ): Promise<{ message: string }> {
    await this.majorsService.removeFavorite(user.id, majorCode);
    return { message: '取消收藏成功' };
  }

  /**
   * 查询用户的收藏列表（分页）
   */
  @Get('favorites')
  @ApiOperation({ summary: '查询用户的收藏列表' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: [MajorFavoriteDetailResponseDto],
  })
  async findFavorites(
    @CurrentUser() user: User,
    @Query() queryDto: QueryMajorFavoriteDto,
  ) {
    const result = await this.majorsService.findFavorites(user.id, queryDto);
    return {
      items: plainToInstance(MajorFavoriteDetailResponseDto, result.items, {
        excludeExtraneousValues: true,
      }),
      meta: result.meta,
    };
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
    @CurrentUser() user: User,
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
    @CurrentUser() user: User,
  ): Promise<{ count: number }> {
    const count = await this.majorsService.getFavoriteCount(user.id);
    return { count };
  }
}

