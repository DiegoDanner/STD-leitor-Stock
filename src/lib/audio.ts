import { Howl } from 'howler';

// A simple high-pitched beep sound
export const beepSound = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'],
  volume: 0.5,
});

export const playBeep = () => {
  beepSound.play();
};
