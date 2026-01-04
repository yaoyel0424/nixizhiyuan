import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

/**
 * 查询学校专业 DTO
 */
export class QuerySchoolMajorsDto {
  @ApiProperty({
    description: '学校代码',
    example: '10001',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: '学校代码不能为空' })
  schoolCode: string;
}

