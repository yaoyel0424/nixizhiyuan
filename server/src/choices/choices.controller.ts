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
import { GroupedChoiceResponseDto, SchoolGroupDto } from './dto/grouped-choice-response.dto';
import { AdjustDirectionDto } from './dto/adjust-direction.dto';
import { AdjustMgIndexDto } from './dto/adjust-mg-index.dto';
import { RemoveMultipleDto } from './dto/remove-multiple.dto';
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
    return await this.choicesService.create(user.id, createChoiceDto);
  }

  /**
   * 获取用户的志愿选择列表（分组）
   * @param user 当前用户
   * @param year 年份（可选），如果不传则从配置中读取
   * @returns 分组后的志愿选择列表
   */
  @Get()
  @ApiOperation({ summary: '获取用户的志愿选择列表（按学校和专业组分组）' })
  @ApiQuery({
    name: 'year',
    required: false,
    description: '年份，如果不传则从配置中读取',
    example: '2025',
  })
  @ApiResponse({
    status: 200,
    description: '查询成功（返回包含 data 和 statistics 的对象）',
    type: GroupedChoiceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '用户不存在',
  })
  async findAll(
    @CurrentUser() user: any,
    @Query('year') year?: string,
  ): Promise<GroupedChoiceResponseDto> {
    this.logger.log(`用户 ${user.id} 查询志愿选择列表，年份: ${year || '从配置读取'}`);
    return await this.choicesService.findByUser(user.id, year);
  }

  /** 
   * 批量删除志愿选择
   * @param user 当前用户
   * @param removeMultipleDto 批量删除的 DTO（包含 ids 数组）
   * @returns 删除结果
   */
  @Delete('batch')
  @ApiOperation({ summary: '批量删除志愿选择' })
  @ApiResponse({
    status: 200,
    description: '删除成功',
    schema: {
      type: 'object',
      properties: {
        deleted: {
          type: 'number',
          description: '成功删除的数量',
          example: 3,
        },
        failed: {
          type: 'array',
          items: { type: 'number' },
          description: '删除失败的ID列表（不存在或不属于当前用户）',
          example: [5, 6],
        },
        message: {
          type: 'string',
          example: '批量删除完成',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '请求参数错误（至少需要提供一个ID）',
  })
  async removeMultiple(
    @CurrentUser() user: any,
    @Body() removeMultipleDto: RemoveMultipleDto,
  ): Promise<{
    deleted: number;
    failed: number[];
    message: string;
  }> {
    this.logger.log(
      `用户 ${user.id} 批量删除志愿选择，IDs: ${removeMultipleDto.ids.join(', ')}`,
    );
    const result = await this.choicesService.removeMultiple(
      user.id,
      removeMultipleDto.ids,
    );
    return {
      ...result,
      message: '批量删除完成',
    };
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
   * 调整 mg_index（专业组索引）
   * @param user 当前用户
   * @param adjustDirectionDto 调整方向的 DTO（包含 mgIndex, province, schoolCode, batch）
   * @returns 更新后的记录数量
   */
  @Patch('adjust-mg-index')
  @ApiOperation({ summary: '调整专业组索引（上移或下移）' })
  @ApiResponse({
    status: 200,
    description: '调整成功',
    schema: {
      type: 'object',
      properties: {
        updated: { type: 'number', description: '更新的记录数量' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '未找到对应的志愿选择记录',
  })
  @ApiResponse({
    status: 400,
    description: '已经是第一个或最后一个，无法调整',
  })
  async adjustMgIndex(
    @CurrentUser() user: any,
    @Body() adjustDirectionDto: AdjustMgIndexDto,
  ): Promise<{ updated: number }> {
    this.logger.log(
      `用户 ${user.id} 调整 mg_index，mgIndex: ${adjustDirectionDto.mgIndex}，方向: ${adjustDirectionDto.direction}`,
    );
    return await this.choicesService.adjustMgIndex(
      user.id,
      adjustDirectionDto.mgIndex,
      adjustDirectionDto.direction,
    );
  }

  /**
   * 调整 major_index（专业索引）
   * @param user 当前用户
   * @param id 志愿选择ID
   * @param adjustDirectionDto 调整方向的 DTO
   * @returns 更新后的志愿选择记录
   */
  @Patch(':id/adjust-major-index')
  @ApiOperation({ summary: '调整专业索引（上移或下移）' })
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
  async adjustMajorIndex(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() adjustDirectionDto: AdjustDirectionDto,
  ): Promise<ChoiceResponseDto> {
    this.logger.log(
      `用户 ${user.id} 调整志愿选择 major_index，ID: ${id}，方向: ${adjustDirectionDto.direction}`,
    );
    return await this.choicesService.adjustMajorIndex(
      user.id,
      id,
      adjustDirectionDto.direction,
    );
  }

  /**
   * 修复所有记录的 mgIndex 和 majorIndex
   * @returns 修复结果
   */
  @Post('fix-indexes')
  @ApiOperation({ summary: '修复所有记录的 mgIndex 和 majorIndex' })
  @ApiResponse({
    status: 200,
    description: '修复成功',
    schema: {
      type: 'object',
      properties: {
        fixed: {
          type: 'number',
          example: 10,
        },
      },
    },
  })
  async fixAllIndexes(): Promise<{ fixed: number }> {
    this.logger.log('开始修复所有记录的 mgIndex 和 majorIndex');
    return await this.choicesService.fixAllIndexes();
  }
}
