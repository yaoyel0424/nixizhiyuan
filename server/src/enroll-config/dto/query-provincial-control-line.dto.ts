import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * 查询省控线 DTO
 */
export class QueryProvincialControlLineDto {
  @ApiProperty({
    description: '省份名称',
    example: '江苏',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: '省份不能为空' })
  province: string;

  @ApiProperty({
    description: '年份',
    example: '2025',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: '年份不能为空' })
  year: string;

  @ApiProperty({
    description: '类型名称（可选，如：物理类、历史类等）',
    example: '物理类',
    required: false,
  })
  @IsString()
  @IsOptional()
  typeName?: string;

  @ApiProperty({
    description: '批次名称（可选）',
    example: '本科批',
    required: false,
  })
  @IsString()
  @IsOptional()
  batchName?: string;
}

