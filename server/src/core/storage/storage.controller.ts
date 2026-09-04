import { Controller, Get, Query } from '@nestjs/common';
import { StorageService } from './storage.service';

@Controller('api/platform/storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  list(@Query('module') module?: string) {
    return this.storage.list(module);
  }
}
