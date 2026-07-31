import { NextRequest, NextResponse } from "next/server";
import { openJarvisEngine } from "@/lib/openJarvis";

export async function GET() {
  try {
    const history = openJarvisEngine.getHistory();
    const rules = openJarvisEngine.getRules();
    return NextResponse.json({ history, rules });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, command, description, ruleId, enabled } = body;

    if (action === "execute") {
      const result = await openJarvisEngine.executeComputerAction(command, description || "User requested computer action");
      return NextResponse.json({ success: true, result });
    }

    if (action === "toggle_rule") {
      openJarvisEngine.toggleRule(ruleId, enabled);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
