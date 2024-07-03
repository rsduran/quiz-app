// _app.tsx

import React from 'react';
import { useRouter } from 'next/router';
import { ChakraProvider } from '@chakra-ui/react';
import { MathJaxContext } from 'better-react-mathjax';
import type { AppProps } from 'next/app';
import theme from '../styles/theme';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  const config = {
    loader: { load: ["input/tex", "output/chtml"] },
    tex: {
      inlineMath: [['$', '$']],
      displayMath: [['$$', '$$']]
    },
    chtml: {
      displayAlign: 'left',
    },
    startup: { typeset: true },
  };

  return (
    <ChakraProvider theme={theme}>
      <MathJaxContext config={config}>
        <Component {...pageProps} />
      </MathJaxContext>
    </ChakraProvider>
  );
}

export default MyApp;
