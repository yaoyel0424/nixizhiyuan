import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PopularMajorsService } from './popular-majors.service';
import { QueryPopularMajorDto } from './dto/query-popular-major.dto';
import { PopularMajorResponseDto } from './dto/popular-major-response.dto';
import { plainToInstance } from 'class-transformer';

/**
 * 热门专业控制器
 */
@ApiTags('热门专业')
@ApiBearerAuth()
@Controller('popular-majors')
export class PopularMajorsController {
  constructor(private readonly popularMajorsService: PopularMajorsService) {}

  @Get()
  @ApiOperation({ summary: '获取热门专业列表（支持分页、排序、筛选）' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: PopularMajorResponseDto,
    isArray: true,
  })
  @ApiQuery({ name: 'page', required: false, description: '页码，默认为 1' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量，默认为 10' })
  @ApiQuery({ name: 'sortBy', required: false, description: '排序字段，默认为 id' })
  @ApiQuery({ name: 'sortOrder', required: false, description: '排序方向，ASC 或 DESC，默认为 ASC' })
  @ApiQuery({ name: 'level1', required: false, description: '教育层次筛选（ben: 本科, zhuan: 专科, gao_ben: 高职本科）' })
  @ApiQuery({ name: 'name', required: false, description: '专业名称搜索（模糊匹配）' })
  @ApiQuery({ name: 'code', required: false, description: '专业代码搜索' })
  async findAll(@Query() queryDto: QueryPopularMajorDto) {
    const result = await this.popularMajorsService.findAll(queryDto);
    return {
      items: plainToInstance(PopularMajorResponseDto, result.items, {
        excludeExtraneousValues: true,
      }),
      meta: result.meta,
    };
  }

  @Get('level/:level1')
  @ApiOperation({ summary: '根据教育层次获取热门专业列表' })
  @ApiParam({ name: 'level1', description: '教育层次（ben: 本科, zhuan: 专科, gao_ben: 高职本科）' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: PopularMajorResponseDto,
    isArray: true,
  })
  async findByLevel1(
    @Param('level1') level1: string,
  ): Promise<PopularMajorResponseDto[]> {
    const popularMajors = await this.popularMajorsService.findByLevel1(level1);
    return plainToInstance(PopularMajorResponseDto, popularMajors, {
      excludeExtraneousValues: true,
    });
  }
}

