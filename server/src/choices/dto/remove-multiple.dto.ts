import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, ArrayMinSize } from 'class-validator';

/**
 * 批量删除志愿选择的 DTO
 */
export class RemoveMultipleDto {
  @ApiProperty({
    description: '要删除的志愿选择ID数组',
    type: [Number],
    example: [1, 2, 3],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: '至少需要提供一个ID' })
  @IsNumber({}, { each: true, message: '每个ID必须是数字' })
  ids: number[];
}
