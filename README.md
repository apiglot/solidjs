# @apiglot/solidjs

Thin SolidJS wrappers around popular i18n libraries, powered by [Apiglot](https://apiglot.com).

Currently supported:

- [i18next](#i18next-wrapper) - the most popular i18n library for JavaScript

Planned:

- [@solid-primitives/i18n](https://primitives.solidjs.community/package/i18n)

## Installation

```bash
npm install @apiglot/solidjs
# or
pnpm add @apiglot/solidjs
# or
yarn add @apiglot/solidjs
```

**Peer dependency:** `solid-js` >= 1.6.0

## i18next Wrapper

### Setup

Wrap your app with the `I18NextContext` provider, passing your Apiglot project credentials:

```tsx
import { render } from 'solid-js/web';
import { I18NextContext } from '@apiglot/solidjs/i18next';
import App from './App';

render(
  () => (
    <I18NextContext
      projectId="your-project-id"
      apiKey="your-api-key"
    >
      <App />
    </I18NextContext>
  ),
  document.getElementById('root')!
);
```

#### Provider Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | `string` | Yes | Your Apiglot project ID |
| `apiKey` | `string` | Yes | Your Apiglot API key |
| `host` | `string` | No | Custom API host (defaults to `https://api.apiglot.com`) |
| `debug` | `boolean` | No | Enable i18next debug mode |

### Usage in Components

#### `useTranslation` hook

The primary way to translate text. Optionally pass a namespace to load.

```tsx
import { useTranslation } from '@apiglot/solidjs/i18next';

function Greeting() {
  const { t } = useTranslation('common');

  return (
    <div>
      <h1>{t('welcome_title')}</h1>
      <p>{t('welcome_message', 'Welcome!')}</p>
    </div>
  );
}
```

The second argument to `t()` can be a default value string or an i18next options object:

```tsx
const { t } = useTranslation('common');

// With a default value
t('greeting', 'Hello!')

// With i18next interpolation options
t('greeting_name', { name: 'World' })
```

#### `Translateable` component

A declarative alternative to the `useTranslation` hook:

```tsx
import { Translateable } from '@apiglot/solidjs/i18next';

function ProductCard() {
  return (
    <div>
      <Translateable key="product.title" namespace="shop" />
      <Translateable
        key="product.description"
        namespace="shop"
        placeholders={{ price: '9.99', currency: 'USD' }}
      />
      <Translateable
        key="product.disclaimer"
        namespace="shop"
        renderHtml={true}
      />
    </div>
  );
}
```

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | Yes | Translation key |
| `namespace` | `string \| string[]` | No | Namespace(s) to load |
| `placeholders` | `Record<string, any>` | No | Interpolation values |
| `renderHtml` | `boolean` | No | Render HTML tags in the translation string (default: `false`) |

#### `LanguageSwitch` component

A ready-made `<select>` dropdown for switching languages. It automatically lists all languages configured in your Apiglot project.

```tsx
import { LanguageSwitch } from '@apiglot/solidjs/i18next';

function Header() {
  return (
    <nav>
      <h1>My App</h1>
      <LanguageSwitch class="lang-picker" />
    </nav>
  );
}
```

It accepts all standard `<select>` HTML attributes.

#### `useI18Next` hook

For advanced use cases, access the full context object:

```tsx
import { useI18Next } from '@apiglot/solidjs/i18next';

function LanguageInfo() {
  const ctx = useI18Next();

  return (
    <div>
      <p>Current language: {ctx?.currentLanguage()}</p>
      <p>Available: {ctx?.languages().map(l => l.name).join(', ')}</p>
      <button onClick={() => ctx?.changeLanguage('es')}>
        Switch to Spanish
      </button>
    </div>
  );
}
```

The context object provides:

| Property | Type | Description |
|----------|------|-------------|
| `loading` | `Accessor<boolean>` | Whether project info is still loading |
| `languages` | `Accessor<Language[]>` | All available languages |
| `currentLanguage` | `Accessor<string \| null>` | Current language code |
| `changeLanguage` | `(langCode: string) => Promise<void>` | Switch the active language |
| `loadNamespace` | `(ns: string \| string[]) => Promise<void>` | Load additional namespace(s) |
| `loadRawJson` | `(langCode: string, ns: string) => Promise<Record<string, any>>` | Fetch raw translation JSON |
| `i18next` | `i18next` | The underlying i18next instance |

## License

MIT
