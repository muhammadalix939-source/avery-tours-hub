import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with Database ID (Enterprise / Free-Tier)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Authentication
export const auth = getAuth(app);

// Error Handling Specification matching system requirements
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
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
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate Connection to Firestore
 * Only runs remote probe when authenticated or explicitly requested
 */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  if (typeof window === "undefined") {
    return { ok: true, message: "Server-side render (bypassed)" };
  }
  if (!auth.currentUser) {
    return { ok: true, message: "Local mode active (sign in to sync with Cloud DB)" };
  }
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return { ok: true, message: "Connected to Cloud Firestore" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("the client is offline") || msg.includes("token-service-api")) {
      return { ok: false, message: "Cloud connection offline or token service pending" };
    }
    // If permission or not found, it still proves connection reached Firestore server
    return { ok: true, message: "Connection verified" };
  }
}

/**
 * Sign in using Google Provider via popup
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    console.error("Sign in with Google error:", err);
    throw err;
  }
}

/**
 * Sign out current user
 */
export async function logOut(): Promise<void> {
  await signOut(auth);
}

/**
 * Push an entity to a Firestore collection
 */
export async function syncDocToFirestore(collectionName: string, id: string, data: Record<string, unknown>) {
  if (!auth.currentUser) return;
  const path = `${collectionName}/${id}`;
  try {
    await setDoc(doc(db, collectionName, id), data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete an entity from a Firestore collection
 */
export async function deleteDocFromFirestore(collectionName: string, id: string) {
  if (!auth.currentUser) return;
  const path = `${collectionName}/${id}`;
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Pull all documents from a Firestore collection
 */
export async function fetchCollectionFromFirestore<T>(collectionName: string): Promise<T[]> {
  const path = collectionName;
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map((d) => d.data() as T);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Push full app state to Firestore
 */
export async function pushFullStateToFirestore(state: {
  clients: unknown[];
  bookings: unknown[];
  agents: unknown[];
  suppliers: unknown[];
  entries: unknown[];
  groups: unknown[];
  accounts: unknown[];
  opening: unknown;
  alertSettings: unknown;
}) {
  if (!auth.currentUser) {
    throw new Error("Must be signed in to sync to Cloud Database");
  }

  const collectionsToSync: Array<{ name: string; items: Array<{ id: string }> }> = [
    { name: "clients", items: state.clients as Array<{ id: string }> },
    { name: "bookings", items: state.bookings as Array<{ id: string }> },
    { name: "agents", items: state.agents as Array<{ id: string }> },
    { name: "suppliers", items: state.suppliers as Array<{ id: string }> },
    { name: "entries", items: state.entries as Array<{ id: string }> },
    { name: "groups", items: state.groups as Array<{ id: string }> },
    { name: "accounts", items: state.accounts as Array<{ id: string }> },
  ];

  for (const { name, items } of collectionsToSync) {
    if (!items || items.length === 0) continue;
    // Chunk writes in batches of 400
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        if (item.id) {
          batch.set(doc(db, name, String(item.id)), item, { merge: true });
        }
      }
      await batch.commit();
    }
  }

  // Save settings
  await setDoc(doc(db, "settings", "opening"), { id: "opening", data: state.opening }, { merge: true });
  await setDoc(doc(db, "settings", "alertSettings"), { id: "alertSettings", data: state.alertSettings }, { merge: true });
}

export { onAuthStateChanged, type User };
