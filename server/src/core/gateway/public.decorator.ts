import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'platform:isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const SKIP_TENANT_KEY = 'platform:skipTenant';
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);

export const REQUIRE_MODULE_KEY = 'platform:requireModule';
export const RequireModule = (moduleName: string) =>
  SetMetadata(REQUIRE_MODULE_KEY, moduleName);
