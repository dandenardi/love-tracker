import * as React from 'react';
import { render } from '@testing-library/react-native';
import { ThemedText } from '../themed-text';

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
