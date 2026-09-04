import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';
import { AuthGuard, PermissionsGuard, RequirePermissions } from '../gateway';
import { NotificationService } from './notification.service';

class RegisterWebhookDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @IsOptional()
  @IsString()
  secret?: string;
}

@Controller('api/platform/notifications')
@UseGuards(AuthGuard, PermissionsGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get('webhooks')
  @RequirePermissions('platform.config.manage')
  listWebhooks() {
    return this.notifications.listWebhooks();
  }

  @Post('webhooks')
  @RequirePermissions('platform.config.manage')
  register(@Body() body: RegisterWebhookDto) {
    return this.notifications.registerWebhook(body);
  }

  @Delete('webhooks/:id')
  @RequirePermissions('platform.config.manage')
  remove(@Param('id') id: string) {
    return this.notifications.removeWebhook(id).then(() => ({ ok: true }));
  }

  @Get('recent')
  @RequirePermissions('platform.audit.read')
  recent(@Query('limit') limit?: string) {
    return this.notifications.recent(limit ? Number(limit) : 50);
  }
}
