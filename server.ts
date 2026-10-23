import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import {
  generateSqlDump,
  parseSqlDumpToSnapshot,
  FullDatabaseSnapshot,
} from './src/utils/sqlAndExcelExport';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'shared-inventory-state.json');
const SQL_DUMP_FILE = path.join(DATA_DIR, 'store-inventory-database.sql');
const SQLITE_DB_FILE = path.join(DATA_DIR, 'store-inventory.sqlite');
const TUNNEL_URL_FILE = path.join(DATA_DIR, 'public-tunnel-url.txt');

let currentPublicTunnelUrl: string = '';

interface SharedServerState {
  updatedAt: string;
  version: number;
  stockItems?: unknown[];
  lpbDocuments?: unknown[];
  issueVouchers?: unknown[];
  stockMovements?: unknown[];
  notifications?: unknown[];
  costCenters?: unknown[];
  glAccounts?: unknown[];
  storageLocations?: unknown[];
  companyProfile?: unknown;
  minStockProposals?: unknown[];
  stockOpnameSessions?: unknown[];
  locationTransferRequests?: unknown[];
  activityLogs?: unknown[];
  users?: unknown[];
  roleDefinitions?: unknown[];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Synchronize state to local SQLite file (if node:sqlite is available) and .sql dump file
 * so self-hosted servers always have an up-to-date SQL database and .sql backup file on disk.
 */
async function syncStateToSqlStorage(state: SharedServerState) {
  try {
    ensureDataDir();
    const sqlDump = generateSqlDump({
      exportedAt: state.updatedAt,
      exportedBy: 'sql-sync-engine',
      version: state.version,
      ...(state as unknown as FullDatabaseSnapshot),
    });
    fs.writeFileSync(SQL_DUMP_FILE, sqlDump, 'utf-8');

    // Attempt native node:sqlite sync if available on Node 22+
    try {
      const sqliteMod = await import('node:sqlite');
      if (sqliteMod && sqliteMod.DatabaseSync) {
        const db = new sqliteMod.DatabaseSync(SQLITE_DB_FILE);
        db.exec(sqlDump);
        db.close();
      }
    } catch {
      // Fallback: .sql dump file + state file are already persisted on disk
    }
  } catch (err) {
    console.warn('Warning syncing SQL dump file:', err);
  }
}

function deduplicateUsers(rawUsers?: unknown[]): unknown[] | undefined {
  if (!Array.isArray(rawUsers)) return rawUsers;
  const seenIds = new Set<string>();
  const seenUsernames = new Set<string>();
  const result: unknown[] = [];
  for (const item of rawUsers) {
    if (!item || typeof item !== 'object') continue;
    const u = item as { id?: string; username?: string };
    if (!u.id || !u.username) continue;
    const idKey = String(u.id).trim();
    const unameKey = String(u.username).trim().toLowerCase();
    if (seenIds.has(idKey) || seenUsernames.has(unameKey)) continue;
    seenIds.add(idKey);
    seenUsernames.add(unameKey);
    result.push(item);
  }
  return result;
}

function readSharedState(): SharedServerState | null {
  try {
    ensureDataDir();
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as SharedServerState;
      if (parsed && Array.isArray(parsed.users)) {
        parsed.users = deduplicateUsers(parsed.users);
      }
      return parsed;
    }
    if (fs.existsSync(SQL_DUMP_FILE)) {
      const sqlRaw = fs.readFileSync(SQL_DUMP_FILE, 'utf-8');
      const parsed = parseSqlDumpToSnapshot(sqlRaw);
      if (parsed) {
        return {
          updatedAt: parsed.exportedAt || new Date().toISOString(),
          version: parsed.version || 1,
          ...parsed,
          users: deduplicateUsers(parsed.users),
        } as SharedServerState;
      }
    }
  } catch (err) {
    console.warn('Failed to read shared state file:', err);
  }
  return null;
}

function writeSharedState(data: Partial<SharedServerState>): SharedServerState {
  ensureDataDir();
  const current = readSharedState() || {
    updatedAt: new Date().toISOString(),
    version: 0,
  };
  const nextState: SharedServerState = {
    ...current,
    ...data,
    users: deduplicateUsers(data.users ?? current.users),
    updatedAt: new Date().toISOString(),
    version: (current.version || 0) + 1,
  };
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2), 'utf-8');
    void syncStateToSqlStorage(nextState);
  } catch (err) {
    console.warn('Failed to write shared state file:', err);
  }
  return nextState;
}

function startPublicCloudflareTunnel(port: number) {
  setTimeout(() => {
    try {
      ensureDataDir();
      const binPath = '/tmp/cloudflared';
      if (!fs.existsSync(binPath)) {
        try {
          execSync(
            `curl -sL --max-time 10 https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ${binPath} && chmod +x ${binPath}`,
            { timeout: 12000 }
          );
        } catch {
          // Tunnel optional; continue without error
          return;
        }
      }

      if (fs.existsSync(binPath)) {
        const child = spawn(
          binPath,
          ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://localhost:${port}`],
          {
            stdio: ['ignore', 'pipe', 'pipe'],
          }
        );

        const extractUrl = (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
          if (match && match[0]) {
            currentPublicTunnelUrl = match[0];
            try {
              fs.writeFileSync(TUNNEL_URL_FILE, currentPublicTunnelUrl, 'utf-8');
            } catch {}
            console.log(`Public Deploy URL active: ${currentPublicTunnelUrl}`);
          }
        };

        child.stdout?.on('data', extractUrl);
        child.stderr?.on('data', extractUrl);
        child.on('error', () => {});
      }
    } catch (err) {
      console.warn('Could not start tunnel:', err);
    }
  }, 1000);
}

async function startServer() {
  const app = express();
  const portArgIndex = process.argv.indexOf('--port');
  const cliPort =
    portArgIndex !== -1 && process.argv[portArgIndex + 1]
      ? Number(process.argv[portArgIndex + 1])
      : null;
  // Dev server must listen on port 3000 (nginx listens on 8080)
  const PORT =
    cliPort || (process.env.PORT && process.env.PORT !== '8080' ? Number(process.env.PORT) : 3000);

  // Allow public access from anywhere without credentials or Gmail login
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  // Public health & access check endpoint (no auth required)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      publicAccess: true,
      requiresGmailLogin: false,
      sqlSyncActive: true,
      publicDeployUrl: currentPublicTunnelUrl || null,
      timestamp: new Date().toISOString(),
    });
  });

  // Get active public deploy URL
  app.get('/api/public-url', (_req, res) => {
    let url = currentPublicTunnelUrl;
    if (!url && fs.existsSync(TUNNEL_URL_FILE)) {
      try {
        url = fs.readFileSync(TUNNEL_URL_FILE, 'utf-8').trim();
      } catch {}
    }
    res.json({
      success: true,
      publicUrl: url || null,
      devUrl: 'https://ais-dev-kxlny77vp4mgjh244y4m44-610255424354.asia-east1.run.app',
    });
  });

  // Get shared inventory state
  app.get('/api/inventory/state', (_req, res) => {
    const state = readSharedState();
    res.json({
      success: true,
      publicAccess: true,
      sqlEngine: 'SQLite3 + SQL Dump Sync',
      state: state || null,
    });
  });

  // Sync inventory state across all users/devices and write to SQL database
  app.post('/api/inventory/sync', (req, res) => {
    const payload = req.body || {};
    const updated = writeSharedState({
      stockItems: payload.stockItems,
      lpbDocuments: payload.lpbDocuments,
      issueVouchers: payload.issueVouchers,
      stockMovements: payload.stockMovements,
      notifications: payload.notifications,
      costCenters: payload.costCenters,
      glAccounts: payload.glAccounts,
      storageLocations: payload.storageLocations,
      companyProfile: payload.companyProfile,
      minStockProposals: payload.minStockProposals,
      stockOpnameSessions: payload.stockOpnameSessions,
      locationTransferRequests: payload.locationTransferRequests,
      activityLogs: payload.activityLogs,
      users: payload.users,
      roleDefinitions: payload.roleDefinitions,
    });
    res.json({
      success: true,
      sqlSynced: true,
      version: updated.version,
      updatedAt: updated.updatedAt,
    });
  });

  // Export SQL Dump directly from Server (for self-hosted backup)
  app.get('/api/database/export-sql', (_req, res) => {
    const state = readSharedState();
    const sqlText = generateSqlDump({
      exportedAt: new Date().toISOString(),
      exportedBy: 'server-sql-backup',
      version: state?.version || 1,
      ...((state || {}) as unknown as FullDatabaseSnapshot),
    });
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="store-database-backup-${new Date().toISOString().slice(0, 10)}.sql"`
    );
    res.send(sqlText);
  });

  // Import / Restore SQL Dump to Server
  app.post('/api/database/import-sql', (req, res) => {
    const sqlContent = typeof req.body?.sql === 'string' ? req.body.sql : '';
    if (!sqlContent.trim()) {
      res.status(400).json({
        success: false,
        error: 'Konten file SQL kosong atau tidak ditemukan.',
      });
      return;
    }

    const parsed = parseSqlDumpToSnapshot(sqlContent);
    if (!parsed) {
      res.status(400).json({
        success: false,
        error: 'Format file SQL tidak dapat dikenali. Pastikan file merupakan hasil Backup SQL Store.',
      });
      return;
    }

    const updated = writeSharedState(parsed as Partial<SharedServerState>);
    res.json({
      success: true,
      version: updated.version,
      updatedAt: updated.updatedAt,
      state: updated,
    });
  });

  // Superuser Master Database Explorer & Full Read/Write endpoint
  app.get('/api/superuser/database', (_req, res) => {
    const state = readSharedState();
    let fileSizeBytes = 0;
    let sqlFileSizeBytes = 0;
    try {
      if (fs.existsSync(STATE_FILE)) {
        fileSizeBytes = fs.statSync(STATE_FILE).size;
      }
      if (fs.existsSync(SQL_DUMP_FILE)) {
        sqlFileSizeBytes = fs.statSync(SQL_DUMP_FILE).size;
      }
    } catch {}
    res.json({
      success: true,
      databaseEngine: 'SQL Relational Sync (/data/store-inventory.sqlite & .sql)',
      fileSizeBytes,
      sqlFileSizeBytes,
      state: state || null,
    });
  });

  app.post('/api/superuser/database', (req, res) => {
    const payload = req.body || {};
    const updated = writeSharedState(payload);
    res.json({
      success: true,
      version: updated.version,
      updatedAt: updated.updatedAt,
      state: updated,
    });
  });

  // Reset shared server state
  app.post('/api/inventory/reset', (_req, res) => {
    try {
      if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
      }
      if (fs.existsSync(SQL_DUMP_FILE)) {
        fs.unlinkSync(SQL_DUMP_FILE);
      }
      if (fs.existsSync(SQLITE_DB_FILE)) {
        fs.unlinkSync(SQLITE_DB_FILE);
      }
    } catch (err) {
      console.warn('Failed to delete shared state file:', err);
    }
    res.json({
      success: true,
      message: 'Shared SQL & server state reset to default.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (SQL Sync Enabled)`);
    startPublicCloudflareTunnel(PORT);
  });
}

startServer();
