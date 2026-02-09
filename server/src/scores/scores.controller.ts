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
import { ScoreResponseDto, ScoreSummaryItemDto, Bottom20ScoresResponseDto } from './dto/score-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UsersService } from '@/users/users.service';
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
    private readonly usersService: UsersService,
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

  @Cache(300)
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

  @Get('bottom-20')
  @Cache(600)
  @ApiOperation({
    summary: '获取分数倒序后20%的专业',
    description: '获取用户专业匹配分数按分数倒序排列后的后20%（即分数最低的20%），仅返回 majorId 和 score。eduLevel 根据用户表 enrollType 自动推断：含「专科」或为「普通类二段」时为 zhuan，否则为 ben',
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: Bottom20ScoresResponseDto,
  })
  async getBottom20Scores(@CurrentUser() user: any): Promise<Bottom20ScoresResponseDto> {
    const dbUser = await this.usersService.findOne(user.id);
    const enrollType = dbUser.enrollType?.trim() ?? '';
    const eduLevel =
      enrollType.includes('专科') || enrollType === '普通类二段' ? 'zhuan' : 'ben,gao_ben';
    const scores = await this.scoresService.calculateScores(user.id, eduLevel);
    // 按 score 倒序（从高到低），取后 20%
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const total = sorted.length;
    const takeCount = Math.max(0, Math.ceil(total * 0.2));
    const bottom = takeCount === 0 ? [] : sorted.slice(-takeCount);
    const items = bottom.map((item) => ({ majorId: item.majorId, score: item.score }));
    const scoreValues = bottom.map((item) => item.score);
    const maxScore = scoreValues.length > 0 ? Math.max(...scoreValues) : null;
    const minScore = scoreValues.length > 0 ? Math.min(...scoreValues) : null;
    return { items, maxScore, minScore };
  }
}

