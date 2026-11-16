import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  createSignedSessionToken,
  generateCryptographicLicenseKey,
  hashPassword,
  isAllowlistedAdminEmail,
  parseCookies,
  validateLicenseCreateInput,
  verifyAdminCredentials,
  verifyPassword,
  verifySignedSessionToken,
  type SessionPayload,
} from './server/adminAuthLogic';
import {
  addStoredLicense,
  createCustomerAccount,
  deleteStoredLicense,
  findCustomerByEmail,
  listStoredLicenses,
  updateStoredLicenseStatus,
} from './server/dataStore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const SESSION_COOKIE_NAME = 'acrm_session';

const rawEnvSecret = (process.env.ADMIN_SESSION_SECRET || '').trim();
const SESSION_SECRET =
  rawEnvSecret && rawEnvSecret !== 'MY_ADMIN_SESSION_SECRET'
    ? rawEnvSecret
    : crypto.randomBytes(32).toString('hex');

function getFirebaseApiKey(): string | null {
  try {
    const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const parsed = JSON.parse(raw) as { apiKey?: string };
    return parsed.apiKey || null;
  } catch {
    return null;
  }
}

function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  return verifySignedSessionToken(token, SESSION_SECRET);
}

function setSessionCookie(res: Response, token: string): void {
  const isHttps = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=43200',
  ];
  if (isHttps) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function requireAdmin(req: Request, res: Response): SessionPayload | null {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return null;
  }
  return session;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'automation-crm',
      aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      timestamp: new Date().toISOString(),
    });
  });

  // Current Authenticated Session Status
  app.get('/api/auth/session', (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.json({ authenticated: false, role: null });
      return;
    }
    res.json({
      authenticated: true,
      role: session.role,
      email: session.email,
      displayName: session.displayName,
      provider: session.provider,
    });
  });

  // Dedicated Admin Credential Login (Strictly Admin Only)
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    if (!verifyAdminCredentials(username, password)) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    const token = createSignedSessionToken(
      {
        sub: 'admin:default',
        role: 'admin',
        email: 'biplob168896@gmail.com',
        displayName: 'Biplob Ahmed',
        provider: 'admin_credentials',
      },
      SESSION_SECRET
    );
    setSessionCookie(res, token);
    res.json({
      authenticated: true,
      role: 'admin',
      email: 'biplob168896@gmail.com',
      displayName: 'Biplob Ahmed',
      provider: 'admin_credentials',
    });
  });

  // Customer Business Account Registration
  app.post('/api/auth/register', (req, res) => {
    const { email, password, displayName, businessName } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof displayName === 'string' ? displayName.trim().slice(0, 80) : '';
    const cleanBiz = typeof businessName === 'string' ? businessName.trim().slice(0, 120) : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Display name must be at least 2 characters.' });
      return;
    }
    if (isAllowlistedAdminEmail(cleanEmail)) {
      res.status(403).json({ error: 'This email is reserved. Sign in via authorized portal.' });
      return;
    }
    if (findCustomerByEmail(cleanEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const account = createCustomerAccount({
      id: `cust_${crypto.randomBytes(8).toString('hex')}`,
      email: cleanEmail,
      displayName: cleanName,
      businessName: cleanBiz || cleanName,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    });

    const token = createSignedSessionToken(
      {
        sub: account.id,
        role: 'customer',
        email: account.email,
        displayName: account.displayName,
        provider: 'customer_email',
      },
      SESSION_SECRET
    );
    setSessionCookie(res, token);
    res.status(201).json({
      authenticated: true,
      role: 'customer',
      email: account.email,
      displayName: account.displayName,
      businessName: account.businessName,
      provider: 'customer_email',
    });
  });

  // Customer Business Account Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    if (isAllowlistedAdminEmail(cleanEmail)) {
      res.status(403).json({ error: 'Use Admin Portal or verified Google Admin sign-in.' });
      return;
    }
    const account = findCustomerByEmail(cleanEmail);
    if (!account || !verifyPassword(password, account.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = createSignedSessionToken(
      {
        sub: account.id,
        role: 'customer',
        email: account.email,
        displayName: account.displayName,
        provider: 'customer_email',
      },
      SESSION_SECRET
    );
    setSessionCookie(res, token);
    res.json({
      authenticated: true,
      role: 'customer',
      email: account.email,
      displayName: account.displayName,
      businessName: account.businessName,
      provider: 'customer_email',
    });
  });

  // Verify Firebase Google ID Token server-side to assign Admin vs Customer role securely
  app.post('/api/auth/firebase-session', async (req, res) => {
    const { idToken } = req.body ?? {};
    if (typeof idToken !== 'string' || idToken.length < 20) {
      res.status(400).json({ error: 'Valid Firebase ID token is required.' });
      return;
    }
    const apiKey = getFirebaseApiKey();
    if (!apiKey) {
      res.status(503).json({ error: 'Firebase configuration missing on server.' });
      return;
    }

    try {
      const lookupRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      if (!lookupRes.ok) {
        res.status(401).json({ error: 'Invalid Firebase session token.' });
        return;
      }
      const lookupData = (await lookupRes.json()) as {
        users?: { localId?: string; email?: string; emailVerified?: boolean; displayName?: string }[];
      };
      const fbUser = lookupData.users?.[0];
      if (!fbUser || !fbUser.email || !fbUser.emailVerified) {
        res.status(401).json({ error: 'Verified Google email is required.' });
        return;
      }

      const isAdminUser = isAllowlistedAdminEmail(fbUser.email);
      const role = isAdminUser ? 'admin' : 'customer';
      const provider = isAdminUser ? 'google_admin' : 'google_customer';
      const displayName = fbUser.displayName || fbUser.email.split('@')[0];

      const token = createSignedSessionToken(
        {
          sub: fbUser.localId || fbUser.email,
          role,
          email: fbUser.email,
          displayName,
          provider,
        },
        SESSION_SECRET
      );
      setSessionCookie(res, token);
      res.json({
        authenticated: true,
        role,
        email: fbUser.email,
        displayName,
        provider,
      });
    } catch {
      res.status(500).json({ error: 'Failed to verify Google session.' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // Strictly Admin-Only License Bar & Key Generation Endpoints
  app.get('/api/admin/licenses', (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    res.json({ licenses: listStoredLicenses() });
  });

  app.post('/api/admin/licenses', (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const validated = validateLicenseCreateInput(req.body ?? {});
    if (validated.ok === false) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const now = new Date().toISOString();
    const record = addStoredLicense({
      id: `lic_${crypto.randomBytes(6).toString('hex')}`,
      licenseKey: generateCryptographicLicenseKey(
        validated.data.tier,
        validated.data.customerName
      ),
      tier: validated.data.tier,
      customerName: validated.data.customerName,
      customerEmail: validated.data.customerEmail,
      status: 'ACTIVE',
      validDays: validated.data.validDays,
      createdBy: admin.email || admin.sub,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({ license: record });
  });

  app.patch('/api/admin/licenses/:id', (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const status = req.body?.status;
    if (status !== 'ACTIVE' && status !== 'REVOKED') {
      res.status(400).json({ error: 'Status must be ACTIVE or REVOKED.' });
      return;
    }

    const updated = updateStoredLicenseStatus(req.params.id, status);
    if (!updated) {
      res.status(404).json({ error: 'License record not found.' });
      return;
    }
    res.json({ license: updated });
  });

  app.delete('/api/admin/licenses/:id', (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const removed = deleteStoredLicense(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'License record not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // Meta WhatsApp / Messenger Webhook verification & receiver
  app.get('/api/webhooks/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN || 'automation_crm_verify_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      res.status(200).send(String(challenge ?? ''));
      return;
    }
    res.status(403).json({ error: 'Webhook verification failed' });
  });

  app.post('/api/webhooks/meta', (req, res) => {
    const payload = req.body;
    res.status(200).json({ received: true, object: payload?.object ?? 'unknown' });
  });

  // Server-side Gemini Smart Reply Drafter & Order Extractor
  app.post('/api/ai/draft-reply', async (req, res) => {
    try {
      const { customerName, channel, customerMessage, businessName, language, recentHistory } = req.body ?? {};
      if (!customerMessage || typeof customerMessage !== 'string') {
        res.status(400).json({ error: 'customerMessage is required' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in server secrets.',
          code: 'API_KEY_MISSING',
        });
        return;
      }

      const targetLang = language === 'en' ? 'English' : 'Bengali (natural polite Bangladeshi e-commerce tone)';
      const prompt = [
        `Business: ${businessName || 'Automation CRM Store'}`,
        `Channel: ${channel || 'WHATSAPP'}`,
        `Customer: ${customerName || 'Customer'}`,
        `Reply Language: ${targetLang}`,
        recentHistory ? `Recent conversation:\n${recentHistory}` : '',
        `Latest customer message: "${customerMessage}"`,
        `Draft a concise, helpful, conversion-focused customer support reply and extract any order details if the customer wants to purchase or book an item.`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a senior e-commerce CRM assistant. Return strictly valid JSON matching the schema. Keep replies polite, concise (2-3 sentences), and practical for WhatsApp/Messenger/Gmail. Only populate extractedOrder if a product/order intent is clearly present; otherwise set hasOrder=false.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              replyText: { type: Type.STRING, description: 'Polite customer reply in the requested language.' },
              detectedIntent: {
                type: Type.STRING,
                description: 'Short intent label like Price Inquiry, Order Confirmation, Delivery Tracking, or Support.',
              },
              suggestedStatus: {
                type: Type.STRING,
                description: 'One of PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED.',
              },
              hasOrder: { type: Type.BOOLEAN },
              extractedItem: { type: Type.STRING },
              extractedQuantity: { type: Type.INTEGER },
              extractedUnitPrice: { type: Type.NUMBER },
              extractedAddress: { type: Type.STRING },
            },
            required: ['replyText', 'detectedIntent', 'suggestedStatus', 'hasOrder'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
      const suggestedStatus = validStatuses.includes(parsed.suggestedStatus) ? parsed.suggestedStatus : 'PENDING';

      res.json({
        replyText: parsed.replyText || '',
        detectedIntent: parsed.detectedIntent || 'General Inquiry',
        suggestedStatus,
        extractedOrder: parsed.hasOrder
          ? {
              customerName: customerName || 'Customer',
              item: parsed.extractedItem || 'Catalog Item',
              quantity: Math.max(1, Number(parsed.extractedQuantity) || 1),
              unitPrice: Math.max(0, Number(parsed.extractedUnitPrice) || 1200),
              address: parsed.extractedAddress || '',
            }
          : null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate AI reply';
      console.error('AI draft-reply error:', message);
      res.status(500).json({ error: message });
    }
  });

  // Server-side Gemini Automation Rule Builder
  app.post('/api/ai/generate-rule', async (req, res) => {
    try {
      const { goalPrompt, channel, language } = req.body ?? {};
      if (!goalPrompt || typeof goalPrompt !== 'string') {
        res.status(400).json({ error: 'goalPrompt is required' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in server secrets.',
          code: 'API_KEY_MISSING',
        });
        return;
      }

      const targetLang = language === 'en' ? 'English' : 'Bengali';
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a customer support auto-reply automation rule for channel "${channel || 'ALL'}" in ${targetLang} based on this business policy: "${goalPrompt}"`,
        config: {
          systemInstruction:
            'Generate a concise automation rule with 3 to 6 relevant trigger keywords (mixing Bengali and English if helpful) and a clear customer-facing reply template.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              replyTemplate: { type: Type.STRING },
              autoExtractOrder: { type: Type.BOOLEAN },
            },
            required: ['name', 'keywords', 'replyTemplate', 'autoExtractOrder'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        name: parsed.name || 'Smart Auto-Reply Rule',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8) : ['price', 'order'],
        replyTemplate: parsed.replyTemplate || '',
        autoExtractOrder: Boolean(parsed.autoExtractOrder),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate rule';
      console.error('AI generate-rule error:', message);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server: httpServer },
        allowedHosts: true,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Automation CRM server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
