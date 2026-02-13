import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDefined, IsOptional, ValidateIf } from 'class-validator';

/** 更新量表 content 的请求 DTO */
export class UpdateScaleContentDto {
  @ApiProperty({ description: '量表题干内容', example: '我喜欢观察周围的环境' })
  @IsString()
  @IsNotEmpty({ message: 'content 不能为空' })
  content: string;
}

/** 更新选项 optionName 的请求 DTO */
export class UpdateOptionOptionNameDto {
  @ApiProperty({ description: '选项名称', example: '非常同意' })
  @IsString()
  @IsNotEmpty({ message: 'optionName 不能为空' })
  optionName: string;
}

/** 更新选项 additionalInfo 的请求 DTO（可为 null 表示清空） */
export class UpdateOptionAdditionalInfoDto {
  @ApiProperty({ description: '附加信息', nullable: true })
  @IsDefined({ message: 'additionalInfo 字段必须存在（可为 null）' })
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  additionalInfo: string | null;
}

/** 合并更新选项：optionName、additionalInfo 均可选，传哪个更新哪个 */
export class UpdateOptionDto {
  @ApiProperty({ description: '选项名称', required: false })
  @IsOptional()
  @IsString()
  optionName?: string;

  @ApiProperty({ description: '附加信息', nullable: true, required: false })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  additionalInfo?: string | null;
}
