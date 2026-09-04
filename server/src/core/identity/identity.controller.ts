import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { IdentityService } from './identity.service';
import {
  AuthGuard,
  CurrentUser,
  Public,
  RequirePermissions,
  PermissionsGuard,
} from '../gateway';
import type { AuthenticatedUser } from '../contracts';

class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

class RegisterDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

@Controller('api/platform/auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.identity.login(body);
  }

  @Public()
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.identity.register(body);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.identity.refresh(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@Headers('authorization') authorization?: string) {
    if (authorization) {
      return this.identity.logout(authorization).then(() => ({ ok: true }));
    }
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
