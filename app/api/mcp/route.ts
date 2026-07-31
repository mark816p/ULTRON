import { NextRequest, NextResponse } from "next/server";
import { mcpManager } from "@/lib/mcpManager";

export async function GET() {
  try {
    const servers = mcpManager.getServers();
    const tools = mcpManager.getAllTools();
    return NextResponse.json({ servers, tools });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, serverId, toolName, args } = body;

    if (action === "spin_up") {
      const server = await mcpManager.spinUpServer(serverId || "fetch");
      return NextResponse.json({ success: true, server });
    }

    if (action === "execute") {
      const result = await mcpManager.executeMcpTool(toolName || "fetch_url", args || {});
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
