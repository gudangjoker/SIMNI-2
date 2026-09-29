import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, sheets } = body;

    // Server-side JSON structured metadata return (ready for client binary or direct streaming)
    return NextResponse.json({
      success: true,
      title: title || 'Laporan_SIMNI',
      exportedAt: new Date().toISOString(),
      sheetsCount: sheets?.length || 0
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ekspor Excel server-side gagal.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
