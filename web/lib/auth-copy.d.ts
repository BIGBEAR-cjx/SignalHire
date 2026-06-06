export type AuthErrorKey =
  | "registerFailed"
  | "needCode"
  | "registerNoToken"
  | "verifyFailed"
  | "verifyNoToken"
  | "loginVerifyFirst"
  | "loginFailed"
  | "loginNoToken";

export function authErrorMessage(
  locale: "zh" | "en" | string,
  key: AuthErrorKey,
  serviceMessage?: string | null,
): string;
