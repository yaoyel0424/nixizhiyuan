import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';

/**
 * 更新用户选科和分数信息请求 DTO
 */
export class UpdateProfileDto {
  @ApiProperty({
    description: '省份',
    example: '北京',
    required: false,
  })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiProperty({
    description: '首选科目',
    example: '物理',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['物理', '历史', '综合', '文科', '理科'], {
    message: '无效的首选科目，必须是：物理、历史、综合、文科、理科',
  })
  preferredSubjects?: string;

  @ApiProperty({
    description: '次选科目（多个用逗号分隔）',
    example: '化学,生物',
    required: false,
  })
  @IsOptional()
  @IsString()
  secondarySubjects?: string;

  @ApiProperty({
    description: '招生类型',
    example: '本科一批',
    required: false,
  })
  @IsOptional()
  @IsString()
  enrollType?: string;

  @ApiProperty({
    description: '分数',
    example: 650,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: '分数不能小于0' })
  @Max(750, { message: '分数不能大于750' })
  score?: number;

  @ApiProperty({
    description: '排名',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: '排名不能小于0' })
  rank?: number;
}

