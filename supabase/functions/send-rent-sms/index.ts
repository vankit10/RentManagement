import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TWOFACTOR_API_KEY = "343a995e-97e7-11f1-9cb1-0200cd936042"; // Note: It's better to use Deno.env.get("TWOFACTOR_API_KEY") and set it in Supabase secrets

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();

    const {
      phoneNumber,
      tenantName,
      rentAmount,
      dueDate,
    } = body;

    if (!phoneNumber || !tenantName || !rentAmount || !dueDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!TWOFACTOR_API_KEY) {
      throw new Error("2Factor API key is not configured");
    }

    const message =
      `Hello ${tenantName}, your rent of Rs.${rentAmount} is due on ${dueDate}. Please make the payment on time.`;

    const response = await fetch(
      `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/ADDON_SERVICES/SEND/TSMS`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Make sure to replace this with your actual 6-character DLT approved Sender ID!
          From: "YOUR_SENDER_ID", 
          To: phoneNumber,
          Msg: message,
        }),
      }
    );

    const result = await response.text();

    console.log("2Factor response:", result);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result,
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Rent reminder sent",
        providerResponse: result,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error
          ? error.message
          : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});