import { NextResponse } from "next/server";
import { globalTaskManager } from "@/lib/autonomousTasks";

let NeverForgetEngineClass: any;
try {
  NeverForgetEngineClass = require("never-forget-engine").NeverForgetEngine;
} catch (e) {}

const memoryEngine = NeverForgetEngineClass ? new NeverForgetEngineClass() : null;

export async function GET() {
  try {
    const tasks = globalTaskManager.getTasks();
    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch autonomous tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "add" && body.title) {
      const task = globalTaskManager.addTask({
        title: body.title,
        description: body.description || "User-queued research task",
        status: "queued",
        model: body.model || "Local Model",
        origin: "user_derived",
      });
      return NextResponse.json({ task });
    } else if (body.action === "process") {
      const task = await globalTaskManager.processNextTask(memoryEngine);
      return NextResponse.json({ task });
    }
    return NextResponse.json({ error: "Invalid task action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Task execution error" }, { status: 500 });
  }
}
