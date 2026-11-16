import fs from 'fs';
import path from 'path';
import type { AdminLicenseRecord, StoredCustomerAccount } from './adminAuthLogic';

interface PersistedStore {
  licenses: AdminLicenseRecord[];
  customers: StoredCustomerAccount[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'crm_store.json');

function ensureStore(): PersistedStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const empty: PersistedStore = { licenses: [], customers: [] };
      fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2), 'utf8');
      return empty;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    return {
      licenses: Array.isArray(parsed.licenses) ? parsed.licenses : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
    };
  } catch {
    return { licenses: [], customers: [] };
  }
}

function saveStore(store: PersistedStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

export function listStoredLicenses(): AdminLicenseRecord[] {
  return ensureStore().licenses;
}

export function addStoredLicense(record: AdminLicenseRecord): AdminLicenseRecord {
  const store = ensureStore();
  store.licenses.unshift(record);
  saveStore(store);
  return record;
}

export function updateStoredLicenseStatus(
  id: string,
  status: 'ACTIVE' | 'REVOKED'
): AdminLicenseRecord | null {
  const store = ensureStore();
  const idx = store.licenses.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  store.licenses[idx] = {
    ...store.licenses[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);
  return store.licenses[idx];
}

export function deleteStoredLicense(id: string): boolean {
  const store = ensureStore();
  const next = store.licenses.filter((l) => l.id !== id);
  if (next.length === store.licenses.length) return false;
  store.licenses = next;
  saveStore(store);
  return true;
}

export function findCustomerByEmail(email: string): StoredCustomerAccount | null {
  const clean = email.trim().toLowerCase();
  return ensureStore().customers.find((c) => c.email.toLowerCase() === clean) ?? null;
}

export function createCustomerAccount(
  account: StoredCustomerAccount
): StoredCustomerAccount {
  const store = ensureStore();
  store.customers.push(account);
  saveStore(store);
  return account;
}
