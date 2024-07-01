// CalendarEditor.tsx

import React, { useState, useEffect } from 'react';
import { Box, Flex, useColorMode } from '@chakra-ui/react';

const CalendarEditor = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [editorContent, setEditorContent] = useState('');
  const { colorMode } = useColorMode();

  useEffect(() => {
    const localContent = localStorage.getItem('editorContent');
    if (localContent) {
      setEditorContent(localContent);
    } else {
      fetchEditorContent();
    }
  }, [date]);

  const fetchEditorContent = () => {
    fetch('http://localhost:5000/getEditorContent')
      .then(response => response.json())
      .then(data => {
        setEditorContent(data.content);
        localStorage.setItem('editorContent', data.content);
      })
      .catch(error => console.error('Error fetching editor content:', error));
  };

  const handleEditorChange = (content: string) => {
    setEditorContent(content);
    localStorage.setItem('editorContent', content);

    fetch('http://localhost:5000/saveEditorContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).catch(error => console.error('Error saving editor content:', error));
  };

  return (
    <Flex width="80%" mx="auto" mt={5} justify="space-between">
      <Box flexShrink={0}>
        <div>Calendar Placeholder</div>
      </Box>
      <Box flexGrow={1} ml={4}>
        <div>Editor Placeholder</div>
      </Box>
    </Flex>
  );
};

export default CalendarEditor;