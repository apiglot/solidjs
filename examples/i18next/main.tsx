import { render } from 'solid-js/web';
import { I18NextContext } from '@apiglot/solidjs/i18next';
import App from './App';

import './index.css';

const root = document.getElementById('root');

render(
  () => (
    <I18NextContext
      projectId={process.env.APIGLOT_PROJECT_ID}
      apiKey={process.env.APIGLOT_API_KEY}
    >
      <App />
    </I18NextContext>
  ),
  root!);