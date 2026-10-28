import { DEMO_DB_NAME, LIVE_DB_NAME } from './store.constants';

/**
 * Replace the database name in a MongoDB URI.
 * e.g. ...mongodb.net/ace_finance?x=1 → ...mongodb.net/ace_finance_demo?x=1
 */
export function withMongoDatabaseName(uri: string, databaseName: string): string {
  const trimmed = uri.trim();
  const match = trimmed.match(/^(?<base>.*\/)(?<db>[^/?]+)(?<query>\?.*)?$/);
  if (!match?.groups?.base || !match.groups.db) {
    throw new Error(
      'Cannot parse database name from MongoDB URI. Set MONGODB_URI and MONGODB_URI_DEMO explicitly.',
    );
  }
  return `${match.groups.base}${databaseName}${match.groups.query || ''}`;
}

/** Live URI as configured. */
export function resolveLiveMongoUri(uri: string): string {
  return uri.trim();
}

/** Fail boot if live and demo point at the same database (data bleed risk). */
export function assertDistinctLiveDemoUris(
  liveUri: string,
  demoUri: string,
): void {
  const live = liveUri.trim();
  const demo = demoUri.trim();
  if (!live || !demo) {
    throw new Error('MONGODB_URI and demo Mongo URI are required.');
  }
  if (live === demo) {
    throw new Error(
      'MONGODB_URI and MONGODB_URI_DEMO must be different (live ≠ demo).',
    );
  }
  const dbName = (uri: string) => uri.match(/\/([^/?]+)(\?|$)/)?.[1] || '';
  const liveDb = dbName(live);
  const demoDb = dbName(demo);
  if (liveDb && demoDb && liveDb === demoDb) {
    throw new Error(
      `Live and demo Mongo URIs resolve to the same database "${liveDb}". Use ace_finance vs ace_finance_demo (or set MONGODB_URI_DEMO).`,
    );
  }
}

/**
 * Demo URI: MONGODB_URI_DEMO if set, else same cluster with database ace_finance_demo.
 */
export function resolveDemoMongoUri(
  liveUri: string,
  demoUri?: string | null,
): string {
  const explicit = demoUri?.trim();
  if (explicit) return explicit;

  const live = liveUri.trim();
  const match = live.match(/\/([^/?]+)(\?|$)/);
  const liveDb = match?.[1] || LIVE_DB_NAME;
  const demoDb =
    liveDb === DEMO_DB_NAME || liveDb.endsWith('_demo')
      ? liveDb
      : liveDb === LIVE_DB_NAME
        ? DEMO_DB_NAME
        : `${liveDb}_demo`;
  return withMongoDatabaseName(live, demoDb);
}
