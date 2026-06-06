import { t as translate } from "./i18n.mjs";

const ERROR_KEYS = {
  registerFailed: "auth.error.registerFailed",
  needCode: "auth.error.needCode",
  registerNoToken: "auth.error.registerNoToken",
  verifyFailed: "auth.error.verifyFailed",
  verifyNoToken: "auth.error.verifyNoToken",
  loginVerifyFirst: "auth.error.loginVerifyFirst",
  loginFailed: "auth.error.loginFailed",
  loginNoToken: "auth.error.loginNoToken",
};

export function authErrorMessage(locale, key, serviceMessage) {
  if (serviceMessage) return serviceMessage;
  return translate(locale, ERROR_KEYS[key] || key);
}
