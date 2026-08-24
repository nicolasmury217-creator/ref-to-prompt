import type { Provider } from '../types';

interface InputFormProps {
  url: string;
  description: string;
  provider: Provider;
  apiKey: string;
  openRouterModel: string;
  loading: boolean;
  onUrlChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onProviderChange: (value: Provider) => void;
  onApiKeyChange: (value: string) => void;
  onOpenRouterModelChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function InputForm({
  url,
  description,
  provider,
  apiKey,
  openRouterModel,
  loading,
  onUrlChange,
  onDescriptionChange,
  onProviderChange,
  onApiKeyChange,
  onOpenRouterModelChange,
  onSubmit,
}: InputFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-neutral-400 mb-1" htmlFor="url">
          URL de référence
        </label>
        <input
          id="url"
          type="url"
          required
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://..."
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-600"
        />
      </div>
      <div>
        <label className="block text-sm text-neutral-400 mb-1" htmlFor="description">
          Ce que tu veux construire
        </label>
        <textarea
          id="description"
          required
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          placeholder="ex: site pour un domaine viticole bourguignon"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-600"
        />
      </div>

      <div className="rounded border border-neutral-800 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-neutral-400 mb-1" htmlFor="provider">
              Fournisseur
            </label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as Provider)}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1" htmlFor="apiKey">
              Ta clé API
            </label>
            <input
              id="apiKey"
              type="password"
              required
              autoComplete="off"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-or-...'}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-600"
            />
          </div>
        </div>

        {provider === 'openrouter' && (
          <div>
            <label className="block text-sm text-neutral-400 mb-1" htmlFor="openRouterModel">
              Modèle OpenRouter
            </label>
            <input
              id="openRouterModel"
              type="text"
              required
              value={openRouterModel}
              onChange={(e) => onOpenRouterModelChange(e.target.value)}
              placeholder="ex: deepseek/deepseek-chat-v3.1:free"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-600"
            />
          </div>
        )}

        <p className="text-xs text-neutral-500">
          Ta clé part directement au fournisseur choisi à chaque requête. Elle n'est jamais
          stockée ni journalisée côté serveur, et disparaît si tu recharges la page.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-neutral-100 text-neutral-900 px-4 py-2 font-medium disabled:opacity-50"
        >
          {loading ? 'Analyse en cours...' : 'Analyser'}
        </button>
        {loading && (
          <p className="text-xs text-neutral-500">
            Jusqu'à 2-3 min avec un modèle gratuit, généralement quelques secondes avec Claude.
          </p>
        )}
      </div>
    </form>
  );
}

interface ScreenshotFallbackProps {
  onSelect: (file: File) => void;
}

export function ScreenshotFallback({ onSelect }: ScreenshotFallbackProps) {
  return (
    <div className="rounded border border-amber-800 bg-amber-950 p-4 space-y-2">
      <p className="text-sm text-amber-300">
        L'accès direct à cette page a échoué. Dépose une capture d'écran à la place.
      </p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
        }}
        className="text-sm text-amber-200"
      />
    </div>
  );
}
