import { configureStore } from '@reduxjs/toolkit';
import type { StoryFn } from '@storybook/react';
import { Provider } from 'react-redux';

/**
 * Minimal Redux store to satisfy Headlamp components that reach for settings
 * or UI state, such as SimpleTable and SectionBox.
 *
 * Each reducer returns its existing state, which keeps stories from
 * re-rendering forever.
 */
const minimalStore = configureStore({
  reducer: {
    config: (state = { settings: { tableRowsPerPageOptions: [15, 25, 50] } }) => state,
    filter: (state = { search: '' }) => state,
    plugins: (state = { pluginSettings: {} }) => state,
    ui: (state = { details: { isVisible: false } }) => state,
  },
});

/**
 * Storybook decorator wrapping stories in a Redux Provider.
 *
 * Usage:
 * ```
 * import { ReduxDecorator } from '../../helpers/storybook';
 *
 * export default {
 *   decorators: [ReduxDecorator],
 * } as Meta;
 * ```
 */
export const ReduxDecorator = (Story: StoryFn) => (
  <Provider store={minimalStore}>
    <Story />
  </Provider>
);
