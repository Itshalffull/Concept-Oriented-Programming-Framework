import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { ConduitAPI } from '../shared/api-client.js';
import { getToken, getUser } from '../shared/auth.js';
import type { StoredUser } from '../shared/auth.js';
import { Home } from './pages/Home.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { ArticlePage } from './pages/Article.js';
import { Editor } from './pages/Editor.js';

const api = new ConduitAPI('http://localhost:3000');

type Screen = 'home' | 'login' | 'register' | 'article' | 'editor';

export function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('home');
  const [user, setUser] = useState<StoredUser | null>(getUser());
  const [selectedSlug, setSelectedSlug] = useState<string>('');

  useEffect(() => {
    const token = getToken();
    if (token) api.setToken(token);
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  function handleLogin(u: StoredUser) {
    setUser(u);
    api.setToken(u.token);
    setScreen('home');
  }

  function openArticle(slug: string) {
    setSelectedSlug(slug);
    setScreen('article');
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">conduit</Text>
        <Text> | </Text>
        {user ? (
          <>
            <Text color={screen === 'home' ? 'white' : 'gray'}>[h]ome </Text>
            <Text color={screen === 'editor' ? 'white' : 'gray'}>[n]ew </Text>
            <Text color="cyan">{user.username} </Text>
            <Text color="gray">[q]uit</Text>
          </>
        ) : (
          <>
            <Text color={screen === 'home' ? 'white' : 'gray'}>[h]ome </Text>
            <Text color={screen === 'login' ? 'white' : 'gray'}>[l]ogin </Text>
            <Text color={screen === 'register' ? 'white' : 'gray'}>[r]egister </Text>
            <Text color="gray">[q]uit</Text>
          </>
        )}
      </Box>

      {screen === 'home' && (
        <Home api={api} user={user} onOpenArticle={openArticle} onNavigate={setScreen} />
      )}
      {screen === 'login' && (
        <Login api={api} onLogin={handleLogin} onBack={() => setScreen('home')} />
      )}
      {screen === 'register' && (
        <Register api={api} onLogin={handleLogin} onBack={() => setScreen('home')} />
      )}
      {screen === 'article' && (
        <ArticlePage api={api} slug={selectedSlug} user={user} onBack={() => setScreen('home')} />
      )}
      {screen === 'editor' && (
        <Editor api={api} onPublished={(slug) => { setSelectedSlug(slug); setScreen('article'); }} onBack={() => setScreen('home')} />
      )}
    </Box>
  );
}
