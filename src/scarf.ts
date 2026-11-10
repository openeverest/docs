import type {ClientModule} from '@docusaurus/types';

const SCARF_PIXEL_URL = 'https://static.scarf.sh/a.png?x-pxid=acbfc89c-7a96-4ca9-b2a7-cc7fe84477e5';

// Docusaurus navigates client-side, so the pixel must be requested on every route change, not just once in the page head.
const scarfPixel: ClientModule = {
  onRouteDidUpdate({location, previousLocation}) {
    if (previousLocation && location.pathname === previousLocation.pathname) {
      return;
    }
    const pixel = new Image();
    pixel.referrerPolicy = 'no-referrer-when-downgrade';
    pixel.src = SCARF_PIXEL_URL;
  },
};

export default scarfPixel;
