import { Global, Module } from '@nestjs/common';
import { FilePersistenceAdapter } from './file-persistence.adapter';
import { PersistenceService } from './persistence.service';
import { DocumentRepository } from './document.repository';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import { PERSISTENCE_ADAPTER } from './persistence.types';

@Global()
@Module({
  providers: [
    FilePersistenceAdapter,
    { provide: PERSISTENCE_ADAPTER, useExisting: FilePersistenceAdapter },
    PersistenceService,
    DocumentRepository,
    MigrationService,
  ],
  controllers: [MigrationController],
  exports: [
    PersistenceService,
    PERSISTENCE_ADAPTER,
    DocumentRepository,
    MigrationService,
  ],
})
export class PersistenceModule {}
