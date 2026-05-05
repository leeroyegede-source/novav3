import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { repoUrl } = await req.json();
    
    if (!repoUrl || !repoUrl.includes('github.com')) {
      return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
    }

    // Extract owner and repo
    const urlParts = repoUrl.split('github.com/')[1].split('/');
    const owner = urlParts[0];
    const repo = urlParts[1].replace('.git', '');

    // Fetch the default branch ZIP
    // Using GitHub API to get default branch first
    const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!repoInfoRes.ok) {
       return NextResponse.json({ error: 'Repository not found or private' }, { status: 404 });
    }
    const repoInfo = await repoInfoRes.json();
    const branch = repoInfo.default_branch;

    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
    
    // We could download the zip and parse it here using jszip or we can just return the zip URL
    // and let the client download and parse it using the existing JSZip logic to save server resources.
    // However, fetching it on the backend avoids CORS entirely.
    
    const zipRes = await fetch(zipUrl);
    if (!zipRes.ok) {
       return NextResponse.json({ error: 'Failed to download repository zip' }, { status: 500 });
    }

    const arrayBuffer = await zipRes.arrayBuffer();
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${repo}.zip"`
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
