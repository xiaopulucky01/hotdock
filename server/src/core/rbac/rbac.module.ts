import { Global, Module } from '@nestjs/common';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { ResourceAclService } from './resource-acl.service';
import { ResourceAclController } from './resource-acl.controller';

@Global()
@Module({
  controllers: [RbacController, ResourceAclController],
  providers: [RbacService, ResourceAclService],
  exports: [RbacService, ResourceAclService],
})
export class RbacModule {}
