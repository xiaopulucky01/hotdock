import { Global, Module } from '@nestjs/common';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { ExtensionController } from './extension.controller';
import { ExtensionService } from './extension.service';

@Global()
@Module({
  imports: [FeatureFlagModule],
  controllers: [ExtensionController],
  providers: [ExtensionService],
  exports: [ExtensionService],
})
export class ExtensionModule {}
