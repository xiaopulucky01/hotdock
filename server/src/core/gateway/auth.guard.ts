import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IdentityService } from '../identity/identity.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly identity: IdentityService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: unknown;
    }>();
    const auth = req.headers.authorization;
    if (!auth) {
      throw new UnauthorizedException('Authorization required');
    }
    req.user = this.identity.authenticate(auth);
    return true;
  }
}
