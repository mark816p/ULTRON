import { NextRequest, NextResponse } from "next/server";
import { accomplishCoworkerEngine } from "@/lib/accomplishCoworker";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");

    if (taskId) {
      const task = accomplishCoworkerEngine.getTask(taskId);
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      return NextResponse.json({ task });
    }

    const tasks = accomplishCoworkerEngine.getAllTasks();
    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, title, goal } = body;

    if (action === "create_task" || action === "run") {
      if (!title || !goal) {
        return NextResponse.json({ error: "Title and goal are required" }, { status: 400 });
      }
      const task = await accomplishCoworkerEngine.createCoworkerTask(title, goal);
      return NextResponse.json({ success: true, task });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
