import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { AutomationRule, BusinessProfile, OrderRecord } from '../types/crm';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore offline: check Firebase configuration.');
      return false;
    }
    return true;
  }
}

export async function signInWithGooglePopup(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export async function syncUserProfileToFirestore(user: User, business: BusinessProfile): Promise<void> {
  const publicPath = `users/${user.uid}/public/profile`;
  const privatePath = `users/${user.uid}/private/info`;

  const displayName = (business.displayName || user.displayName || 'CRM Operator').slice(0, 120);
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || 'A';

  try {
    const existingPub = await getDoc(doc(db, 'users', user.uid, 'public', 'profile'));
    if (!existingPub.exists()) {
      await setDoc(doc(db, 'users', user.uid, 'public', 'profile'), {
        uid: user.uid,
        displayName,
        avatarInitial,
        authProvider: 'GOOGLE',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'users', user.uid, 'public', 'profile'), {
        displayName,
        avatarInitial,
        authProvider: 'GOOGLE',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  try {
    const privateRef = doc(db, 'users', user.uid, 'private', 'info');
    const existingPriv = await getDoc(privateRef);
    const payload = {
      email: (business.email || user.email || '').slice(0, 180),
      phone: (business.phone || '').slice(0, 32),
      businessName: (business.businessName || displayName).slice(0, 120),
      businessAddress: (business.businessAddress || '').slice(0, 250),
      updatedAt: serverTimestamp(),
    };
    if (!existingPriv.exists()) {
      await setDoc(privateRef, {
        uid: user.uid,
        ...payload,
      });
    } else {
      await updateDoc(privateRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function loadUserPrivateInfo(uid: string): Promise<Partial<BusinessProfile> | null> {
  const path = `users/${uid}/private/info`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      email: d.email || '',
      phone: d.phone || '',
      businessName: d.businessName || '',
      businessAddress: d.businessAddress || '',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchUserOrdersFromFirestore(uid: string): Promise<OrderRecord[]> {
  const path = `users/${uid}/orders`;
  try {
    const q = query(
      collection(db, 'users', uid, 'orders'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: d.id,
        uid: d.uid,
        customerName: d.customerName,
        phone: d.phone,
        channel: d.channel,
        item: d.item,
        quantity: Number(d.quantity),
        unitPrice: Number(d.unitPrice),
        deliveryFee: Number(d.deliveryFee),
        discount: Number(d.discount),
        total: Number(d.total),
        status: d.status,
        paymentStatus: d.paymentStatus,
        address: d.address || '',
        notes: d.notes || '',
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : new Date().toISOString(),
      } as OrderRecord;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveOrderToFirestore(uid: string, order: OrderRecord, isNew: boolean): Promise<void> {
  const path = `users/${uid}/orders/${order.id}`;
  try {
    const ref = doc(db, 'users', uid, 'orders', order.id);
    if (isNew) {
      await setDoc(ref, {
        id: order.id.slice(0, 128),
        uid,
        customerName: order.customerName.slice(0, 120),
        phone: order.phone.slice(0, 32),
        channel: order.channel,
        item: order.item.slice(0, 180),
        quantity: Math.max(1, Math.floor(order.quantity)),
        unitPrice: Math.max(0, Number(order.unitPrice)),
        deliveryFee: Math.max(0, Number(order.deliveryFee)),
        discount: Math.max(0, Number(order.discount)),
        total: Math.max(0, Number(order.total)),
        status: order.status,
        paymentStatus: order.paymentStatus,
        address: (order.address || '').slice(0, 250),
        notes: (order.notes || '').slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        customerName: order.customerName.slice(0, 120),
        phone: order.phone.slice(0, 32),
        channel: order.channel,
        item: order.item.slice(0, 180),
        quantity: Math.max(1, Math.floor(order.quantity)),
        unitPrice: Math.max(0, Number(order.unitPrice)),
        deliveryFee: Math.max(0, Number(order.deliveryFee)),
        discount: Math.max(0, Number(order.discount)),
        total: Math.max(0, Number(order.total)),
        status: order.status,
        paymentStatus: order.paymentStatus,
        address: (order.address || '').slice(0, 250),
        notes: (order.notes || '').slice(0, 500),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function removeOrderFromFirestore(uid: string, orderId: string): Promise<void> {
  const path = `users/${uid}/orders/${orderId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'orders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchUserRulesFromFirestore(uid: string): Promise<AutomationRule[]> {
  const path = `users/${uid}/rules`;
  try {
    const q = query(collection(db, 'users', uid, 'rules'), where('uid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: d.id,
        uid: d.uid,
        name: d.name,
        channel: d.channel,
        keywords: Array.isArray(d.keywords) ? d.keywords : [],
        replyTemplate: d.replyTemplate,
        autoExtractOrder: Boolean(d.autoExtractOrder),
        enabled: Boolean(d.enabled),
        hitCount: Number(d.hitCount || 0),
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : new Date().toISOString(),
      } as AutomationRule;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveRuleToFirestore(uid: string, rule: AutomationRule, isNew: boolean): Promise<void> {
  const path = `users/${uid}/rules/${rule.id}`;
  const cleanKeywords = rule.keywords.map((k) => k.trim().slice(0, 60)).filter(Boolean).slice(0, 10);
  if (cleanKeywords.length === 0) cleanKeywords.push('info');
  try {
    const ref = doc(db, 'users', uid, 'rules', rule.id);
    if (isNew) {
      await setDoc(ref, {
        id: rule.id.slice(0, 128),
        uid,
        name: rule.name.slice(0, 120),
        channel: rule.channel,
        keywords: cleanKeywords,
        replyTemplate: rule.replyTemplate.slice(0, 1000),
        autoExtractOrder: Boolean(rule.autoExtractOrder),
        enabled: Boolean(rule.enabled),
        hitCount: Math.max(0, Math.floor(rule.hitCount)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: rule.name.slice(0, 120),
        channel: rule.channel,
        keywords: cleanKeywords,
        replyTemplate: rule.replyTemplate.slice(0, 1000),
        autoExtractOrder: Boolean(rule.autoExtractOrder),
        enabled: Boolean(rule.enabled),
        hitCount: Math.max(0, Math.floor(rule.hitCount)),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function removeRuleFromFirestore(uid: string, ruleId: string): Promise<void> {
  const path = `users/${uid}/rules/${ruleId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'rules', ruleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
