import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { purpose, workspaceId, academicYearId } = body;

    const apiKey = process.env.CLOUDINARY_API_KEY || 'mock_api_key';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'mock_api_secret';
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud_name';

    const timestamp = Math.round(new Date().getTime() / 1000);
    const publicId = `simni/${workspaceId || 'common'}/${academicYearId || '2026'}/${purpose || 'doc'}/${crypto.randomUUID()}`;

    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    return NextResponse.json({
      success: true,
      signature,
      timestamp,
      publicId,
      apiKey,
      cloudName
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghasilkan tanda tangan Cloudinary.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
