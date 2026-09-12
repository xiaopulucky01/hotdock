import { Global, Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { RbacModule } from '../rbac/rbac.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';

@Global()
@Module({
  imports: [UserModule, RbacModule, AuditModule],
  controllers: [IdentityController, ApiKeyController, OAuthController],
  providers: [IdentityService, ApiKeyService, OAuthService],
  exports: [IdentityService, ApiKeyService, OAuthService],
})
export class IdentityModule {}
