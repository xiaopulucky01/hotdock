import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IdentityService } from './identity.service';

class LoginDto {
  username!: string;
  password!: string;
  tenantId?: string;
}

class RegisterDto {
  username!: string;
  password!: string;
  email?: string;
  tenantId?: string;
}

@Controller('api/platform/auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.identity.login(body);
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.identity.register(body);
  }

  @Post('logout')
  logout(@Headers('authorization') authorization?: string) {
    if (authorization) {
      const token = authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : authorization;
      this.identity.logout(token);
    }
    return { ok: true };
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.identity.authenticate(authorization ?? '');
  }
}
