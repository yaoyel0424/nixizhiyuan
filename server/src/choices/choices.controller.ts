import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ChoicesService } from './choices.service';
import { CreateChoiceDto } from './dto/create-choice.dto';
import { ChoiceResponseDto } from './dto/choice-response.dto';
import { AdjustIndexDto } from './dto/adjust-index.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

/**
 * 志愿选择控制器
 */
@ApiTags('志愿选择')
@Controller('choices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChoicesController {
  private readonly logger = new Logger(ChoicesController.name);

  constructor(private readonly choicesService: ChoicesService) {}

  /**
   * 创建志愿选择
   * @param user 当前用户
   * @param createChoiceDto 创建志愿的 DTO
   * @returns 创建的志愿选择记录
   */
  @Post()
  @ApiOperation({ summary: '创建志愿选择' })
  @ApiResponse({
    status: 201,
    description: '创建成功',
    type: ChoiceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '用户不存在',
  })
  @ApiResponse({
    status: 400,
    description: '请求参数错误',
  })
  @ApiResponse({
    status: 409,
    description: '志愿已存在',
  })
  async create(
    @CurrentUser() user: any,
    @Body() createChoiceDto: CreateChoiceDto,
  ): Promise<ChoiceResponseDto> {
    this.logger.log(`用户 ${user.id} 创建志愿选择`);
    return await this.choicesService.create(user.id, createChoiceDto);
  }

  /**
   * 获取用户的志愿选择列表
   * @param user 当前用户
   * @param year 年份（可选），如果不传则从配置中读取
   * @returns 志愿选择列表
   */
  @Get()
  @ApiOperation({ summary: '获取用户的志愿选择列表' })
  @ApiQuery({
    name: 'year',
    required: false,
    description: '年份，如果不传则从配置中读取',
    example: '2025',
  })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: [ChoiceResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: '用户不存在',
  })
  async findAll(
    @CurrentUser() user: any,
    @Query('year') year?: string,
  ): Promise<ChoiceResponseDto[]> {
    this.logger.log(`用户 ${user.id} 查询志愿选择列表，年份: ${year || '从配置读取'}`);
    return await this.choicesService.findByUser(user.id, year);
  }

  /**
   * 删除志愿选择
   * @param user 当前用户
   * @param id 志愿选择ID
   * @returns 删除结果
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除志愿选择' })
  @ApiParam({
    name: 'id',
    description: '志愿选择ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '删除成功',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: '删除成功',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '志愿选择不存在或不属于当前用户',
  })
  async remove(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    this.logger.log(`用户 ${user.id} 删除志愿选择，ID: ${id}`);
    await this.choicesService.remove(user.id, id);
    return { message: '删除成功' };
  }

  /**
   * 调整索引（上移或下移）
   * @param user 当前用户
   * @param id 志愿选择ID
   * @param adjustIndexDto 调整索引的 DTO
   * @returns 更新后的志愿选择记录
   */
  @Patch(':id/adjust-index')
  @ApiOperation({ summary: '调整志愿索引（上移或下移）' })
  @ApiParam({
    name: 'id',
    description: '志愿选择ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '调整成功',
    type: ChoiceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '志愿选择不存在或不属于当前用户',
  })
  @ApiResponse({
    status: 400,
    description: '已经是第一个或最后一个，无法调整',
  })
  async adjustIndex(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() adjustIndexDto: AdjustIndexDto,
  ): Promise<ChoiceResponseDto> {
    this.logger.log(
      `用户 ${user.id} 调整志愿选择索引，ID: ${id}，类型: ${adjustIndexDto.indexType}，方向: ${adjustIndexDto.direction}`,
    );
    return await this.choicesService.adjustIndex(
      user.id,
      id,
      adjustIndexDto.indexType,
      adjustIndexDto.direction,
    );
  }
}
