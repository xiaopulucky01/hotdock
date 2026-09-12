import { Global, Module } from '@nestjs/common';
import { CommandBusService } from './command-bus.service';
import { CommandController } from './command.controller';

@Global()
@Module({
  providers: [CommandBusService],
  controllers: [CommandController],
  exports: [CommandBusService],
})
export class CommandModule {}
