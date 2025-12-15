import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PortraitsService } from './portraits.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '@/entities/user.entity';
import { UserPortraitResponseDto } from './dto/portrait-response.dto';
import { plainToInstance } from 'class-transformer';
import { Cache } from '@/common/decorators/cache.decorator';

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
  @Cache()
  async getUserPortrait(
    @CurrentUser() user: any,
  ): Promise<UserPortraitResponseDto> {
    const result = await this.portraitsService.getUserPortrait(user.id);
    return plainToInstance(UserPortraitResponseDto, result, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }
}

