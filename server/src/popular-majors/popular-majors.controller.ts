import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { PopularMajorsService } from './popular-majors.service';
import { QueryPopularMajorDto } from './dto/query-popular-major.dto';
import { PopularMajorResponseDto } from './dto/popular-major-response.dto';
import { CreatePopularMajorAnswerDto } from './dto/create-popular-major-answer.dto';
import { QueryPopularMajorAnswerDto } from './dto/query-popular-major-answer.dto';
import { PopularMajorAnswerResponseDto } from './dto/popular-major-answer-response.dto';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

/**
 * 热门专业控制器
 */
@ApiTags('热门专业')
@ApiBearerAuth()
@Controller('popular-majors')
export class PopularMajorsController {
  constructor(private readonly popularMajorsService: PopularMajorsService) {}

  @Get()
  @ApiOperation({
    summary: '获取热门专业列表（支持分页、排序、筛选）',
    description: '如果用户已登录，将返回每个专业的填写进度和匹配分数',
  })
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
  async findAll(
    @Query() queryDto: QueryPopularMajorDto,
    @CurrentUser() user?: any,
  ) {
    const result = await this.popularMajorsService.findAll(
      queryDto,
      user?.id,
    );
    return {
      items: plainToInstance(PopularMajorResponseDto, result.items, {
        excludeExtraneousValues: true,
      }),
      meta: result.meta,
    };
  }

  @Get('level/:level1')
  @ApiOperation({
    summary: '根据教育层次获取热门专业列表',
    description: '如果用户已登录，将返回每个专业的填写进度和匹配分数',
  })
  @ApiParam({ name: 'level1', description: '教育层次（ben: 本科, zhuan: 专科, gao_ben: 高职本科）' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: PopularMajorResponseDto,
    isArray: true,
  })
  async findByLevel1(
    @Param('level1') level1: string,
    @CurrentUser() user?: any,
  ): Promise<PopularMajorResponseDto[]> {
    const popularMajors = await this.popularMajorsService.findByLevel1(
      level1,
      user?.id,
    );
    return plainToInstance(PopularMajorResponseDto, popularMajors, {
      excludeExtraneousValues: true,
    });
  }

  @Post('answers')
  @ApiOperation({ summary: '创建或更新热门专业问卷答案' })
  @ApiBody({
    type: CreatePopularMajorAnswerDto,
    description: '创建或更新热门专业问卷答案的请求体，如果答案已存在则更新',
  })
  @ApiResponse({
    status: 201,
    description: '创建或更新成功',
    type: PopularMajorAnswerResponseDto,
  })
  @ApiResponse({ status: 404, description: '热门专业不存在或量表不存在' })
  async createAnswer(
    @Body() createDto: CreatePopularMajorAnswerDto,
    @CurrentUser() user: any,
  ): Promise<PopularMajorAnswerResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('用户未登录');
    }
    const answer = await this.popularMajorsService.createAnswer(
      createDto,
      user.id,
    );
    return plainToInstance(PopularMajorAnswerResponseDto, answer, {
      excludeExtraneousValues: true,
    });
  }

  @Get('answers')
  @ApiOperation({
    summary: '查询热门专业问卷答案',
    description: '支持按用户、热门专业、量表等条件查询，支持分页',
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: PopularMajorAnswerResponseDto,
    isArray: true,
  })
  @ApiQuery({ name: 'page', required: false, description: '页码，默认为 1' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量，默认为 10' })
  @ApiQuery({ name: 'userId', required: false, description: '用户ID（可选，不传则查询当前登录用户）' })
  @ApiQuery({ name: 'popularMajorId', required: false, description: '热门专业ID（可选）' })
  @ApiQuery({ name: 'scaleId', required: false, description: '量表ID（可选）' })
  async findAnswers(
    @Query() queryDto: QueryPopularMajorAnswerDto,
    @CurrentUser() user?: any,
  ) {
    const result = await this.popularMajorsService.findAnswers(
      queryDto,
      user?.id,
    );
    return {
      items: plainToInstance(PopularMajorAnswerResponseDto, result.items, {
        excludeExtraneousValues: true,
      }),
      meta: result.meta,
    };
  }
}

