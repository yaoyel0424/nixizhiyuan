import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  StreamableFile,
  UseGuards,
  Req,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AgentService } from './agent.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { AgentResponseDto } from './dto/agent-response.dto';
import { EntitlementGuard } from '@/common/guards/entitlement.guard';

/**
 * 代理商控制器
 */
@ApiTags('代理商')
@Controller('agent')
@ApiBearerAuth()
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * 创建代理商（优先按当前用户 user_id 命中已有则跳过）
   * userId 从当前登录用户获取，先确认该用户是否已有代理商，有则直接返回；无则新建。不需要传 openId；分账比例默认 30%。
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建代理商（有则跳过）' })
  @ApiResponse({
    status: 201,
    description: '创建成功或返回已有代理商',
    type: AgentResponseDto,
  })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 401, description: '未登录' })
  @UseGuards(EntitlementGuard)
  async create(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateAgentDto,
    @Req() req: Request,
  ): Promise<AgentResponseDto> {
    if(!(req as any).hasUnlockAll) {
      throw new HttpException(
        {
          code: 'FORBIDDEN',
          message: '只有会员才可以进程此操作',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const agent = await this.agentService.createOrGet(dto, user.id);
    
    return plainToInstance(AgentResponseDto, agent, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * 根据当前用户的 userId 从 agent 表获取对应代理商，再生成进入小程序的二维码（PNG 图片）
   * uuid 不通过路径传入，由当前登录用户关联的 agent 决定
   */
  @Get('qrcode')
  @ApiOperation({ summary: '生成小程序码（按当前用户关联的 agent）' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '小程序页面路径，默认 pages/index/index',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['raw', 'base64'],
    description: 'raw=直接返回 PNG 流（浏览器/img 可请求后显示）；base64=返回 JSON { image: "data:image/png;base64,..." } 便于小程序等直接赋给 image 的 src',
  })
  @ApiResponse({ status: 200, description: 'PNG 图片或 base64 JSON', content: { 'image/png': {}, 'application/json': {} } })
  @ApiResponse({ status: 401, description: '未登录' })
  @ApiResponse({ status: 404, description: '当前用户未关联代理商' })
  @UseGuards(EntitlementGuard)
  async getQrcode(
    @CurrentUser() user: { id: number },
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('format') format?: string, 
  ): Promise<StreamableFile | { image: string }> {
    if(!(req as any).hasUnlockAll) {
      throw new HttpException(
        {
          code: 'FORBIDDEN',
          message: '只有会员才可以进程此操作',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const buffer = await this.agentService.getMiniProgramQrcodeBufferByUserId(
      user.id,
      page || 'pages/index/index?uuid=${agent.uuid}',
    );
    if (format === 'base64') {
      const base64 = buffer.toString('base64');
      return { image: `data:image/png;base64,${base64}` };
    }
    return new StreamableFile(buffer, { type: 'image/png' });
  }
}
