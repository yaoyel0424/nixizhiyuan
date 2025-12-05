import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
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
} from '@nestjs/swagger';
import { ProvincesService } from './provinces.service';
import { CreateProvinceFavoriteDto } from './dto/create-province-favorite.dto';
import {
  ProvincesListResponseDto,
  ProvinceFavoriteResponseDto,
  ProvinceFavoriteDetailResponseDto,
} from './dto/province-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '@/entities/user.entity';
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
    @CurrentUser() user: User,
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
    @CurrentUser() user: User,
  ): Promise<{ count: number }> {
    const count = await this.provincesService.getFavoriteCount(user.id);
    return { count };
  }
}

