const CONSENT_KEY = "ai-consent-given";

export function hasAiConsent(): boolean {
  return sessionStorage.getItem(CONSENT_KEY) === "true";
}

export function grantAiConsent(): void {
  sessionStorage.setItem(CONSENT_KEY, "true");
}
