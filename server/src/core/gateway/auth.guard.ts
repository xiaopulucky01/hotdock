import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdentityService } from '../identity/identity.service';
import { ApiKeyService } from '../identity/api-key.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly identity: IdentityService,
    private readonly apiKeys: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: unknown;
    }>();
    const auth = req.headers.authorization;
    if (!auth) {
      throw new UnauthorizedException('Authorization required');
    }
    const raw = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    if (raw.startsWith('hdk_')) {
      req.user = this.apiKeys.authenticate(raw);
    } else {
      req.user = this.identity.authenticate(auth);
    }
    return true;
  }
}
