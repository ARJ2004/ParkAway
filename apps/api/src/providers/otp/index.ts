import { env } from "../../env.js";
import { MockOtpProvider } from "./mockOtpProvider.js";
import type { OtpProvider } from "./types.js";

export function createOtpProvider(): OtpProvider {
  switch (env.SMS_PROVIDER) {
    case "mock":
      return new MockOtpProvider();
    case "real":
      throw new Error(
        "SMS_PROVIDER=real has no implementation yet — no SMS/WhatsApp provider is picked (tech-stack.md §12). " +
          "Wire a real provider adapter here when one is chosen; don't fall back to mock silently."
      );
  }
}

export type { OtpProvider } from "./types.js";
