import { Global, Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { RbacModule } from '../rbac/rbac.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Global()
@Module({
  imports: [UserModule, RbacModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
