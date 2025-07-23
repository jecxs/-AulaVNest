// modules/dto/reorder-modules.dto.ts
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ModuleOrderDto {
  @IsString()
  id: string;

  @IsNumber()
  @Type(() => Number)
  order: number;
}

export class ReorderModulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleOrderDto)
  modules: ModuleOrderDto[];
}
