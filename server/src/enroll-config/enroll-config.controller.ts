import {
  Controller,
  Get,
  Query,
  BadRequestException,
  NotFoundException, 
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth
} from '@nestjs/swagger';
import { GAOKAO_SUBJECT_CONFIG } from '@/config/gaokao-subjects';
import { EnrollConfigService } from './enroll-config.service';
import { GetScoreRangeDto } from './dto/get-score-range.dto';
import { ScoreRangeResponseDto } from './dto/score-range-response.dto';
import { plainToInstance } from 'class-transformer';

/**
 * 招生配置控制器
 * 处理高考科目配置相关的接口
 */
@ApiTags('招生配置')
@Controller('enroll-config')
@ApiBearerAuth()
export class EnrollConfigController {
  constructor(private readonly enrollConfigService: EnrollConfigService) {}

  /**
   * 获取高考科目配置信息
   * @returns 返回所有省份的高考科目配置信息
   */
  @Get('/gaokao')
  @ApiOperation({ summary: '获取高考科目配置信息' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
  })
  async getGaoKaoConfig() {
    return GAOKAO_SUBJECT_CONFIG;
  }

  /**
   * 获取分数范围信息
   * @param params 查询参数，包含 provinceName、subjectType、score
   * @returns 分数范围信息
   */
  @Get('/score-range')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取分数范围信息' })
  @ApiQuery({
    name: 'provinceName',
    description: '省份名称',
    example: '北京',
    required: true,
  })
  @ApiQuery({
    name: 'subjectType',
    description: '科目类型',
    example: '物理',
    required: true,
  })
  @ApiQuery({
    name: 'score',
    description: '分数键值',
    example: '650',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: ScoreRangeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '参数错误',
  })
  @ApiResponse({
    status: 404,
    description: '未找到对应的分数范围信息',
  })
  async getScoreRange(
    @Query() params: GetScoreRangeDto,
  ): Promise<ScoreRangeResponseDto> {
    const { provinceName, subjectType, score } = params;

    // 验证参数
    if (!provinceName || !subjectType || !score) {
      throw new BadRequestException(
        '缺少必要参数：provinceName、subjectType、score',
      );
    }

    const year = process.env.CURRENT_YEAR || '2025';
    const scoreRange = await this.enrollConfigService.getScoreRange(
      provinceName,
      subjectType,
      score,
      year,
    );

    if (!scoreRange) {
      throw new NotFoundException('未找到对应的分数范围信息');
    }

    // 转换为响应 DTO
    return plainToInstance(ScoreRangeResponseDto, {
      num: scoreRange.num,
      total: scoreRange.total,
      rankRange: scoreRange.rankRange,
      batchName: scoreRange.batchName,
      controlScore: scoreRange.controlScore,
    });
  }
}

