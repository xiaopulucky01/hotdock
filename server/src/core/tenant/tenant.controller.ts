import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Controller('api/platform/tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  list() {
    return this.tenants.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tenants.require(id);
  }

  @Post()
  create(@Body() body: { code: string; name: string }) {
    return this.tenants.create(body);
  }
}
