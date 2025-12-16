import { EntityMetadata } from 'typeorm/metadata/EntityMetadata';
import { EntityMetadataValidator } from 'typeorm/metadata-builder/EntityMetadataValidator';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { Driver } from 'typeorm/driver/Driver';

type DriverLike = {
  options?: {
    type?: string;
  };
};

const shouldPatch = (): boolean => {
  if (process.env.TYPEORM_DISABLE_METADATA_PATCH === 'true') {
    return false;
  }
  // Allow explicit opt-in via env but default to enabled so development Postgres works too.
  if (process.env.TYPEORM_FORCE_METADATA_PATCH === 'true') {
    return true;
  }
  return true;
};

const normalizeColumnTypes = (
  columns: ColumnMetadata[],
  driver?: DriverLike,
) => {
  const dbType = driver?.options?.type;
  if (!dbType) return;

  if (dbType === 'postgres') {
    columns.forEach((column) => {
      if ((column.type as unknown) === Object) {
        column.type = 'varchar';
      }
      if (column.type === 'datetime') {
        column.type = 'timestamp';
      }
    });
    return;
  }

  // SQLite driver doesn't support native enum type; use simple-enum.
  if (dbType === 'sqlite') {
    columns.forEach((column) => {
      if (column.type === 'enum') {
        column.type = 'simple-enum';
      }
      if (column.type === 'jsonb' || column.type === 'json') {
        column.type = 'simple-json';
      }
      if (column.type === 'timestamptz' || column.type === 'timestamp') {
        column.type = 'datetime';
      }
    });
  }
};

export const patchTypeOrmMetadataForTests = () => {
  if (!shouldPatch()) {
    return;
  }
  const validator =
    EntityMetadataValidator.prototype as EntityMetadataValidator & {
      __patchedForTests?: boolean;
    };
  if (validator.__patchedForTests) {
    return;
  }
  const originalValidate = validator.validate.bind(validator);
  validator.validate = function patchedValidate(
    entityMetadata: EntityMetadata,
    allEntityMetadatas: EntityMetadata[],
    currentDriver: Driver,
  ) {
    if (entityMetadata?.columns?.length) {
      normalizeColumnTypes(entityMetadata.columns, currentDriver);
    }
    return originalValidate.call(
      this,
      entityMetadata,
      allEntityMetadatas,
      currentDriver,
    );
  };
  validator.__patchedForTests = true;
};

patchTypeOrmMetadataForTests();
