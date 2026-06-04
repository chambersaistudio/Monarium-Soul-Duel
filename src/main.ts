import './style.css';
import { Input } from './input';
import { freshState } from './model';
import { Painter } from './painter';
import { FlarepawSheet } from './flarepawSheet';
import { step } from './simulation';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const context = canvas?.getContext('2d');
if (!canvas || !context) throw new Error('Canvas rendering is unavailable.');

const state = freshState();
const input = new Input();
const painter = new Painter(context, new FlarepawSheet());
let previous = performance.now();

function frame(now: number) {
  step(state, input, (now - previous) / 1000);
  painter.render(state);
  previous = now;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
