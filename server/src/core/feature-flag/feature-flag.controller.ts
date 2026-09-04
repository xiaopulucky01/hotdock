import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { FeatureFlagService } from './feature-flag.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

class SetFeatureDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsArray()
  tenants?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;
}

@Controller('api/platform/features')
@UseGuards(AuthGuard, PermissionsGuard)
export class FeatureFlagController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Get()
  @RequirePermissions('platform.config.manage')
  list() {
    return this.flags.list();
  }

  @Get('detailed')
  @RequirePermissions('platform.config.manage')
  detailed() {
    return this.flags.listDetailed();
  }

  @Get(':flag')
  @RequirePermissions('platform.config.manage')
  get(@Param('flag') flag: string) {
    return { flag, enabled: this.flags.isEnabled(flag) };
  }

  @Put(':flag')
  @RequirePermissions('platform.config.manage')
  set(@Param('flag') flag: string, @Body() body: SetFeatureDto) {
    this.flags.set(flag, body.enabled, {
      tenants: body.tenants,
      percentage: body.percentage,
    });
    return { flag, enabled: body.enabled };
  }
}
