import { NextRequest, NextResponse } from 'next/server';
import { CodebaseGraphify } from '@/lib/codebaseGraphify';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetPath } = body;
    
    if (!targetPath) {
      return NextResponse.json({ error: 'Missing targetPath parameter' }, { status: 400 });
    }

    const graphify = CodebaseGraphify.getInstance();
    
    // 1. Run the extraction
    await graphify.extractCodebase(targetPath);
    
    // 2. Inject into memory
    const nodesInjected = await graphify.injectGraphIntoMemory(targetPath);
    
    return NextResponse.json({ 
      success: true, 
      message: `Graphify successfully extracted and injected ${nodesInjected} AST nodes into ULTRON memory.`
    });
  } catch (error: any) {
    console.error("Graphify API Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
