import { Controller, Get, UseGuards } from '@nestjs/common';
import { CommandBusService } from './command-bus.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/commands')
@UseGuards(AuthGuard, PermissionsGuard)
export class CommandController {
  constructor(private readonly commands: CommandBusService) {}

  @Get()
  @RequirePermissions('platform.config.read')
  list() {
    return this.commands.list();
  }
}
