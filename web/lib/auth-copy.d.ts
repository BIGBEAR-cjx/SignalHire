export type AuthErrorKey =
  | "registerFailed"
  | "needCode"
  | "registerNoToken"
  | "verifyFailed"
  | "verifyNoToken"
  | "loginVerifyFirst"
  | "loginFailed"
  | "loginNoToken"
  | "passwordResetRequestFailed"
  | "passwordResetCodeFailed"
  | "passwordResetFailed";

export function authErrorMessage(
  locale: "zh" | "en" | string,
  key: AuthErrorKey,
  serviceMessage?: string | null,
): string;
