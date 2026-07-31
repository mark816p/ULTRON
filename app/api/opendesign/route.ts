import { NextRequest, NextResponse } from "next/server";
import { openDesignEngine } from "@/lib/openDesign";

export async function GET() {
  try {
    const tokens = openDesignEngine.getTokens();
    const components = openDesignEngine.getComponents();
    return NextResponse.json({ tokens, components });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, name, description, category } = body;

    if (action === "generate" || action === "create") {
      const comp = openDesignEngine.generateDesignComponent(
        name || "Custom UI Component",
        description || "AI generated UI design system component",
        category || "card"
      );
      return NextResponse.json({ success: true, component: comp });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
