export type LlmCacheControl = {
  type: "ephemeral";
  ttl?: "1h";
};

export type LlmTextBlock = {
  type: "text";
  text: string;
  cacheControl?: LlmCacheControl;
};

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string | LlmTextBlock[];
};
