import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { ConduitAPI } from '../../shared/api-client.js';
import { saveAuth } from '../../shared/auth.js';
import type { StoredUser } from '../../shared/auth.js';

interface Props {
  api: ConduitAPI;
  onLogin: (user: StoredUser) => void;
  onBack: () => void;
}

type Field = 'username' | 'email' | 'password';

export function Register({ api, onLogin, onBack }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [field, setField] = useState<Field>('username');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useInput((input, key) => {
    if (key.escape) onBack();
  });

  async function handleSubmit() {
    if (field === 'username') { setField('email'); return; }
    if (field === 'email') { setField('password'); return; }

    setError('');
    setLoading(true);
    try {
      const res = await api.register(username, email, password);
      const stored: StoredUser = { username: res.user.username, email: res.user.email, token: res.user.token };
      saveAuth(stored);
      onLogin(stored);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      setLoading(false);
    }
  }

  return (
    <Box flexDirection="column">
      <Text bold>Sign Up</Text>
      <Text color="gray">Press Esc to go back</Text>
      {error && <Text color="red">{error}</Text>}

      <Box marginTop={1}>
        <Text color={field === 'username' ? 'green' : 'gray'}>Username: </Text>
        {field === 'username' ? (
          <TextInput value={username} onChange={setUsername} onSubmit={handleSubmit} />
        ) : (
          <Text>{username}</Text>
        )}
      </Box>

      {(field === 'email' || field === 'password') && (
        <Box>
          <Text color={field === 'email' ? 'green' : 'gray'}>Email: </Text>
          {field === 'email' ? (
            <TextInput value={email} onChange={setEmail} onSubmit={handleSubmit} />
          ) : (
            <Text>{email}</Text>
          )}
        </Box>
      )}

      {field === 'password' && (
        <Box>
          <Text color="green">Password: </Text>
          <TextInput value={password} onChange={setPassword} onSubmit={handleSubmit} mask="*" />
        </Box>
      )}

      {loading && <Text color="yellow">Signing up...</Text>}
    </Box>
  );
}
