import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InterviewProvider } from './state/interviewState';
import { PreferencesProvider } from './state/preferences';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    // AI calls are user-triggered mutations; nothing should refetch behind the user's back
    queries: { refetchOnWindowFocus: false, staleTime: Infinity },
    mutations: { gcTime: 5 * 60_000 },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PreferencesProvider>
          <InterviewProvider>
            <App />
          </InterviewProvider>
        </PreferencesProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
