import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, IsArray, MinLength } from 'class-validator';
import { OAuthService } from './oauth.service';
import {
  AuthGuard,
  PermissionsGuard,
  Public,
  RequirePermissions,
} from '../gateway';

class UpsertProviderDto {
  @IsString() id!: string;
  @IsString() displayName!: string;
  @IsString() clientId!: string;
  @IsString() @MinLength(1) clientSecret!: string;
  @IsString() authorizeUrl!: string;
  @IsString() tokenUrl!: string;
  @IsString() userInfoUrl!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) scopes?: string[];
  @IsBoolean() enabled!: boolean;
}

class StartDto {
  @IsString() redirectUri!: string;
  @IsOptional() @IsString() tenantId?: string;
}

class CallbackDto {
  @IsString() code!: string;
  @IsString() state!: string;
}

@Controller('api/platform/auth/oauth')
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Public()
  @Get('providers')
  providers() {
    return this.oauth.listProviders();
  }

  @Post('providers')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('platform.config.manage')
  upsert(@Body() body: UpsertProviderDto) {
    return this.oauth.upsertProvider(body);
  }

  @Public()
  @Post(':provider/start')
  start(@Param('provider') provider: string, @Body() body: StartDto) {
    return this.oauth.start(provider, body.redirectUri, body.tenantId);
  }

  @Public()
  @Post('callback')
  callback(@Body() body: CallbackDto) {
    return this.oauth.callback(body);
  }

  @Public()
  @Get('callback')
  callbackGet(@Query('code') code: string, @Query('state') state: string) {
    return this.oauth.callback({ code, state });
  }
}
