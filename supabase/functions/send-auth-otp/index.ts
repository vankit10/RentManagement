import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TWOFACTOR_API_KEY = "343a995e-97e7-11f1-9cb1-0200cd936042"; // Same key as your rent-sms function

serve(async (req) => {
  try {
    const body = await req.json();

    // Supabase Auth SMS Hook Payload Structure:
    // { user: { phone: "+919999999999" }, sms: { otp: "123456" } }
    const phone = body.user?.phone;
    const otp = body.sms?.otp;

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "Missing phone or otp in payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2Factor.in OTP API Endpoint
    // This uses the default OTP template. 
    // If you have a custom DLT template, append /YourTemplateName to the URL.
    const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${phone}/${otp}`;

    const response = await fetch(url, {
      method: "GET", // 2Factor OTP API uses GET by default
    });

    const result = await response.text();

    console.log("2Factor OTP response:", result);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to send OTP via 2Factor", details: result }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Must return a 200 OK response to tell Supabase the message was successfully dispatched
    return new Response(
      JSON.stringify({ success: true, message: "OTP dispatched" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending OTP:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
