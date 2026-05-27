import { NextResponse } from "next/server";
import { activateDailyQuestionsAction } from "../../actions";

export async function GET(request) {
  return handleCron(request);
}

export async function POST(request) {
  return handleCron(request);
}

async function handleCron(request) {
  try {
    const expectedSecret = process.env.CRON_SECRET || "preploop-cron-secret";

    // Authenticate secret
    const { searchParams } = new URL(request.url);
    let secret = searchParams.get("secret");

    if (!secret) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        secret = authHeader.substring(7);
      }
    }

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Invalid secret token." },
        { status: 401 }
      );
    }

    // Activate 5 new questions from the unassigned bank
    const result = await activateDailyQuestionsAction(5);

    if (!result.success) {
      throw new Error(result.error || "Failed to activate questions.");
    }

    return NextResponse.json({
      success: true,
      message: `Successfully activated ${result.count} new questions for review.`,
      activated: result.activated,
    });

  } catch (error) {
    console.error("Cron activation failed:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
