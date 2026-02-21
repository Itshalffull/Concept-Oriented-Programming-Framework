import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { ConduitAPI } from '../../shared/api-client.js';

interface Props {
  api: ConduitAPI;
  onPublished: (slug: string) => void;
  onBack: () => void;
}

type Field = 'title' | 'description' | 'body' | 'tags';

export function Editor({ api, onPublished, onBack }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [field, setField] = useState<Field>('title');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useInput((input, key) => {
    if (key.escape) onBack();
  });

  async function handleSubmit() {
    switch (field) {
      case 'title': setField('description'); return;
      case 'description': setField('body'); return;
      case 'body': setField('tags'); return;
    }

    // field === 'tags', publish
    setError('');
    setLoading(true);
    const tagList = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    try {
      const res = await api.createArticle(title, description, body, tagList);
      onPublished(res.article.slug);
    } catch (err: any) {
      setError(err.message || 'Failed to publish article');
      setLoading(false);
    }
  }

  const fields: { key: Field; label: string; value: string; setter: (v: string) => void }[] = [
    { key: 'title', label: 'Title', value: title, setter: setTitle },
    { key: 'description', label: 'Description', value: description, setter: setDescription },
    { key: 'body', label: 'Body', value: body, setter: setBody },
    { key: 'tags', label: 'Tags (comma-separated)', value: tagsInput, setter: setTagsInput },
  ];

  const fieldIdx = fields.findIndex(f => f.key === field);

  return (
    <Box flexDirection="column">
      <Text bold>New Article</Text>
      <Text color="gray">Press Esc to go back, Enter to advance</Text>
      {error && <Text color="red">{error}</Text>}

      {fields.map((f, i) => {
        if (i > fieldIdx) return null;
        const isCurrent = f.key === field;
        return (
          <Box key={f.key} marginTop={1}>
            <Text color={isCurrent ? 'green' : 'gray'}>{f.label}: </Text>
            {isCurrent ? (
              <TextInput value={f.value} onChange={f.setter} onSubmit={handleSubmit} />
            ) : (
              <Text>{f.value || '(empty)'}</Text>
            )}
          </Box>
        );
      })}

      {loading && <Text color="yellow">Publishing...</Text>}
    </Box>
  );
}
