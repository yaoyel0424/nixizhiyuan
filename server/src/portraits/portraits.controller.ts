import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PortraitsService } from './portraits.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserPortraitResponseDto } from './dto/portrait-response.dto';
import { CreatePortraitFeedbackDto } from './dto/create-portrait-feedback.dto';
import { plainToInstance } from 'class-transformer';

/**
 * 画像控制器
 */
@ApiTags('画像')
@Controller('portraits')
@ApiBearerAuth()
export class PortraitsController {
  constructor(private readonly portraitsService: PortraitsService) {}

  /**
   * 查询用户画像
   * 根据用户的元素得分计算并匹配对应的画像
   */
  @Get('user')
  @ApiOperation({ summary: '查询用户画像' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: UserPortraitResponseDto,
  })
  async getUserPortrait(
    @CurrentUser() user: any,
  ): Promise<UserPortraitResponseDto> {
    const result = await this.portraitsService.getUserPortrait(user.id);
    return plainToInstance(UserPortraitResponseDto, result, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * 获取画像反馈：无 portraitId 时返回当前用户全部反馈，有 portraitId 时返回该画像的反馈
   */
  @Get('feedback')
  @ApiOperation({ summary: '获取画像反馈' })
  @ApiQuery({ name: 'portraitId', required: false, description: '画像ID，不传则返回全部' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getFeedback(
    @CurrentUser() user: any,
    @Query('portraitId') portraitId?: string,
  ): Promise<
    | { id: number; option: string; portraitId: number | null; createdAt: string }
    | { id: number; option: string; portraitId: number | null; createdAt: string }[]
    | null
  > {
    const pid = portraitId != null && portraitId !== '' ? parseInt(portraitId, 10) : undefined;
    if (pid != null && Number.isNaN(pid)) {
      return [];
    }
    const result = await this.portraitsService.getFeedback(user.id, pid);
    const format = (f: { id: number; option: string; portraitId: number | null; createdAt: Date }) => ({
      id: f.id,
      option: f.option,
      portraitId: f.portraitId,
      createdAt: f.createdAt.toISOString(),
    });
    if (result == null) return null;
    return Array.isArray(result) ? result.map(format) : format(result);
  }

  /**
   * 创建画像反馈
   */
  @Post('feedback')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建画像反馈' })
  @ApiResponse({ status: 201, description: '反馈提交成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  async createFeedback(
    @CurrentUser() user: any,
    @Body() dto: CreatePortraitFeedbackDto,
  ): Promise<{ id: number; option: string; portraitId: number | null; createdAt: string }> {
    const feedback = await this.portraitsService.createFeedback(
      user.id,
      dto.option,
      dto.portraitId,
    );
    return {
      id: feedback.id,
      option: feedback.option,
      portraitId: feedback.portraitId,
      createdAt: feedback.createdAt.toISOString(),
    };
  }
}

