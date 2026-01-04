import {
  Controller,
  Get,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EnrollPlanService } from './enroll-plan.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { EnrollmentPlan } from '@/entities/enrollment-plan.entity';
import { School } from '@/entities/school.entity';
import { SchoolDetail } from '@/entities/school-detail.entity';

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
   * @returns 匹配的招生计划列表（包含学校和学校详情信息）
   */
  @Get('user-plans')
  @ApiOperation({ summary: '根据当前用户信息查询匹配的招生计划' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: [EnrollmentPlan],
  })
  @ApiResponse({
    status: 404,
    description: '用户不存在',
  })
  async getUserEnrollmentPlans(
    @CurrentUser() user: any,
  ): Promise<
    Array<
      EnrollmentPlan & {
        school: School | null;
        schoolDetail: SchoolDetail | null;
      }
    >
  > {
    const year = process.env.CURRENT_YEAR || '2025';
    return await this.enrollPlanService.findEnrollmentPlansByUser(
      user.id,
      year,
    );
  }
}

