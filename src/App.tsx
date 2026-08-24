import { useState } from 'react';
import { InputForm, ScreenshotFallback } from './components/InputForm';
import { ErrorBanner } from './components/ErrorBanner';
import { GrammaireBlock } from './components/GrammaireBlock';
import { PreferencesBlock } from './components/PreferencesBlock';
import { TensionsBlock } from './components/TensionsBlock';
import { PromptBlock } from './components/PromptBlock';
import type { AnalyzeResult, Provider } from './types';
import { DEFAULT_OPENROUTER_MODEL } from './constants';

type Status = 'idle' | 'loading' | 'needsScreenshot' | 'success' | 'error';

export default function App() {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState<Provider>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[] | null>(null);

  async function submitAnalyze(payload: { url?: string; screenshotBase64?: string }) {
    setStatus('loading');
    setError(null);
    setReasons(null);
    setResult(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          description,
          provider,
          apiKey,
          openRouterModel: provider === 'openrouter' ? openRouterModel : undefined,
        }),
      });
      const data = await res.json();

      if (res.status === 200 && data.scrapeFailed) {
        setStatus('needsScreenshot');
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Erreur ${res.status}`);
        setReasons(data.reasons ?? null);
        setStatus('error');
        return;
      }
      setResult(data as AnalyzeResult);
      setStatus('success');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitAnalyze({ url });
  }

  function handleScreenshotSelected(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      submitAnalyze({ screenshotBase64: base64 });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">référence → prompt de design</h1>
          <p className="text-neutral-400 mt-1">
            Colle l'URL d'un site que tu aimes, décris ce que tu veux construire.
          </p>
        </header>

        <InputForm
          url={url}
          description={description}
          provider={provider}
          apiKey={apiKey}
          openRouterModel={openRouterModel}
          loading={status === 'loading'}
          onUrlChange={setUrl}
          onDescriptionChange={setDescription}
          onProviderChange={setProvider}
          onApiKeyChange={setApiKey}
          onOpenRouterModelChange={setOpenRouterModel}
          onSubmit={handleUrlSubmit}
        />

        {status === 'needsScreenshot' && (
          <ScreenshotFallback onSelect={handleScreenshotSelected} />
        )}

        {status === 'error' && error && <ErrorBanner error={error} reasons={reasons} />}

        {status === 'success' && result && (
          <div className="space-y-8">
            <GrammaireBlock items={result.grammaire} />
            <PreferencesBlock items={result.preferences} />
            <TensionsBlock items={result.tensions} />
            <PromptBlock prompt={result.prompt} />
          </div>
        )}
      </div>
    </div>
  );
}
