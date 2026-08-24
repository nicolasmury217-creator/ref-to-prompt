/**
 * Prefilled so a first-time visitor can paste a key and hit Analyser without
 * having to know OpenRouter's slug syntax. The field stays editable.
 *
 * Free slugs churn: `deepseek/deepseek-chat-v3.1:free`, previously suggested
 * here and in .env.example, has been retired by OpenRouter and now fails. If
 * this default ever starts erroring, check the live list rather than guessing:
 *   curl -s https://openrouter.ai/api/v1/models | grep -o '"id":"[^"]*:free"'
 */
export const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
