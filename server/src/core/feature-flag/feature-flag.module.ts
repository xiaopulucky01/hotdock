import { Global, Module } from '@nestjs/common';
import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagService } from './feature-flag.service';

@Global()
@Module({
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
