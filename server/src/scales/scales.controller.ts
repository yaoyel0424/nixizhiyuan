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
} from '@nestjs/swagger';
import { ScalesService } from './scales.service';
import { CreateScaleAnswerDto } from './dto/create-scale-answer.dto';
import { ScaleAnswerResponseDto } from './dto/scale-answer-response.dto';
import {
  ScaleResponseDto,
  ScalesWithAnswersResponseDto,
} from './dto/scale-response.dto';
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

  @Post('answers')
  @ApiOperation({ summary: '创建量表答案' })
  @ApiResponse({
    status: 201,
    description: '创建成功',
    type: ScaleAnswerResponseDto,
  })
  @ApiResponse({ status: 404, description: '量表不存在' })
  @ApiResponse({ status: 409, description: '该用户已对该量表提交过答案' })
  async create(
    @Body() createDto: CreateScaleAnswerDto,
  ): Promise<ScaleAnswerResponseDto> {
    const scaleAnswer = await this.scalesService.create(createDto);
    return plainToInstance(ScaleAnswerResponseDto, scaleAnswer, {
      excludeExtraneousValues: true,
    });
  }
}

