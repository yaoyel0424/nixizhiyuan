import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 获取分数范围信息查询参数 DTO
 */
export class GetScoreRangeDto {
  @ApiProperty({
    description: '省份名称',
    example: '北京',
  })
  @IsString()
  @IsNotEmpty({ message: '省份名称不能为空' })
  provinceName: string;

  @ApiProperty({
    description: '科目类型',
    example: '物理',
  })
  @IsString()
  @IsNotEmpty({ message: '科目类型不能为空' })
  subjectType: string;

  @ApiProperty({
    description: '分数键值',
    example: '650',
  })
  @IsString()
  @IsNotEmpty({ message: '分数键值不能为空' })
  score: string;
}

