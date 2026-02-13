import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ScalesService } from './scales.service';
import { CreateScaleAnswerDto } from './dto/create-scale-answer.dto';
import { ScaleAnswerResponseDto } from './dto/scale-answer-response.dto';
import {
  ScaleResponseDto,
  ScaleOptionResponseDto,
  ScaleSnapshotResponseDto,
  ScalesWithAnswersResponseDto,
} from './dto/scale-response.dto';
import {
  UpdateScaleContentDto,
  UpdateOptionDto,
} from './dto/update-scale-and-options.dto';
import { PopularMajorAnswerResponseDto } from '../popular-majors/dto/popular-major-answer-response.dto';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

/**
 * 量表控制器
 */
@ApiTags('量表')
@ApiBearerAuth()
@Controller('scales')
export class ScalesController {
  constructor(private readonly scalesService: ScalesService) {}

  @Get()
  @ApiOperation({ summary: '获取所有量表列表及用户答案' })
  @ApiQuery({ name: 'repeat', required: false, description: '是否重新作答场景', example: false })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: ScalesWithAnswersResponseDto,
  })
  async findAll(
    @CurrentUser() user: any,
    @Query('repeat') repeat?: string,
  ): Promise<ScalesWithAnswersResponseDto> {
    const repeatFlag = repeat === 'true';
    const result = await this.scalesService.findAllWithAnswers(user.id, repeatFlag);
    const response: ScalesWithAnswersResponseDto = {
      scales: plainToInstance(ScaleResponseDto, result.scales, {
        excludeExtraneousValues: true,
      }),
      answers: plainToInstance(ScaleAnswerResponseDto, result.answers, {
        excludeExtraneousValues: true,
      }),
    };
    if (result.snapshot) {
      response.snapshot = plainToInstance(ScaleSnapshotResponseDto, result.snapshot, {
        excludeExtraneousValues: true,
      });
    }
    return response;
  }

  @Get('major-detail/:majorDetailId')
  @ApiOperation({ summary: '根据专业详情ID获取对应的量表列表及用户答案' })
  @ApiParam({ name: 'majorDetailId', description: '专业详情ID' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: ScalesWithAnswersResponseDto,
  })
  @ApiResponse({ status: 404, description: '专业详情不存在' })
  async findScalesByMajorDetailId(
    @Param('majorDetailId', ParseIntPipe) majorDetailId: number,
    @CurrentUser() user: any,
  ): Promise<ScalesWithAnswersResponseDto> {
    const result = await this.scalesService.findScalesByMajorDetailId(
      majorDetailId,
      user.id,
    );
    return {
      scales: plainToInstance(ScaleResponseDto, result.scales, {
        excludeExtraneousValues: true,
      }),
      answers: plainToInstance(ScaleAnswerResponseDto, result.answers, {
        excludeExtraneousValues: true,
      }),
    };
  }

  @Get('element/:elementId')
  @ApiOperation({ summary: '根据元素ID获取对应的量表列表及用户答案' })
  @ApiParam({ name: 'elementId', description: '元素ID' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: ScalesWithAnswersResponseDto,
  })
  @ApiResponse({ status: 404, description: '元素不存在' })
  async findScalesByElementId(
    @Param('elementId', ParseIntPipe) elementId: number,
    @CurrentUser() user: any,
  ): Promise<ScalesWithAnswersResponseDto> {
    const result = await this.scalesService.findScalesByElementId(
      elementId,
      user.id,
    );
    return {
      scales: plainToInstance(ScaleResponseDto, result.scales, {
        excludeExtraneousValues: true,
      }),
      answers: plainToInstance(ScaleAnswerResponseDto, result.answers, {
        excludeExtraneousValues: true,
      }),
    };
  }

  @Get('element/:elementId/popular-major/:popularMajorId')
  @ApiOperation({ summary: '根据元素ID和热门专业ID获取对应的量表列表及用户答案（从 popular_major_answers 表查询）' })
  @ApiParam({ name: 'elementId', description: '元素ID' })
  @ApiParam({ name: 'popularMajorId', description: '热门专业ID' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      type: 'object',
      properties: {
        scales: {
          type: 'array',
          items: { $ref: '#/components/schemas/ScaleResponseDto' },
        },
        answers: {
          type: 'array',
          items: { $ref: '#/components/schemas/PopularMajorAnswerResponseDto' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: '元素不存在或热门专业不存在' })
  async findScalesByElementIdForPopularMajor(
    @Param('elementId', ParseIntPipe) elementId: number,
    @Param('popularMajorId', ParseIntPipe) popularMajorId: number,
    @CurrentUser() user: any,
  ) {
    const result = await this.scalesService.findScalesByElementIdForPopularMajor(
      elementId,
      popularMajorId,
      user.id,
    );
    return {
      scales: plainToInstance(ScaleResponseDto, result.scales, {
        excludeExtraneousValues: true,
      }),
      answers: plainToInstance(PopularMajorAnswerResponseDto, result.answers, {
        excludeExtraneousValues: true,
      }),
    };
  }

  @Get('popular-major/:popularMajorId')
  @ApiOperation({ summary: '根据热门专业ID获取对应的量表列表及用户答案' })
  @ApiParam({ name: 'popularMajorId', description: '热门专业ID' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      type: 'object',
      properties: {
        scales: {
          type: 'array',
          items: { $ref: '#/components/schemas/ScaleResponseDto' },
        },
        answers: {
          type: 'array',
          items: { $ref: '#/components/schemas/PopularMajorAnswerResponseDto' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: '热门专业不存在' })
  async findScalesByPopularMajorId(
    @Param('popularMajorId', ParseIntPipe) popularMajorId: number,
    @CurrentUser() user: any,
  ) {
    const result = await this.scalesService.findScalesByPopularMajorId(
      popularMajorId,
      user.id,
    );
    return {
      scales: plainToInstance(ScaleResponseDto, result.scales, {
        excludeExtraneousValues: true,
      }),
      answers: plainToInstance(PopularMajorAnswerResponseDto, result.answers, {
        excludeExtraneousValues: true,
      }),
    };
  }

  @Patch(':id/content')
  @ApiOperation({ summary: '更新量表题干 content' })
  @ApiParam({ name: 'id', description: '量表ID' })
  @ApiBody({ type: UpdateScaleContentDto })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    type: ScaleResponseDto,
  })
  @ApiResponse({ status: 404, description: '量表不存在' })
  async updateScaleContent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScaleContentDto,
  ): Promise<ScaleResponseDto> {
    const scale = await this.scalesService.updateScaleContent(id, dto.content);
    return plainToInstance(ScaleResponseDto, scale, {
      excludeExtraneousValues: true,
    });
  }

  @Patch('options/:optionId')
  @ApiOperation({ summary: '通过选项 id 更新 optionName 和/或 additionalInfo' })
  @ApiParam({ name: 'optionId', description: '选项ID（ScaleOption 主键）' })
  @ApiBody({ type: UpdateOptionDto })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    type: ScaleOptionResponseDto,
  })
  @ApiResponse({ status: 404, description: '选项不存在' })
  async updateOption(
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body() dto: UpdateOptionDto,
  ): Promise<ScaleOptionResponseDto> {
    const option = await this.scalesService.updateOption(optionId, dto);
    return plainToInstance(ScaleOptionResponseDto, option, {
      excludeExtraneousValues: true,
    });
  }

  @Post('answers')
  @ApiOperation({ summary: '创建或更新量表答案' })
  @ApiBody({
    type: CreateScaleAnswerDto,
    description: '创建或更新量表答案的请求体，如果答案已存在则更新',
  })
  @ApiResponse({
    status: 201,
    description: '创建或更新成功',
    type: ScaleAnswerResponseDto,
  })
  @ApiResponse({ status: 404, description: '量表不存在或用户不存在' })
  async create(
    @Body() createDto: CreateScaleAnswerDto,
  ): Promise<ScaleAnswerResponseDto> {
    const scaleAnswer = await this.scalesService.create(createDto);
    return plainToInstance(ScaleAnswerResponseDto, scaleAnswer, {
      excludeExtraneousValues: true,
    });
  }

  @Delete('answers')
  @ApiOperation({
    summary: '删除当前用户在 scale_answers 表中的所有答案',
    description: '删除前会判断用户是否已完成全部 168 量表；若已完成则先将旧数据写入快照再删除。',
  })
  @ApiResponse({
    status: 200,
    description: '删除成功',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'number', description: '删除的记录数' },
        snapshotted: { type: 'boolean', description: '是否在删除前已做快照（仅当完成全部 168 量表时为 true）' },
        snapshot: {
          type: 'object',
          description: '快照信息（仅当 snapshotted 为 true 时返回）',
          properties: {
            version: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            payload: { type: 'object', description: '含 answers、savedAt' },
          },
        },
      },
    },
  })
  async deleteMyAnswers(
    @CurrentUser() user: any,
  ): Promise<{ deleted: number; snapshotted: boolean; snapshot?: ScaleSnapshotResponseDto }> {
    const result = await this.scalesService.deleteAnswersByUserId(user.id);
    if (result.snapshot) {
      return {
        deleted: result.deleted,
        snapshotted: result.snapshotted,
        snapshot: plainToInstance(ScaleSnapshotResponseDto, result.snapshot, { excludeExtraneousValues: true }),
      };
    }
    return { deleted: result.deleted, snapshotted: result.snapshotted };
  }
}

