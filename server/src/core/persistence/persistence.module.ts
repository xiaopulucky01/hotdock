import { Global, Module } from '@nestjs/common';
import { FilePersistenceAdapter } from './file-persistence.adapter';
import { PersistenceService } from './persistence.service';
import { PERSISTENCE_ADAPTER } from './persistence.types';

@Global()
@Module({
  providers: [
    FilePersistenceAdapter,
    { provide: PERSISTENCE_ADAPTER, useExisting: FilePersistenceAdapter },
    PersistenceService,
  ],
  exports: [PersistenceService, PERSISTENCE_ADAPTER],
})
export class PersistenceModule {}
