import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { LearningStepService } from './learning-step.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Cache } from '@/common/decorators/cache.decorator';
/**
 * 学习步骤控制器
 */
@ApiTags('学习步骤')
@ApiBearerAuth()
@Controller('learning-step')
export class LearningStepController {
  constructor(private readonly learningStepService: LearningStepService) {}

  /**
   * 获取学习步骤完整信息（步骤 + 阶段 + 明细）
   */
  @Get('full')
  @Public()
  @ApiOperation({ summary: '获取学习步骤完整信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getFullLearningSteps() {
    return this.learningStepService.getFullLearningSteps();
  }

  /**
   * 根据用户喜欢和天赋，获取步骤中的个性化内容
   */
  @Get('user-content')
  @ApiOperation({ summary: '按用户喜欢和天赋获取学习步骤内容' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getUserLearningSteps(
    @CurrentUser() user: { id: number },
  ) {
    return this.learningStepService.getUserLearningSteps(user.id);
  }

  /**
   * 通过省份名称获取数学高考模块统计
   */
  @Get('gaokao-math/province')
  @Public()
  @ApiOperation({ summary: '通过省份名称获取数学高考模块统计' })
  @ApiQuery({ name: 'province', required: true, description: '省份名称，如 广东、北京市' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getGaokaoMathByProvince(
    @Query('province') province?: string,
  ) {
    if (!province || !province.trim()) {
      throw new BadRequestException('province 不能为空');
    }
    return this.learningStepService.getGaokaoMathStatsByProvince(province);
  }
}
