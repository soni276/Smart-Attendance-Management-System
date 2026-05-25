import { NextResponse } from "next/server";
import OpenAI from "openai";
import { parseApiBody, prepareStore } from "@/lib/api-utils";
import { getSettings } from "@/lib/storage-server";

interface TestBody {
  apiKey?: string;
  model?: "gpt-4o" | "gpt-4o-mini";
  _store?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await parseApiBody<TestBody>(
      request as import("next/server").NextRequest
    );
    prepareStore(body);

    const settings = getSettings();
    const apiKey =
      body.apiKey?.trim() ||
      settings.openaiApiKey?.trim() ||
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "No API key provided" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const model = body.model ?? settings.openaiModel ?? "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 10,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({
      success: true,
      message: text || "Connection successful",
      model,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Connection test failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
