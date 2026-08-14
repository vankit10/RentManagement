import { supabase } from "../lib/supabase";

interface RentReminderData {
  phoneNumber: string;
  tenantName: string;
  rentAmount: number;
  dueDate: string;
}

export const sendRentReminder = async (
  data: RentReminderData
) => {
  const { data: response, error } =
    await supabase.functions.invoke("send-rent-sms", {
      body: data,
    });

  if (error) {
    console.error("SMS Error:", error);
    throw error;
  }

  if (!response?.success) {
    throw new Error(
      response?.error || "Failed to send SMS"
    );
  }

  return response;
};