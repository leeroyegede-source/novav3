import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const runnerUrl = process.env.RUNNER_API_URL;
    const runnerSecret = process.env.RUNNER_SECRET;

    if (!runnerUrl) {
      return NextResponse.json(
        { success: false, error: 'Runner API URL is not configured.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { projectId, files } = body;

    if (!projectId || !files) {
      return NextResponse.json(
        { success: false, error: 'Missing projectId or files in request.' },
        { status: 400 }
      );
    }

    const response = await fetch(`${runnerUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(runnerSecret && { 'Authorization': `Bearer ${runnerSecret}` }),
      },
      body: JSON.stringify({ projectId, files }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { 
          success: false, 
          error: errorData.message || `Docker Runner failed with status: ${response.status}` 
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      previewUrl: data.previewUrl,
    });

  } catch (error) {
    console.error('[Docker Runner API Error]:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected server error occurred.' },
      { status: 500 }
    );
  }
}
