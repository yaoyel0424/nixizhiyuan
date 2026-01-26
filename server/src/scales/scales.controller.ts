import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
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
  ScalesWithAnswersResponseDto,
} from './dto/scale-response.dto';
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
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: ScalesWithAnswersResponseDto,
  })
  async findAll(
    @CurrentUser() user: any,
  ): Promise<ScalesWithAnswersResponseDto> {
    const result = await this.scalesService.findAllWithAnswers(user.id);
    return {
      scales: plainToInstance(ScaleResponseDto, result.scales, {
        excludeExtraneousValues: true,
      }),
      answers: plainToInstance(ScaleAnswerResponseDto, result.answers, {
        excludeExtraneousValues: true,
      }),
    };
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
}

