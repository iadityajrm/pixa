'use client';

import { Provider } from 'react-redux';
import { ThemeProvider } from 'next-themes';
import { store } from '../store/store';
import ChatGptAuthRedirectHandler from './ChatGptAuthRedirectHandler';
import MotionPreferences from '@/components/motion/MotionPreferences';
import { PageTransitionProvider } from '@/components/motion/PageTransitionProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <MotionPreferences />
        <ChatGptAuthRedirectHandler />
        <PageTransitionProvider>
          {children}
        </PageTransitionProvider>
      </ThemeProvider>
    </Provider>
  );
}
