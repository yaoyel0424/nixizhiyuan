import {
  Controller,
  Get,
  Param,
  Query,
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
import { ScoresService } from './scores.service';
import { ScoreResponseDto } from './dto/score-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { plainToInstance } from 'class-transformer';
import { LoggerService } from '@/logger/logger.service';
import { Cache } from '@/common/decorators/cache.decorator';
/**
 * 专业分数控制器
 */
@ApiTags('专业分数')
@ApiBearerAuth()
@Controller('scores')
export class ScoresController {
  constructor(
    private readonly scoresService: ScoresService,
    private readonly logger: LoggerService,
  ) {}

  @Get('major/:majorCode')
  @ApiOperation({
    summary: '获取单个专业的匹配分数',
    description: '根据专业代码获取用户对该专业的匹配分数（查询所有教育层次）',
  })
  @ApiParam({
    name: 'majorCode',
    description: '专业代码',
    example: '010101',
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: ScoreResponseDto,
  })
  @ApiResponse({ status: 404, description: '专业不存在或未找到分数' })
  async getMajorScore(
    @Param('majorCode') majorCode: string,
    @CurrentUser() user: any,
  ): Promise<ScoreResponseDto | null> {
    // 查询所有教育层次下该专业的分数
    const scores = await this.scoresService.calculateScores(
      user.id,
      undefined, // 不指定 edu_level，查询所有教育层次
      majorCode, // 指定专业代码
    );

    this.logger.debug(
      `查询专业分数结果: userId=${user.id}, majorCode=${majorCode}, scoresCount=${scores?.length || 0}`,
      'ScoresController',
    );

    if (!scores || scores.length === 0) {
      return null;
    }

    // 返回分数最高的结果（按分数降序排序后的第一个）
    // SQL 查询已经按 score DESC 排序，所以第一个就是分数最高的
    return plainToInstance(ScoreResponseDto, scores[0], {
      excludeExtraneousValues: true,
    });
  }

  @Get('all')
  @ApiOperation({
    summary: '获取专业分数',
    description: '获取用户对专业的匹配分数。如果传入eduLevel则查询该教育层次下的所有专业，否则查询所有教育层次（本科、专科、高职本科）下的所有专业',
  })
  @ApiQuery({
    name: 'eduLevel',
    required: false,
    description: '教育层次（ben: 本科, zhuan: 专科, gao_ben: 高职本科）。不传则查询所有教育层次',
    example: 'ben',
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: ScoreResponseDto,
    isArray: true,
  })

  @Cache(120)
  async getAllScores(
    @Query('eduLevel') eduLevel?: string,
    @CurrentUser() user?: any,
  ): Promise<ScoreResponseDto[]> {
    // 直接调用 calculateScores，如果传入了 eduLevel 则只查询该教育层次，否则查询所有教育层次
    const scores = await this.scoresService.calculateScores(
      user.id,
      eduLevel,
    );

    return plainToInstance(ScoreResponseDto, scores, {
      excludeExtraneousValues: true,
    });
  }

  

}

