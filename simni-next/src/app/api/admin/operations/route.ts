import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, workspaceId, operationId, payload } = body;

    if (!action || !workspaceId || !operationId) {
      return NextResponse.json({ success: false, error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    const { adminDatabase } = getFirebaseAdmin();

    // Two-Phase Commit Step 1: Write reservation marker
    const opRef = adminDatabase.ref(`administrativeOperations/${workspaceId}/${operationId}`);
    await opRef.set({
      action,
      status: 'pending',
      timestamp: Date.now()
    });

    // Step 2: Execute operation payload
    if (payload && typeof payload === 'object') {
      await adminDatabase.ref().update(payload);
    }

    // Step 3: Write audit receipt and mark completed
    await opRef.update({
      status: 'completed',
      completedAt: Date.now()
    });

    const auditRef = adminDatabase.ref(`auditLogs/${workspaceId}/${operationId}`);
    await auditRef.set({
      action,
      operationId,
      status: 'committed',
      timestamp: Date.now()
    });

    return NextResponse.json({ success: true, operationId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operasi administratif gagal.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
