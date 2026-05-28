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

    // Try sending Discord notification if webhook URL is configured
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhookUrl) {
      try {
        const requestUrl = new URL(request.url);
        const baseUrl = requestUrl.host.includes("localhost")
          ? `${requestUrl.protocol}//${requestUrl.host}`
          : "https://prep-loop-alpha.vercel.app";
        
        let embed = {
          title: "🔄 PrepLoop Daily Questions Activated!",
          description: `PrepLoop spacing engine has activated your daily review batch. [Go to PrepLoop Dashboard](${baseUrl})`,
          color: 8388836, // Sleek purple color (0x800080 in decimal: 8388836)
          fields: [],
          timestamp: new Date().toISOString(),
          footer: {
            text: "PrepLoop Spaced-Repetition Engine • Daily Cron",
          }
        };

        if (result.activated && result.activated.length > 0) {
          embed.fields = result.activated.map((q, index) => ({
            name: `Question ${index + 1}`,
            value: `**${q.title}**\n*(ID: \`${q.id}\`)*`,
            inline: false,
          }));
          if (result.existingDueCount && result.existingDueCount > 0) {
            embed.description += `\n\n*(Note: You also have **${result.existingDueCount}** existing reviews due today, bringing your active queue to **${result.totalDueNow}** questions.)*`;
          }
        } else if (result.newQuestionsCapReached) {
          embed.title = "📈 PrepLoop Daily Study Limit Capped";
          embed.description = `To maintain focus and prevent backlog overload, PrepLoop didn't activate new questions today because you still have **2 unanswered new questions** waiting on your board.\n\nAnswer them to unlock new ones! [Go to PrepLoop Dashboard](${baseUrl})`;
          embed.color = 3447003; // Light blue for focal balance (0x3498db in decimal: 3447003)
        } else {
          embed.title = "⚠️ Ingestion Bank Depleted";
          embed.description = `PrepLoop wanted to activate new questions, but there are **no new unassigned questions** left in your repository.\n\nPlease upload more questions via your [Resume Profile](${baseUrl}) or [Target Roles](${baseUrl}) to keep the daily cycle going.`;
          embed.color = 16753920; // Sleek warning orange (0xffa500 in decimal)
        }

        await fetch(discordWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [embed],
          }),
        });
      } catch (webhookError) {
        // Log the error but do not fail the cron response itself
        console.error("Failed to dispatch Discord webhook:", webhookError);
      }
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
