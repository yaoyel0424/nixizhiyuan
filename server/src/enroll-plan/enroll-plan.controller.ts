import {
  Controller,
  Get,
  UseGuards,
  Logger,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { EnrollPlanService } from './enroll-plan.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { EnrollmentPlanWithScoresDto } from './dto/enrollment-plan-with-scores.dto';
import { MajorGroupInfoResponseDto } from './dto/major-group-info-response.dto';
import { Cache } from '@/common/decorators/cache.decorator';
/**
 * 招生计划控制器
 */
@ApiTags('招生计划')
@Controller('enroll-plan')
@ApiBearerAuth()
export class EnrollPlanController {
  private readonly logger = new Logger(EnrollPlanController.name);

  constructor(private readonly enrollPlanService: EnrollPlanService) {}

  /**
   * 根据当前用户信息查询匹配的招生计划
   * @param user 当前用户
   * @returns 按收藏专业分组的招生计划，每个专业包含学校数组
   */
  @Get('user-plans')
  @ApiOperation({ summary: '根据当前用户信息查询匹配的招生计划（按收藏专业分组）' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
  })
  @ApiResponse({
    status: 404,
    description: '用户不存在',
  })
  @Cache(60)
  async getUserEnrollmentPlans(
    @CurrentUser() user: any,
  ): Promise<
    Array<{
      majorFavorite: {
        id: number;
        majorCode: string;
        major: {
          id: number;
          name: string;
          code: string;
          eduLevel: string;
        };
      };
      score: number | null;
      schools: Array<{
        code: string;
        name: string | null;
      }>;
      schoolCount: number;
    }>
  > {
    const year = process.env.CURRENT_YEAR || '2025';
    return await this.enrollPlanService.findEnrollmentPlansByUser(
      user.id,
      year,
    );
  }

  /**
   * 根据专业ID查询招生计划和分数信息
   * @param majorId 专业ID
   * @param user 当前用户
   * @returns 招生计划列表（包含学校、学校详情、专业组和分数信息）
   */
  @Get('major/:majorId/scores')
  @Cache(60)
  @ApiOperation({ summary: '根据专业ID查询招生计划和分数信息' })
  @ApiParam({
    name: 'majorId',
    description: '专业ID',
    type: Number,
    example: 483,
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: [EnrollmentPlanWithScoresDto],
  })
  @ApiResponse({
    status: 404,
    description: '用户不存在或未找到数据',
  })
  async getEnrollmentPlansByMajorId(
    @Param('majorId', ParseIntPipe) majorId: number,
    @CurrentUser() user: any,
  ): Promise<EnrollmentPlanWithScoresDto[]> {
    const year = process.env.CURRENT_YEAR || '2025';
    return await this.enrollPlanService.findEnrollmentPlansByMajorId(
      majorId,
      user.id,
      year,
    );
  }

  /**
   * 通过专业组ID查询专业组信息
   * @param mgId 混淆后的专业组ID
   * @param user 当前用户
   * @returns 专业组信息及专业热爱能量
   */
  @Get('major-group/:mgId')
  @Cache(600)
  @ApiOperation({ summary: '通过专业组ID查询专业组信息' })
  @ApiParam({
    name: 'mgId',
    description: '专业组ID',
    type: Number,
    example: 123456,
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: [MajorGroupInfoResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: '专业组不存在或未找到数据',
  })
  async getMajorGroupInfo(
    @Param('mgId', ParseIntPipe) mgId: number,
    @CurrentUser() user: any,
  ): Promise<MajorGroupInfoResponseDto[]> {
    return await this.enrollPlanService.getMajorGroupInfoByMgId(mgId, user.id);
  }
} 