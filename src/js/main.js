import { runModules } from './run-modules.js';
import * as tempPhoto from './temp-photo.js';
import * as menu from './menu.js';
import * as intro from './intro.js';
import * as videoModal from './video-modal.js';
import * as hero from './hero.js';
import * as news from './news.js';
import * as animateText from './animate-text.js';
import * as parallax from './parallax.js';
import * as flipCards from './flip-cards.js';
import * as reveals from './reveals.js';
import * as learning from './learning.js';
import * as carousel from './carousel.js';
import * as values from './values.js';
import * as ourStory from './our-story.js';
// Register a feature module: add one import above and one entry below.
// Each module exports { name, section (data-section value or null), init() (sync or async) }.

window.__aiisStarted = true; // read by the safety net in <head>: the entry module is running

runModules([
  tempPhoto,
  menu,
  intro,
  videoModal,
  hero,
  news,
  animateText,
  parallax,
  flipCards,
  reveals,
  learning,
  carousel,
  values,
  ourStory,
]);
