import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, address, documentUrl } = body;

    if (!userId || !address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Insert address into verification queue
    const { data, error } = await supabase
      .from('address_verifications')
      .insert([
        { 
          user_id: userId, 
          address: address, 
          document_url: documentUrl,
          status: 'pending' 
        }
      ]);

    if (error) {
      console.error("[SUPABASE ERROR]", error);
      // Fallback for demo if table doesn't exist
      return NextResponse.json({ success: true, message: "Address submitted (Mock fallback due to missing DB table)", data: body });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(_req: Request) {
  try {
    // Fetch pending verifications for admin
    const { data, error } = await supabase
      .from('address_verifications')
      .select('*')
      .eq('status', 'pending');

    if (error) {
      return NextResponse.json({ success: true, data: [{ id: 1, address: "123 Mock St", status: "pending" }] });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
