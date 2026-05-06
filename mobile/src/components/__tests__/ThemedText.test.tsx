import * as React from 'react';
import { render } from '@testing-library/react-native';
import { ThemedText } from '../themed-text';
import { ThemeProvider } from '@/hooks/use-theme';

// Mocking useTheme if needed, but since we have ThemeProvider we can wrap it
// Or we can mock the hook directly for simplicity in this example

describe('ThemedText', () => {
  it('renders correctly with default props', () => {
    const { getByText } = render(
      <ThemedText>Hello World</ThemedText>
    );
    
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('renders with title style', () => {
    const { getByText } = render(
      <ThemedText type="title">Title Text</ThemedText>
    );
    
    const text = getByText('Title Text');
    expect(text.props.style).toContainEqual(expect.objectContaining({ fontSize: 48 }));
  });
});
