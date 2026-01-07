import { Expose } from 'class-transformer';

/**
 * 省控线响应 DTO
 */
export class ProvincialControlLineResponseDto {
  @Expose()
  id: number;
 
  @Expose()
  typeName: string | null;

  @Expose()
  batchName: string | null;
 

  @Expose()
  score: number | null;

  @Expose()
  rank: number | null;

  @Expose()
  year: string | null;

  @Expose()
  province: string | null;

  @Expose()
  scoreSection: string | null;

  @Expose()
  name: string | null;
}

