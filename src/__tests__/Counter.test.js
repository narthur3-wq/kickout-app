import { render, fireEvent } from '@testing-library/svelte';
import Counter from '../lib/Counter.svelte';

test('increments on click', async () => {
  const { getByText } = render(Counter);
  const btn = getByText(/count is/i);
  await fireEvent.click(btn);
  expect(btn).toHaveTextContent('count is 1');
});
