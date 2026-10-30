import type { Theme } from '../../src/app/themes';
import { Ee2PriceCheck } from './ee2-price-check';
import { Ee2PriceCheckMessage } from './ee2-price-check-message';
import { Ee2UnidentifiedPicker } from './ee2-unidentified-picker';

/** Exiled Exchange 2's look: its colours everywhere, its price check layout. */
export const EE2_THEME: Theme = {
  id: 'ee2',
  label: 'Exiled Exchange 2',
  priceCheck: Ee2PriceCheck,
  priceCheckMessage: Ee2PriceCheckMessage,
  unidentifiedPicker: Ee2UnidentifiedPicker,
  // EE2: 28.75 rem = 460 px wide, as tall as the game, next to the game's inventory or stash panel.
  priceCheckSize: { width: 460, fullHeight: true },
  // The popup position setting applies as in our theme; "Opposite the cursor" is EE2's own.
};
