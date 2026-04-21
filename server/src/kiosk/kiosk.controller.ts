import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import {
  KioskAnonymousUserCreatedResponse,
  KioskMajorAnalysisScalesResponse,
  KioskMajorTreeGroupedResponse,
  KioskService,
} from './kiosk.service';
import { Cache } from '@/common/decorators/cache.decorator';
import { MajorsService } from '@/majors/majors.service';
import { MajorDetailResponseDto } from '@/majors/dto/major-detail-response.dto';
import { plainToInstance } from 'class-transformer';
import { EnrollPlanService } from '@/enroll-plan/enroll-plan.service';
import { EnrollmentPlansByScoreRangeDto } from '@/enroll-plan/dto/enrollment-plan-with-scores.dto';
import { KioskEnrollmentScoresService } from './kiosk-enrollment-scores.service';
import { KioskAnonymousMajorScoreService } from './kiosk-anonymous-major-score.service';
import { ScoreResponseDto } from '@/scores/dto/score-response.dto';
import { CreateAnonymousScaleAnswerDto } from './dto/create-anonymous-scale-answer.dto';
import { AnonymousScaleAnswerResponseDto } from './dto/anonymous-scale-answer-response.dto';

/**
 * 自助终端接口控制器
 */
@ApiTags('自助终端')
@Controller('kiosk')
export class KioskController {
  constructor(
    private readonly kioskService: KioskService,
    private readonly majorsService: MajorsService,
    private readonly enrollPlanService: EnrollPlanService,
    private readonly kioskEnrollmentScoresService: KioskEnrollmentScoresService,
    private readonly kioskAnonymousMajorScoreService: KioskAnonymousMajorScoreService,
  ) {}

  /**
   * 创建匿名用户（自助终端无登录场景，返回 id 供后续匿名业务使用）
   */
  @Public()
  @Post('anonymous-users')
  @ApiOperation({ summary: '创建匿名用户', description: '写入 anonymous_users，返回主键 id' })
  @ApiResponse({
    status: 201,
    description: '创建成功',
    schema: {
      type: 'object',
      properties: { id: { type: 'number', example: 1, description: 'anonymous_users.id' } },
    },
  })
  async createAnonymousUser(): Promise<KioskAnonymousUserCreatedResponse> {
    return this.kioskService.createAnonymousUser();
  }

  /**
   * 创建或更新匿名量表答案（与 scales POST answers 逻辑一致，写入 anonymous_scale_answers）
   */
  @Public()
  @Post('anonymous-scale-answers')
  @ApiOperation({
    summary: '创建或更新匿名量表答案',
    description: '传入匿名用户 id、量表 id、得分；同一匿名用户同一量表仅一条，已存在则更新',
  })
  @ApiBody({ type: CreateAnonymousScaleAnswerDto })
  @ApiResponse({
    status: 201,
    description: '创建或更新成功',
    type: AnonymousScaleAnswerResponseDto,
  })
  @ApiResponse({ status: 404, description: '量表不存在或匿名用户不存在' })
  async createAnonymousScaleAnswer(
    @Body() createDto: CreateAnonymousScaleAnswerDto,
  ): Promise<AnonymousScaleAnswerResponseDto> {
    const row = await this.kioskService.createAnonymousScaleAnswer(createDto);
    return plainToInstance(AnonymousScaleAnswerResponseDto, row, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * 匿名用户按专业代码查询匹配分数（与 ScoresController.getMajorScore 一致：不限制 edu_level，取最高分一条）
   */
  @Public()
  @Get('anonymous-users/:anonymousUserId/major-scores/:majorCode')
  @ApiOperation({
    summary: '匿名用户获取单个专业的匹配分数',
    description:
      '根据 anonymous_users.id 与专业代码，基于 anonymous_scale_answers 计算；查询所有教育层次，返回分数最高的一条',
  })
  @ApiParam({
    name: 'anonymousUserId',
    description: '匿名用户主键（anonymous_users.id）',
    example: 1,
    type: Number,
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
  @ApiResponse({ status: 404, description: '匿名用户不存在' })
  async getMajorScoreByAnonymousUser(
    @Param('anonymousUserId', ParseIntPipe) anonymousUserId: number,
    @Param('majorCode') majorCode: string,
  ): Promise<ScoreResponseDto | null> {
    const scores =
      await this.kioskAnonymousMajorScoreService.getMajorMatchScoreByAnonymousUser(
        anonymousUserId,
        majorCode,
      );
    if (!scores || scores.length === 0) {
      return null;
    }
    return plainToInstance(ScoreResponseDto, scores[0], {
      excludeExtraneousValues: true,
    });
  }

  /**
   * 获取专业三级分类树，按 edu_level 分组返回（无需传入 edu_level）
   */
  @Public()
  @Get('majors/tree')
  @Cache(60 * 60 * 24)
  @ApiOperation({
    summary: '获取专业分类树（按教育层次分组）',
    description:
      '一次性返回全部 majors 数据；响应中 groups 每项含 eduLevel 与该层次下的三级树（level1→level2→level3）。',
  })
  @ApiResponse({ status: 200, description: '按 edu_level 分组的专业树' })
  async getMajorTree(): Promise<KioskMajorTreeGroupedResponse> {
    return this.kioskService.getMajorTreeGroupedByEduLevel();
  }

  /**
   * 通过专业代码获取专业详细信息（逻辑与 majors/detail/:majorCode 一致）
   */
  @Public()
  @Get('majors/detail/:majorCode')
  @Cache(60 * 60 * 24)
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
  ): Promise<MajorDetailResponseDto> {
    const majorDetail = await this.majorsService.getMajorDetailByCode(
      majorCode,
      undefined,
    );
    return plainToInstance(MajorDetailResponseDto, majorDetail, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * 按传入省份与选科查询匹配的 level3 专业 ID（不读用户表，逻辑同 enroll-plan level3-major-ids）
   */
  @Public()
  @Get('level3-major-ids')
  @Cache(600)
  @ApiOperation({
    summary: '按选科条件查询去重后的 level3_major_id',
    description:
      'province、preferredSubjects、secondarySubjects、eduLevel 均由参数传入；招生年份根据 province 查询 provinces 表取得，不接收 year 参数，不查询 users 表。',
  })
  @ApiQuery({
    name: 'province',
    required: true,
    description: '省份名称（与 users.province 语义一致）',
    example: '浙江',
  })
  @ApiQuery({
    name: 'preferredSubjects',
    required: true,
    description: '首选科目（对应招生计划 primary_subject）',
    example: '物理',
  })
  @ApiQuery({
    name: 'secondarySubjects',
    required: false,
    description: '再选科目，逗号分隔（与 users.secondarySubjects 逗号列表语义一致）',
    example: '化学,生物',
  })
  @ApiQuery({
    name: 'eduLevel',
    required: false,
    description: '教育层次：zhuan（专科）或 ben（本科），用于匹配 province_batch',
    example: 'ben',
  })
  @ApiResponse({ status: 200, description: '去重后的 level3_major_id 数组' })
  async getLevel3MajorIdsBySubjectSelection(
    @Query('province') province: string,
    @Query('preferredSubjects') preferredSubjects: string,
    @Query('secondarySubjects') secondarySubjectsParam?: string,
    @Query('eduLevel') eduLevel?: string,
  ): Promise<{ level3MajorIds: number[] }> {
    const p = province?.trim();
    const pref = preferredSubjects?.trim();
    if (!p || !pref) {
      throw new BadRequestException('province 与 preferredSubjects 为必填查询参数');
    }
    const secondarySubjects = (secondarySubjectsParam ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s);

    const level3MajorIds =
      await this.enrollPlanService.getDistinctLevel3MajorIdsBySubjectSelection({
        eduLevel: eduLevel?.trim(),
        province: p,
        preferredSubjects: pref,
        secondarySubjects,
      });
    return { level3MajorIds };
  }

  /**
   * 根据 level3 专业 ID 查询招生计划与分数（与 enroll-plan GET major/:majorId/scores 同源逻辑，无需登录）
   */
  @Public()
  @Get('major/:majorId/scores')
  @Cache(600)
  @ApiOperation({
    summary: '根据专业ID查询招生计划和分数信息',
    description:
      '调用逻辑与 enroll-plan major/:majorId/scores 一致；省份、选科由查询参数传入；年份按 province 查 provinces 表；不含权益校验与 popularMajorId。',
  })
  @ApiParam({
    name: 'majorId',
    description: '三级专业 ID（majors.id / level3_major_id）',
    type: Number,
    example: 483,
  })
  @ApiQuery({
    name: 'province',
    required: true,
    description: '省份名称（用于解析年份及招生计划省份条件）',
    example: '浙江',
  })
  @ApiQuery({
    name: 'preferredSubjects',
    required: true,
    description: '首选科目',
    example: '物理',
  })
  @ApiQuery({
    name: 'secondarySubjects',
    required: false,
    description: '再选科目，逗号分隔',
    example: '化学,生物',
  })
  @ApiQuery({
    name: 'edulevel',
    required: false,
    description:
      '教育层次：ben / gaoben / zhuan；服务端按 province、年份与 province_batches.type 解析出 batch 作为批次筛选（等同原 enrollType）',
  })
  @ApiQuery({
    name: 'minScore',
    required: false,
    description: '最低分（分数段分组）',
    type: Number,
    example: 500,
  })
  @ApiQuery({
    name: 'maxScore',
    required: false,
    description: '最高分（分数段分组）',
    type: Number,
    example: 600,
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: EnrollmentPlansByScoreRangeDto,
  })
  async getEnrollmentPlansScoresByMajorId(
    @Param('majorId', ParseIntPipe) majorId: number,
    @Query('province') province: string,
    @Query('preferredSubjects') preferredSubjects: string,
    @Query('secondarySubjects') secondarySubjects?: string,
    @Query('edulevel') edulevel?: string,
    @Query('minScore') minScore?: string,
    @Query('maxScore') maxScore?: string,
  ): Promise<EnrollmentPlansByScoreRangeDto> {
    const pv = province?.trim();
    const pref = preferredSubjects?.trim();
    if (!pv || !pref) {
      throw new BadRequestException('province 与 preferredSubjects 为必填查询参数');
    }

    const year = await this.kioskEnrollmentScoresService.resolveEnrollmentYearByProvinceName(
      pv,
    );

    const enrollType = await this.kioskEnrollmentScoresService.resolveEnrollTypeFromEduLevel(
      pv,
      year,
      edulevel,
    );

    const parsedMinScore =
      minScore !== undefined && minScore !== null && String(minScore).trim() !== ''
        ? Number(minScore)
        : undefined;
    const parsedMaxScore =
      maxScore !== undefined && maxScore !== null && String(maxScore).trim() !== ''
        ? Number(maxScore)
        : undefined;

    return this.kioskEnrollmentScoresService.findEnrollmentPlansByMajorIdForKiosk(
      majorId,
      year,
      pv,
      pref,
      secondarySubjects ?? '',
      enrollType,
      Number.isFinite(parsedMinScore as number) ? (parsedMinScore as number) : undefined,
      Number.isFinite(parsedMaxScore as number) ? (parsedMaxScore as number) : undefined,
    );
  }

  /**
   * 根据专业代码查询专业元素分析及关联量表（含选项）
   */
  @Public()
  @Get('majors/:majorCode/scales')
  @Cache(60 * 60 * 24)
  @ApiOperation({
    summary: '根据专业代码查询元素分析及量表选项',
    description:
      'major_details.code → major_element_analysis.major_id → element_id → scales（仅 direction=168）及 scale_options。',
  })
  @ApiParam({
    name: 'majorCode',
    description: '专业代码（与 major_details.code 一致）',
    example: '010101',
  })
  async getMajorAnalysisScales(
    @Param('majorCode') majorCode: string,
  ): Promise<KioskMajorAnalysisScalesResponse> {
    const trimmed = majorCode?.trim();
    if (!trimmed) {
      throw new BadRequestException('专业代码不能为空');
    }
    return this.kioskService.getAnalysisScalesByMajorCode(trimmed);
  }
}
