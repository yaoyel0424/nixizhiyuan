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
  ParseIntPipe, 
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProvincesService } from './provinces.service';
import { CreateProvinceFavoriteDto } from './dto/create-province-favorite.dto';
import { BatchProvinceFavoritesDto } from './dto/batch-province-favorites.dto';
import {
  ProvincesListResponseDto,
  ProvinceFavoriteResponseDto,
  ProvinceFavoriteDetailResponseDto,
} from './dto/province-response.dto';
import { SchoolResponseDto } from './dto/school-response.dto';
import { QuerySchoolDto } from './dto/query-school.dto';
import {
  SchoolPaginationResponseDto,
  PaginationMetaDto,
} from './dto/school-pagination-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator'; 
import { plainToInstance } from 'class-transformer';

/**
 * 省份控制器
 */
@ApiTags('省份')
@Controller('provinces') 
@ApiBearerAuth()
export class ProvincesController {
  constructor(private readonly provincesService: ProvincesService) {}

  /**
   * 查询所有省份
   * 返回省份列表和类型列表（去重）
   */
  @Get()
  @ApiOperation({ summary: '查询所有省份' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: ProvincesListResponseDto,
  })
  async findAll(): Promise<ProvincesListResponseDto> {
    return await this.provincesService.findAll();
  }

  /**
   * 收藏省份
   */
  @Post('favorites')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '收藏省份' })
  @ApiResponse({
    status: 201,
    description: '收藏成功',
    type: ProvinceFavoriteResponseDto,
  })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 404, description: '省份不存在' })
  @ApiResponse({ status: 409, description: '该省份已收藏' })
  async createFavorite(
    @CurrentUser() user: any,
    @Body() createDto: CreateProvinceFavoriteDto,
  ): Promise<ProvinceFavoriteResponseDto> {
    const favorite = await this.provincesService.createFavorite(
      user.id,
      createDto,
    );
    return plainToInstance(ProvinceFavoriteResponseDto, favorite, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * 取消收藏省份
   */
  @Delete('favorites/:provinceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消收藏省份' })
  @ApiParam({
    name: 'provinceId',
    description: '省份ID',
    example: 11,
  })
  @ApiResponse({ status: 200, description: '取消收藏成功' })
  @ApiResponse({ status: 404, description: '收藏记录不存在' })
  async removeFavorite(
    @CurrentUser() user: any,
    @Param('provinceId', ParseIntPipe) provinceId: number,
  ): Promise<{ message: string }> {
    await this.provincesService.removeFavorite(user.id, provinceId);
    return { message: '取消收藏成功' };
  }

  /**
   * 通过数据方式批量添加收藏
   */
  @Post('favorites/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量添加收藏' })
  @ApiResponse({
    status: 200,
    description: '操作成功',
    schema: {
      type: 'object',
      properties: {
        added: { type: 'number', description: '本次新增的收藏数量' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '参数错误' })
  async batchAddFavorites(
    @CurrentUser() user: any,
    @Body() dto: BatchProvinceFavoritesDto,
  ): Promise<{ added: number }> {
    return await this.provincesService.batchAddFavorites(user.id, dto.provinceIds);
  }

  /**
   * 通过数据方式批量取消收藏
   */
  @Post('favorites/batch/remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量取消收藏' })
  @ApiResponse({
    status: 200,
    description: '操作成功',
    schema: {
      type: 'object',
      properties: {
        removed: { type: 'number', description: '本次取消的收藏数量' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '参数错误' })
  async batchRemoveFavorites(
    @CurrentUser() user: any,
    @Body() dto: BatchProvinceFavoritesDto,
  ): Promise<{ removed: number }> {
    return await this.provincesService.batchRemoveFavorites(user.id, dto.provinceIds);
  }

  /**
   * 查询用户的收藏列表
   */
  @Get('favorites')
  @ApiOperation({ summary: '查询用户的收藏列表' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: [ProvinceFavoriteDetailResponseDto],
  })
  async findFavorites(@CurrentUser() user: any) {
    const favorites = await this.provincesService.findFavorites(user.id);
    return plainToInstance(ProvinceFavoriteDetailResponseDto, favorites, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * 检查是否已收藏某个省份
   */
  @Get('favorites/check/:provinceId')
  @ApiOperation({ summary: '检查是否已收藏某个省份' })
  @ApiParam({
    name: 'provinceId',
    description: '省份ID',
    example: 11,
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
    @Param('provinceId', ParseIntPipe) provinceId: number,
  ): Promise<{ isFavorite: boolean }> {
    const isFavorite = await this.provincesService.isFavorite(
      user.id,
      provinceId,
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
    const count = await this.provincesService.getFavoriteCount(user.id);
    return { count };
  }

  /**
   * 通过省份名称查询院校（支持分页和按名称查询）
   * @param queryDto 查询参数
   * @returns 分页的院校列表
   */
  @Get('schools')
  @ApiOperation({ summary: '通过省份名称查询院校（支持分页和按名称查询）' })
  @ApiQuery({
    name: 'provinceName',
    description: '省份名称',
    example: '北京',
    required: true,
  })
  @ApiQuery({
    name: 'name',
    description: '学校名称（模糊查询）',
    example: '大学',
    required: false,
  })
  @ApiQuery({
    name: 'page',
    description: '页码',
    example: 1,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: '每页数量',
    example: 10,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: SchoolPaginationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '参数错误',
  })
  async findSchoolsByProvince(
    @Query() queryDto: QuerySchoolDto,
  ): Promise<SchoolPaginationResponseDto> {
    const result = await this.provincesService.findSchoolsByProvince(queryDto);

    return {
      items: plainToInstance(SchoolResponseDto, result.items, {
        excludeExtraneousValues: true,
      }),
      meta: plainToInstance(PaginationMetaDto, result.meta, {
        excludeExtraneousValues: true,
      }),
    };
  }
}

